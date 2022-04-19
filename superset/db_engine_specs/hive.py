# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging
import os
import re
import tempfile
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING
from urllib import parse

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from flask import current_app, g
from sqlalchemy import Column, text
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import ColumnClause, Select

from superset.common.db_query_status import QueryStatus
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.exceptions import SupersetException
from superset.extensions import cache_manager
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery, Table
from superset.utils import core as utils

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


logger = logging.getLogger(__name__)


def upload_to_s3(filename: str, upload_prefix: str, table: Table) -> str:
    """
    Upload the file to S3.

    :param filename: The file to upload
    :param upload_prefix: The S3 prefix
    :param table: The table that will be created
    :returns: The S3 location of the table
    """

    # pylint: disable=import-outside-toplevel
    import boto3

    bucket_path = current_app.config["CSV_TO_HIVE_UPLOAD_S3_BUCKET"]

    if not bucket_path:
        logger.info("No upload bucket specified")
        raise Exception(
            "No upload bucket specified. You can specify one in the config file."
        )

    s3 = boto3.client("s3")
    location = os.path.join("s3a://", bucket_path, upload_prefix, table.table)
    s3.upload_file(
        filename,
        bucket_path,
        os.path.join(upload_prefix, table.table, os.path.basename(filename)),
    )
    return location


