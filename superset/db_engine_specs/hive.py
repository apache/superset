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
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib import parse

from sqlalchemy import Column
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import make_url
from sqlalchemy.sql.expression import ColumnClause, Select
from werkzeug.utils import secure_filename

from superset import app, conf
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.utils import core as utils

QueryStatus = utils.QueryStatus
config = app.config

tracking_url_trans = conf.get("TRACKING_URL_TRANSFORMER")
hive_poll_interval = conf.get("HIVE_POLL_INTERVAL")


class HiveEngineSpec(PrestoEngineSpec):
    """Reuses PrestoEngineSpec functionality."""

    engine = "hive"
    max_column_name_length = 767

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
    def patch(cls):
        from pyhive import hive  # pylint: disable=no-name-in-module
        from superset.db_engines import hive as patched_hive
        from TCLIService import (
            constants as patched_constants,
            ttypes as patched_ttypes,
            TCLIService as patched_TCLIService,
        )

        hive.TCLIService = patched_TCLIService
        hive.constants = patched_constants
        hive.ttypes = patched_ttypes
        hive.Cursor.fetch_logs = patched_hive.fetch_logs

    @classmethod
    def get_all_datasource_names(
        cls, database, datasource_type: str
    ) -> List[utils.DatasourceName]:
        return BaseEngineSpec.get_all_datasource_names(database, datasource_type)

    @classmethod
    def fetch_data(cls, cursor, limit: int) -> List[Tuple]:
        import pyhive
        from TCLIService import ttypes

        state = cursor.poll()
        if state.operationState == ttypes.TOperationState.ERROR_STATE:
            raise Exception("Query error", state.errorMessage)
        try:
            return super(HiveEngineSpec, cls).fetch_data(cursor, limit)
        except pyhive.exc.ProgrammingError:
            return []

    @classmethod
    def create_table_from_csv(cls, form, table):  # pylint: disable=too-many-locals
        """Uploads a csv file and creates a superset datasource in Hive."""

        def convert_to_hive_type(col_type):
            """maps tableschema's types to hive types"""
            tableschema_to_hive_types = {
                "boolean": "BOOLEAN",
                "integer": "INT",
                "number": "DOUBLE",
                "string": "STRING",
            }
            return tableschema_to_hive_types.get(col_type, "STRING")

        bucket_path = config["CSV_TO_HIVE_UPLOAD_S3_BUCKET"]

        if not bucket_path:
            logging.info("No upload bucket specified")
            raise Exception(
                "No upload bucket specified. You can specify one in the config file."
            )

        table_name = form.name.data
        schema_name = form.schema.data

        if config.get("UPLOADED_CSV_HIVE_NAMESPACE"):
            if "." in table_name or schema_name:
                raise Exception(
                    "You can't specify a namespace. "
                    "All tables will be uploaded to the `{}` namespace".format(
                        config.get("HIVE_NAMESPACE")
                    )
                )
            full_table_name = "{}.{}".format(
                config.get("UPLOADED_CSV_HIVE_NAMESPACE"), table_name
            )
        else:
            if "." in table_name and schema_name:
                raise Exception(
                    "You can't specify a namespace both in the name of the table "
                    "and in the schema field. Please remove one"
                )

            full_table_name = (
                "{}.{}".format(schema_name, table_name) if schema_name else table_name
            )

        filename = form.csv_file.data.filename

        upload_prefix = config["CSV_TO_HIVE_UPLOAD_DIRECTORY"]
        upload_path = config["UPLOAD_FOLDER"] + secure_filename(filename)

        # Optional dependency
        from tableschema import Table  # pylint: disable=import-error

        hive_table_schema = Table(upload_path).infer()
        column_name_and_type = []
        for column_info in hive_table_schema["fields"]:
            column_name_and_type.append(
                "`{}` {}".format(
                    column_info["name"], convert_to_hive_type(column_info["type"])
                )
            )
        schema_definition = ", ".join(column_name_and_type)

        # Optional dependency
        import boto3  # pylint: disable=import-error

        s3 = boto3.client("s3")
        location = os.path.join("s3a://", bucket_path, upload_prefix, table_name)
        s3.upload_file(
            upload_path, bucket_path, os.path.join(upload_prefix, table_name, filename)
        )
        sql = f"""CREATE TABLE {full_table_name} ( {schema_definition} )
            ROW FORMAT DELIMITED FIELDS TERMINATED BY ',' STORED AS
            TEXTFILE LOCATION '{location}'
            tblproperties ('skip.header.line.count'='1')"""
        logging.info(form.con.data)
        engine = create_engine(form.con.data.sqlalchemy_uri_decrypted)
        engine.execute(sql)

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == "DATE":
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        elif tt == "TIMESTAMP":
            return f"""CAST('{dttm.isoformat(sep=" ", timespec="microseconds")}' AS TIMESTAMP)"""  # pylint: disable=line-too-long
        return None

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe="")
        return uri

    @classmethod
    def _extract_error_message(cls, e):
        msg = str(e)
        match = re.search(r'errorMessage="(.*?)(?<!\\)"', msg)
        if match:
            msg = match.group(1)
        return msg

    @classmethod
    def progress(cls, log_lines):
        total_jobs = 1  # assuming there's at least 1 job
        current_job = 1
        stages = {}
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
        logging.info(
            "Progress detail: {}, "  # pylint: disable=logging-format-interpolation
            "current job {}, "
            "total jobs: {}".format(stages, current_job, total_jobs)
        )

        stage_progress = sum(stages.values()) / len(stages.values()) if stages else 0

        progress = 100 * (current_job - 1) / total_jobs + stage_progress / total_jobs
        return int(progress)

    @classmethod
    def get_tracking_url(cls, log_lines):
        lkp = "Tracking URL = "
        for line in log_lines:
            if lkp in line:
                return line.split(lkp)[1]
            return None

    @classmethod
    def handle_cursor(cls, cursor, query, session):  # pylint: disable=too-many-locals
        """Updates progress information"""
        from pyhive import hive  # pylint: disable=no-name-in-module

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

            log = cursor.fetch_logs() or ""
            if log:
                log_lines = log.splitlines()
                progress = cls.progress(log_lines)
                logging.info(f"Query {query_id}: Progress total: {progress}")
                needs_commit = False
                if progress > query.progress:
                    query.progress = progress
                    needs_commit = True
                if not tracking_url:
                    tracking_url = cls.get_tracking_url(log_lines)
                    if tracking_url:
                        job_id = tracking_url.split("/")[-2]
                        logging.info(
                            f"Query {query_id}: Found the tracking url: {tracking_url}"
                        )
                        tracking_url = tracking_url_trans(tracking_url)
                        logging.info(
                            f"Query {query_id}: Transformation applied: {tracking_url}"
                        )
                        query.tracking_url = tracking_url
                        logging.info(f"Query {query_id}: Job id: {job_id}")
                        needs_commit = True
                if job_id and len(log_lines) > last_log_line:
                    # Wait for job id before logging things out
                    # this allows for prefixing all log lines and becoming
                    # searchable in something like Kibana
                    for l in log_lines[last_log_line:]:
                        logging.info(f"Query {query_id}: [{job_id}] {l}")
                    last_log_line = len(log_lines)
                if needs_commit:
                    session.commit()
            time.sleep(hive_poll_interval)
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
        database,
        query: Select,
        columns: Optional[List] = None,
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
    def _get_fields(cls, cols: List[dict]) -> List[ColumnClause]:
        return BaseEngineSpec._get_fields(cols)  # pylint: disable=protected-access

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database, **kwargs):
        # TODO(bogdan): implement`
        pass

    @classmethod
    def _latest_partition_from_df(cls, df) -> Optional[List[str]]:
        """Hive partitions look like ds={partition name}"""
        if not df.empty:
            return [df.ix[:, 0].max().split("=")[1]]
        return None

    @classmethod
    def _partition_query(  # pylint: disable=too-many-arguments
        cls, table_name, database, limit=0, order_by=None, filters=None
    ):
        return f"SHOW PARTITIONS {table_name}"

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments
        cls,
        database,
        table_name: str,
        engine: Engine,
        schema: str = None,
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
    def modify_url_for_impersonation(cls, url, impersonate_user: bool, username: str):
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        # Do nothing in the URL object since instead this should modify
        # the configuraiton dictionary. See get_configuration_for_impersonation
        pass

    @classmethod
    def get_configuration_for_impersonation(
        cls, uri: str, impersonate_user: bool, username: str
    ) -> Dict[str, str]:
        """
        Return a configuration dictionary that can be merged with other configs
        that can set the correct properties for impersonating users
        :param uri: URI string
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        :return: Configs required for impersonation
        """
        configuration = {}
        url = make_url(uri)
        backend_name = url.get_backend_name()

        # Must be Hive connection, enable impersonation, and set param
        # auth=LDAP|KERBEROS
        if (
            backend_name == "hive"
            and "auth" in url.query.keys()
            and impersonate_user is True
            and username is not None
        ):
            configuration["hive.server2.proxy.user"] = username
        return configuration

    @staticmethod
    def execute(  # type: ignore
        cursor, query: str, async_: bool = False
    ):  # pylint: disable=arguments-differ
        kwargs = {"async": async_}
        cursor.execute(query, **kwargs)