class HiveEngineSpec(PrestoEngineSpec):
    """Reuses PrestoEngineSpec functionality."""

    engine = "hive"
    engine_name = "Apache Hive"
    max_column_name_length = 767
    allows_alias_to_source_column = True
    allows_hidden_ordeby_agg = False

    # When running `SHOW FUNCTIONS`, what is the name of the column with the
    # function names?
    _show_functions_column = "tab_name"

    # pylint: disable=line-too-long
    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:mm:ss')",
        "PT1M": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:mm:00')",
        "PT1H": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd HH:00:00')",
        "P1D": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-dd 00:00:00')",
        "P1W": "date_format(date_sub({col}, CAST(7-from_unixtime(unix_timestamp({col}),'u') as int)), 'yyyy-MM-dd 00:00:00')",
        "P1M": "from_unixtime(unix_timestamp({col}), 'yyyy-MM-01 00:00:00')",
        "P3M": "date_format(add_months(trunc({col}, 'MM'), -(month({col})-1)%3), 'yyyy-MM-dd 00:00:00')",
        "P1Y": "from_unixtime(unix_timestamp({col}), 'yyyy-01-01 00:00:00')",
        "P1W/1970-01-03T00:00:00Z": "date_format(date_add({col}, INT(6-from_unixtime(unix_timestamp({col}), 'u'))), 'yyyy-MM-dd 00:00:00')",
        "1969-12-28T00:00:00Z/P1W": "date_format(date_add({col}, -INT(from_unixtime(unix_timestamp({col}), 'u'))), 'yyyy-MM-dd 00:00:00')",
    }

    # Scoping regex at class level to avoid recompiling
    # 17/02/07 19:36:38 INFO ql.Driver: Total jobs = 5
    jobs_stats_r = re.compile(r".*INFO.*Total jobs = (?P<max_jobs>[0-9]+)")
    # 17/02/07 19:37:08 INFO ql.Driver: Launching Job 2 out of 5
    launching_job_r = re.compile(
        ".*INFO.*Launching Job (?P<job_number>[0-9]+) out of " "(?P<max_jobs>[0-9]+)"
    )
    # 17/02/07 19:36:58 INFO exec.Task: 2017-02-07 19:36:58,152 Stage-18
    # map = 0%,  reduce = 0%
    stage_progress_r = re.compile(
        r".*INFO.*Stage-(?P<stage_number>[0-9]+).*"
        r"map = (?P<map_progress>[0-9]+)%.*"
        r"reduce = (?P<reduce_progress>[0-9]+)%.*"
    )

    @classmethod
    def patch(cls) -> None:
        # pylint: disable=import-outside-toplevel
        from pyhive import hive
        from TCLIService import (
            constants as patched_constants,
            TCLIService as patched_TCLIService,
            ttypes as patched_ttypes,
        )

        from superset.db_engines import hive as patched_hive

        hive.TCLIService = patched_TCLIService
        hive.constants = patched_constants
        hive.ttypes = patched_ttypes
        hive.Cursor.fetch_logs = patched_hive.fetch_logs

    @classmethod
    def get_all_datasource_names(
        cls, database: "Database", datasource_type: str
    ) -> List[utils.DatasourceName]:
        return BaseEngineSpec.get_all_datasource_names(database, datasource_type)

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        # pylint: disable=import-outside-toplevel
        import pyhive
        from TCLIService import ttypes

        state = cursor.poll()
        if state.operationState == ttypes.TOperationState.ERROR_STATE:
            raise Exception("Query error", state.errorMessage)
        try:
            return super().fetch_data(cursor, limit)
        except pyhive.exc.ProgrammingError:
            return []

    @classmethod
    def df_to_sql(
        cls,
        database: "Database",
        table: Table,
        df: pd.DataFrame,
        to_sql_kwargs: Dict[str, Any],
    ) -> None:
        """
        Upload data from a Pandas DataFrame to a database.

        The data is stored via the binary Parquet format which is both less problematic
        and more performant than a text file. More specifically storing a table as a
        CSV text file has severe limitations including the fact that the Hive CSV SerDe
        does not support multiline fields.

        Note this method does not create metadata for the table.

        :param database: The database to upload the data to
        :param: table The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to pandas.DataFrame.to_sql` method
        """

        engine = cls.get_engine(database)

        if to_sql_kwargs["if_exists"] == "append":
            raise SupersetException("Append operation not currently supported")

        if to_sql_kwargs["if_exists"] == "fail":

            # Ensure table doesn't already exist.
            if table.schema:
                table_exists = not database.get_df(
                    f"SHOW TABLES IN {table.schema} LIKE '{table.table}'"
                ).empty
            else:
                table_exists = not database.get_df(
                    f"SHOW TABLES LIKE '{table.table}'"
                ).empty

            if table_exists:
                raise SupersetException("Table already exists")
        elif to_sql_kwargs["if_exists"] == "replace":
            engine.execute(f"DROP TABLE IF EXISTS {str(table)}")

        def _get_hive_type(dtype: np.dtype) -> str:
            hive_type_by_dtype = {
                np.dtype("bool"): "BOOLEAN",
                np.dtype("float64"): "DOUBLE",
                np.dtype("int64"): "BIGINT",
                np.dtype("object"): "STRING",
            }

            return hive_type_by_dtype.get(dtype, "STRING")

        schema_definition = ", ".join(
            f"`{name}` {_get_hive_type(dtype)}" for name, dtype in df.dtypes.items()
        )

        with tempfile.NamedTemporaryFile(
            dir=current_app.config["UPLOAD_FOLDER"], suffix=".parquet"
        ) as file:
            pq.write_table(pa.Table.from_pandas(df), where=file.name)

            engine.execute(
                text(
                    f"""
                    CREATE TABLE {str(table)} ({schema_definition})
                    STORED AS PARQUET
                    LOCATION :location
                    """
                ),
                location=upload_to_s3(
                    filename=file.name,
                    upload_prefix=current_app.config[
                        "CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC"
                    ](database, g.user, table.schema),
                    table=table,
                ),
            )

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if tt == utils.TemporalType.TIMESTAMP:
            return f"""CAST('{dttm
                .isoformat(sep=" ", timespec="microseconds")}' AS TIMESTAMP)"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def adjust_database_uri(
        cls, uri: URL, selected_schema: Optional[str] = None
    ) -> None:
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe="")

    @classmethod
    def _extract_error_message(cls, ex: Exception) -> str:
        msg = str(ex)
        match = re.search(r'errorMessage="(.*?)(?<!\\)"', msg)
        if match:
            msg = match.group(1)
        return msg

    @classmethod
    def progress(cls, log_lines: List[str]) -> int:
        total_jobs = 1  # assuming there's at least 1 job
        current_job = 1
        stages: Dict[int, float] = {}
        for line in log_lines:
            match = cls.jobs_stats_r.match(line)
            if match:
                total_jobs = int(match.groupdict()["max_jobs"]) or 1
            match = cls.launching_job_r.match(line)
            if match:
                current_job = int(match.groupdict()["job_number"])
                total_jobs = int(match.groupdict()["max_jobs"]) or 1
                stages = {}
            match = cls.stage_progress_r.match(line)
            if match:
                stage_number = int(match.groupdict()["stage_number"])
                map_progress = int(match.groupdict()["map_progress"])
                reduce_progress = int(match.groupdict()["reduce_progress"])
                stages[stage_number] = (map_progress + reduce_progress) / 2
        logger.info(
            "Progress detail: {}, "  # pylint: disable=logging-format-interpolation
            "current job {}, "
            "total jobs: {}".format(stages, current_job, total_jobs)
        )

        stage_progress = sum(stages.values()) / len(stages.values()) if stages else 0

        progress = 100 * (current_job - 1) / total_jobs + stage_progress / total_jobs
        return int(progress)

    @classmethod
    def get_tracking_url(cls, log_lines: List[str]) -> Optional[str]:
        lkp = "Tracking URL = "
        for line in log_lines:
            if lkp in line:
                return line.split(lkp)[1]
        return None

    @classmethod
    def handle_cursor(  # pylint: disable=too-many-locals
        cls, cursor: Any, query: Query, session: Session
    ) -> None:
        """Updates progress information"""
        # pylint: disable=import-outside-toplevel
        from pyhive import hive

        unfinished_states = (
            hive.ttypes.TOperationState.INITIALIZED_STATE,
            hive.ttypes.TOperationState.RUNNING_STATE,
        )
        polled = cursor.poll()
        last_log_line = 0
        tracking_url = None
        job_id = None
        query_id = query.id
        while polled.operationState in unfinished_states:
            query = session.query(type(query)).filter_by(id=query_id).one()
            if query.status == QueryStatus.STOPPED:
                cursor.cancel()
                break

            try:
                log = cursor.fetch_logs() or ""
            except Exception:  # pylint: disable=broad-except
                logger.warning("Call to GetLog() failed")
                log = ""

            if log:
                log_lines = log.splitlines()
                progress = cls.progress(log_lines)
                logger.info(
                    "Query %s: Progress total: %s", str(query_id), str(progress)
                )
                needs_commit = False
                if progress > query.progress:
                    query.progress = progress
                    needs_commit = True
                if not tracking_url:
                    tracking_url = cls.get_tracking_url(log_lines)
                    if tracking_url:
                        job_id = tracking_url.split("/")[-2]
                        logger.info(
                            "Query %s: Found the tracking url: %s",
                            str(query_id),
                            tracking_url,
                        )
                        transformer = current_app.config["TRACKING_URL_TRANSFORMER"]
                        tracking_url = transformer(tracking_url)
                        logger.info(
                            "Query %s: Transformation applied: %s",
                            str(query_id),
                            tracking_url,
                        )
                        query.tracking_url = tracking_url
                        logger.info("Query %s: Job id: %s", str(query_id), str(job_id))
                        needs_commit = True
                if job_id and len(log_lines) > last_log_line:
                    # Wait for job id before logging things out
                    # this allows for prefixing all log lines and becoming
                    # searchable in something like Kibana
                    for l in log_lines[last_log_line:]:
                        logger.info("Query %s: [%s] %s", str(query_id), str(job_id), l)
                    last_log_line = len(log_lines)
                if needs_commit:
                    session.commit()
            time.sleep(current_app.config["HIVE_POLL_INTERVAL"])
            polled = cursor.poll()

    @classmethod
    def get_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[Dict[str, Any]]:
        return inspector.get_columns(table_name, schema)

    @classmethod
    def where_latest_partition(  # pylint: disable=too-many-arguments
        cls,
        table_name: str,
        schema: Optional[str],
        database: "Database",
        query: Select,
        columns: Optional[List[Dict[str, str]]] = None,
    ) -> Optional[Select]:
        try:
            col_names, values = cls.latest_partition(
                table_name, schema, database, show_first=True
            )
        except Exception:  # pylint: disable=broad-except
            # table is not partitioned
            return None
        if values is not None and columns is not None:
            for col_name, value in zip(col_names, values):
                for clm in columns:
                    if clm.get("name") == col_name:
                        query = query.where(Column(col_name) == value)

            return query
        return None

    @classmethod
    def _get_fields(cls, cols: List[Dict[str, Any]]) -> List[ColumnClause]:
        return BaseEngineSpec._get_fields(cols)  # pylint: disable=protected-access

    @classmethod
    def latest_sub_partition(
        cls, table_name: str, schema: Optional[str], database: "Database", **kwargs: Any
    ) -> str:
        # TODO(bogdan): implement`
        pass

    @classmethod
    def _latest_partition_from_df(cls, df: pd.DataFrame) -> Optional[List[str]]:
        """Hive partitions look like ds={partition name}"""
        if not df.empty:
            return [df.ix[:, 0].max().split("=")[1]]
        return None

    @classmethod
    def _partition_query(  # pylint: disable=too-many-arguments
        cls,
        table_name: str,
        database: "Database",
        limit: int = 0,
        order_by: Optional[List[Tuple[str, bool]]] = None,
        filters: Optional[Dict[Any, Any]] = None,
    ) -> str:
        return f"SHOW PARTITIONS {table_name}"

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments
        cls,
        database: "Database",
        table_name: str,
        engine: Engine,
        schema: Optional[str] = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        return super(  # pylint: disable=bad-super-call
            PrestoEngineSpec, cls
        ).select_star(
            database,
            table_name,
            engine,
            schema,
            limit,
            show_cols,
            indent,
            latest_partition,
            cols,
        )

    @classmethod
    def modify_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> None:
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        # Do nothing in the URL object since instead this should modify
        # the configuraiton dictionary. See get_configuration_for_impersonation

    @classmethod
    def update_impersonation_config(
        cls, connect_args: Dict[str, Any], uri: str, username: Optional[str],
    ) -> None:
        """
        Update a configuration dictionary
        that can set the correct properties for impersonating users
        :param connect_args:
        :param uri: URI string
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        :return: None
        """
        url = make_url(uri)
        backend_name = url.get_backend_name()

        # Must be Hive connection, enable impersonation, and set optional param
        # auth=LDAP|KERBEROS
        # this will set hive.server2.proxy.user=$effective_username on connect_args['configuration']
        if backend_name == "hive" and username is not None:
            configuration = connect_args.get("configuration", {})
            configuration["hive.server2.proxy.user"] = username
            connect_args["configuration"] = configuration

    @staticmethod
    def execute(  # type: ignore
        cursor, query: str, async_: bool = False
    ):  # pylint: disable=arguments-differ
        kwargs = {"async": async_}
        cursor.execute(query, **kwargs)

    @classmethod
    @cache_manager.cache.memoize()
    def get_function_names(cls, database: "Database") -> List[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names useable in the database
        """
        df = database.get_df("SHOW FUNCTIONS")
        if cls._show_functions_column in df:
            return df[cls._show_functions_column].tolist()

        columns = df.columns.values.tolist()
        logger.error(
            "Payload from `SHOW FUNCTIONS` has the incorrect format. "
            "Expected column `%s`, found: %s.",
            cls._show_functions_column,
            ", ".join(columns),
            exc_info=True,
        )
        # if the results have a single column, use that
        if len(columns) == 1:
            return df[columns[0]].tolist()

        # otherwise, return no function names to prevent errors
        return []

    @classmethod
    def is_readonly_query(cls, parsed_query: ParsedQuery) -> bool:
        """Pessimistic readonly, 100% sure statement won't mutate anything"""
        return (
            super().is_readonly_query(parsed_query)
            or parsed_query.is_set()
            or parsed_query.is_show()
        )

    @classmethod
    def has_implicit_cancel(cls) -> bool:
        """
        Return True if the live cursor handles the implicit cancelation of the query,
        False otherise.

        :return: Whether the live cursor implicitly cancels the query
        :see: handle_cursor
        """

        return True


class SparkEngineSpec(HiveEngineSpec):

    engine_name = "Apache Spark SQL"
