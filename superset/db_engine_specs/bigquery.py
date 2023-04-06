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
import json
import re
import urllib
from datetime import datetime
from typing import Any, Dict, List, Optional, Pattern, Tuple, Type, TYPE_CHECKING

import pandas as pd
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy import column, types
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql import sqltypes
from typing_extensions import TypedDict

from superset import sql_parse
from superset.constants import PASSWORD_MASK
from superset.databases.schemas import encrypted_field_properties, EncryptedString
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicPropertiesType
from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
from superset.errors import SupersetError, SupersetErrorType
from superset.exceptions import SupersetException
from superset.sql_parse import Table
from superset.utils import core as utils
from superset.utils.hashing import md5_sha_from_str

try:
    from google.cloud import bigquery
    from google.oauth2 import service_account

    dependencies_installed = True
except ModuleNotFoundError:
    dependencies_installed = False

try:
    import pandas_gbq

    can_upload = True
except ModuleNotFoundError:
    can_upload = False

if TYPE_CHECKING:
    from superset.models.core import Database  # pragma: no cover


CONNECTION_DATABASE_PERMISSIONS_REGEX = re.compile(
    "Access Denied: Project (?P<project_name>.+?): User does not have "
    + "bigquery.jobs.create permission in project (?P<project>.+?)"
)

TABLE_DOES_NOT_EXIST_REGEX = re.compile(
    'Table name "(?P<table>.*?)" missing dataset while no default '
    "dataset is set in the request"
)

COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    r"Unrecognized name: (?P<column>.*?) at \[(?P<location>.+?)\]"
)

SCHEMA_DOES_NOT_EXIST_REGEX = re.compile(
    r"bigquery error: 404 Not found: Dataset (?P<dataset>.*?):"
    r"(?P<schema>.*?) was not found in location"
)

SYNTAX_ERROR_REGEX = re.compile(
    'Syntax error: Expected end of input but got identifier "(?P<syntax_error>.+?)"'
)

ma_plugin = MarshmallowPlugin()


class BigQueryParametersSchema(Schema):
    credentials_info = EncryptedString(
        required=False,
        description="Contents of BigQuery JSON credentials.",
    )
    query = fields.Dict(required=False)


class BigQueryParametersType(TypedDict):
    credentials_info: Dict[str, Any]
    query: Dict[str, Any]


class BigQueryEngineSpec(BaseEngineSpec):  # pylint: disable=too-many-public-methods
    """Engine spec for Google's BigQuery

    As contributed by @mxmzdlv on issue #945"""

    engine = "bigquery"
    engine_name = "Google BigQuery"
    max_column_name_length = 128
    disable_ssh_tunneling = True

    parameters_schema = BigQueryParametersSchema()
    default_driver = "bigquery"
    sqlalchemy_uri_placeholder = "bigquery://{project_id}"

    # BigQuery doesn't maintain context when running multiple statements in the
    # same cursor, so we need to run all statements at once
    run_multiple_statements_as_one = True

    allows_hidden_cc_in_orderby = True

    supports_catalog = True

    """
    https://www.python.org/dev/peps/pep-0249/#arraysize
    raw_connections bypass the sqlalchemy-bigquery query execution context and deal with
    raw dbapi connection directly.
    If this value is not set, the default value is set to 1, as described here,
    https://googlecloudplatform.github.io/google-cloud-python/latest/_modules/google/cloud/bigquery/dbapi/cursor.html#Cursor

    The default value of 5000 is derived from the sqlalchemy-bigquery.
    https://github.com/googleapis/python-bigquery-sqlalchemy/blob/4e17259088f89eac155adc19e0985278a29ecf9c/sqlalchemy_bigquery/base.py#L762
    """
    arraysize = 5000

    _date_trunc_functions = {
        "DATE": "DATE_TRUNC",
        "DATETIME": "DATETIME_TRUNC",
        "TIME": "TIME_TRUNC",
        "TIMESTAMP": "TIMESTAMP_TRUNC",
    }

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "CAST(TIMESTAMP_SECONDS("
        "UNIX_SECONDS(CAST({col} AS TIMESTAMP))"
        ") AS {type})",
        "PT1M": "CAST(TIMESTAMP_SECONDS("
        "60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 60)"
        ") AS {type})",
        "PT5M": "CAST(TIMESTAMP_SECONDS("
        "5*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 5*60)"
        ") AS {type})",
        "PT10M": "CAST(TIMESTAMP_SECONDS("
        "10*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 10*60)"
        ") AS {type})",
        "PT15M": "CAST(TIMESTAMP_SECONDS("
        "15*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 15*60)"
        ") AS {type})",
        "PT30M": "CAST(TIMESTAMP_SECONDS("
        "30*60 * DIV(UNIX_SECONDS(CAST({col} AS TIMESTAMP)), 30*60)"
        ") AS {type})",
        "PT1H": "{func}({col}, HOUR)",
        "P1D": "{func}({col}, DAY)",
        "P1W": "{func}({col}, WEEK)",
        "1969-12-29T00:00:00Z/P1W": "{func}({col}, ISOWEEK)",
        "P1M": "{func}({col}, MONTH)",
        "P3M": "{func}({col}, QUARTER)",
        "P1Y": "{func}({col}, YEAR)",
    }

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        CONNECTION_DATABASE_PERMISSIONS_REGEX: (
            __(
                "Unable to connect. Verify that the following roles are set "
                'on the service account: "BigQuery Data Viewer", '
                '"BigQuery Metadata Viewer", "BigQuery Job User" '
                "and the following permissions are set "
                '"bigquery.readsessions.create", '
                '"bigquery.readsessions.getData"'
            ),
            SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
            {},
        ),
        TABLE_DOES_NOT_EXIST_REGEX: (
            __(
                'The table "%(table)s" does not exist. '
                "A valid table must be used to run this query.",
            ),
            SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
            {},
        ),
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve column "%(column)s" at line %(location)s.'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SCHEMA_DOES_NOT_EXIST_REGEX: (
            __(
                'The schema "%(schema)s" does not exist. '
                "A valid schema must be used to run this query."
            ),
            SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SYNTAX_ERROR_REGEX: (
            __(
                "Please check your query for syntax errors at or near "
                '"%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)
        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS TIMESTAMP)"""
        if isinstance(sqla_type, types.DateTime):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        if isinstance(sqla_type, types.Time):
            return f"""CAST('{dttm.strftime("%H:%M:%S.%f")}' AS TIME)"""
        return None

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        data = super().fetch_data(cursor, limit)
        # Support type BigQuery Row, introduced here PR #4071
        # google.cloud.bigquery.table.Row
        if data and type(data[0]).__name__ == "Row":
            data = [r.values() for r in data]  # type: ignore
        return data

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        BigQuery field_name should start with a letter or underscore and contain only
        alphanumeric characters. Labels that start with a number are prefixed with an
        underscore. Any unsupported characters are replaced with underscores and an
        md5 hash is added to the end of the label to avoid possible collisions.

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        label_hashed = "_" + md5_sha_from_str(label)

        # if label starts with number, add underscore as first character
        label_mutated = "_" + label if re.match(r"^\d", label) else label

        # replace non-alphanumeric characters with underscores
        label_mutated = re.sub(r"[^\w]+", "_", label_mutated)
        if label_mutated != label:
            # add first 5 chars from md5 hash to label to avoid possible collisions
            label_mutated += label_hashed[:6]

        return label_mutated

    @classmethod
    def _truncate_label(cls, label: str) -> str:
        """BigQuery requires column names start with either a letter or
        underscore. To make sure this is always the case, an underscore is prefixed
        to the md5 hash of the original label.

        :param label: expected expression label
        :return: truncated label
        """
        return "_" + md5_sha_from_str(label)

    @classmethod
    def normalize_indexes(cls, indexes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalizes indexes for more consistency across db engines

        :param indexes: Raw indexes as returned by SQLAlchemy
        :return: cleaner, more aligned index definition
        """
        normalized_idxs = []
        # Fixing a bug/behavior observed in pybigquery==0.4.15 where
        # the index's `column_names` == [None]
        # Here we're returning only non-None indexes
        for ix in indexes:
            column_names = ix.get("column_names") or []
            ix["column_names"] = [col for col in column_names if col is not None]
            if ix["column_names"]:
                normalized_idxs.append(ix)
        return normalized_idxs

    @classmethod
    def extra_table_metadata(
        cls, database: "Database", table_name: str, schema_name: Optional[str]
    ) -> Dict[str, Any]:
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        partitions_columns = [
            index.get("column_names", [])
            for index in indexes
            if index.get("name") == "partition"
        ]
        cluster_columns = [
            index.get("column_names", [])
            for index in indexes
            if index.get("name") == "clustering"
        ]
        return {
            "partitions": {"cols": partitions_columns},
            "clustering": {"cols": cluster_columns},
        }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "TIMESTAMP_SECONDS({col})"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "TIMESTAMP_MILLIS({col})"

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

        Calls `pandas_gbq.DataFrame.to_gbq` which requires `pandas_gbq` to be installed.

        Note this method does not create metadata for the table.

        :param database: The database to upload the data to
        :param table: The table to upload the data to
        :param df: The dataframe with data to be uploaded
        :param to_sql_kwargs: The kwargs to be passed to pandas.DataFrame.to_sql` method
        """
        if not can_upload:
            raise SupersetException(
                "Could not import libraries needed to upload data to BigQuery."
            )

        if not table.schema:
            raise SupersetException("The table schema must be defined")

        to_gbq_kwargs = {}
        with cls.get_engine(database) as engine:
            to_gbq_kwargs = {
                "destination_table": str(table),
                "project_id": engine.url.host,
            }

        # Add credentials if they are set on the SQLAlchemy dialect.
        creds = engine.dialect.credentials_info

        if creds:
            to_gbq_kwargs[
                "credentials"
            ] = service_account.Credentials.from_service_account_info(creds)

        # Only pass through supported kwargs.
        supported_kwarg_keys = {"if_exists"}

        for key in supported_kwarg_keys:
            if key in to_sql_kwargs:
                to_gbq_kwargs[key] = to_sql_kwargs[key]

        pandas_gbq.to_gbq(df, **to_gbq_kwargs)

    @classmethod
    def _get_client(cls, engine: Engine) -> Any:
        """
        Return the BigQuery client associated with an engine.
        """
        if not dependencies_installed:
            raise SupersetException(
                "Could not import libraries needed to connect to BigQuery."
            )

        credentials = service_account.Credentials.from_service_account_info(
            engine.dialect.credentials_info
        )
        return bigquery.Client(credentials=credentials)

    @classmethod
    def estimate_query_cost(
        cls,
        database: "Database",
        schema: str,
        sql: str,
        source: Optional[utils.QuerySource] = None,
    ) -> List[Dict[str, Any]]:
        """
        Estimate the cost of a multiple statement SQL query.

        :param database: Database instance
        :param schema: Database schema
        :param sql: SQL query with possibly multiple statements
        :param source: Source of the query (eg, "sql_lab")
        """
        extra = database.get_extra() or {}
        if not cls.get_allow_cost_estimate(extra):
            raise SupersetException("Database does not support cost estimation")

        parsed_query = sql_parse.ParsedQuery(sql)
        statements = parsed_query.get_statements()
        costs = []
        for statement in statements:
            processed_statement = cls.process_statement(statement, database)

            costs.append(cls.estimate_statement_cost(processed_statement, database))
        return costs

    @classmethod
    def get_catalog_names(
        cls,
        database: "Database",
        inspector: Inspector,
    ) -> List[str]:
        """
        Get all catalogs.

        In BigQuery, a catalog is called a "project".
        """
        engine: Engine
        with database.get_sqla_engine_with_context() as engine:
            client = cls._get_client(engine)
            projects = client.list_projects()

        return sorted(project.project_id for project in projects)

    @classmethod
    def get_allow_cost_estimate(cls, extra: Dict[str, Any]) -> bool:
        return True

    @classmethod
    def estimate_statement_cost(cls, statement: str, cursor: Any) -> Dict[str, Any]:
        with cls.get_engine(cursor) as engine:
            client = cls._get_client(engine)
            job_config = bigquery.QueryJobConfig(dry_run=True)
            query_job = client.query(
                statement,
                job_config=job_config,
            )  # Make an API request.

        # Format Bytes.
        # TODO: Humanize in case more db engine specs need to be added,
        # this should be made a function outside this scope.
        byte_division = 1024
        if hasattr(query_job, "total_bytes_processed"):
            query_bytes_processed = query_job.total_bytes_processed
            if query_bytes_processed // byte_division == 0:
                byte_type = "B"
                total_bytes_processed = query_bytes_processed
            elif query_bytes_processed // (byte_division**2) == 0:
                byte_type = "KB"
                total_bytes_processed = round(query_bytes_processed / byte_division, 2)
            elif query_bytes_processed // (byte_division**3) == 0:
                byte_type = "MB"
                total_bytes_processed = round(
                    query_bytes_processed / (byte_division**2), 2
                )
            else:
                byte_type = "GB"
                total_bytes_processed = round(
                    query_bytes_processed / (byte_division**3), 2
                )

            return {f"{byte_type} Processed": total_bytes_processed}
        return {}

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        return [{k: str(v) for k, v in row.items()} for row in raw_cost]

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BigQueryParametersType,
        encrypted_extra: Optional[Dict[str, Any]] = None,
    ) -> str:
        query = parameters.get("query", {})
        query_params = urllib.parse.urlencode(query)

        if encrypted_extra:
            credentials_info = encrypted_extra.get("credentials_info")
            if isinstance(credentials_info, str):
                credentials_info = json.loads(credentials_info)
            project_id = credentials_info.get("project_id")
        if not encrypted_extra:
            raise ValidationError("Missing service credentials")

        if project_id:
            return f"{cls.default_driver}://{project_id}/?{query_params}"

        raise ValidationError("Invalid service credentials")

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,
        encrypted_extra: Optional[Dict[str, Any]] = None,
    ) -> Any:
        value = make_url_safe(uri)

        # Building parameters from encrypted_extra and uri
        if encrypted_extra:
            # ``value.query`` needs to be explicitly converted into a dict (from an
            # ``immutabledict``) so that it can be JSON serialized
            return {**encrypted_extra, "query": dict(value.query)}

        raise ValidationError("Invalid service credentials")

    @classmethod
    def mask_encrypted_extra(cls, encrypted_extra: Optional[str]) -> Optional[str]:
        if encrypted_extra is None:
            return encrypted_extra

        try:
            config = json.loads(encrypted_extra)
        except (json.JSONDecodeError, TypeError):
            return encrypted_extra

        try:
            config["credentials_info"]["private_key"] = PASSWORD_MASK
        except KeyError:
            pass

        return json.dumps(config)

    @classmethod
    def unmask_encrypted_extra(
        cls, old: Optional[str], new: Optional[str]
    ) -> Optional[str]:
        """
        Reuse ``private_key`` if available and unchanged.
        """
        if old is None or new is None:
            return new

        try:
            old_config = json.loads(old)
            new_config = json.loads(new)
        except (TypeError, json.JSONDecodeError):
            return new

        if "credentials_info" not in new_config:
            return new

        if "private_key" not in new_config["credentials_info"]:
            return new

        if new_config["credentials_info"]["private_key"] == PASSWORD_MASK:
            new_config["credentials_info"]["private_key"] = old_config[
                "credentials_info"
            ]["private_key"]

        return json.dumps(new_config)

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-outside-toplevel
        from google.auth.exceptions import DefaultCredentialsError

        return {DefaultCredentialsError: SupersetDBAPIConnectionError}

    @classmethod
    def validate_parameters(
        cls,
        properties: BasicPropertiesType,  # pylint: disable=unused-argument
    ) -> List[SupersetError]:
        return []

    @classmethod
    def parameters_json_schema(cls) -> Any:
        """
        Return configuration parameters as OpenAPI.
        """
        if not cls.parameters_schema:
            return None

        spec = APISpec(
            title="Database Parameters",
            version="1.0.0",
            openapi_version="3.0.0",
            plugins=[ma_plugin],
        )

        ma_plugin.init_spec(spec)
        ma_plugin.converter.add_attribute_function(encrypted_field_properties)
        spec.components.schema(cls.__name__, schema=cls.parameters_schema)
        return spec.to_dict()["components"]["schemas"][cls.__name__]

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
        """
        Remove array structures from `SELECT *`.

        BigQuery supports structures and arrays of structures, eg:

            author STRUCT<name STRING, email STRING>
            trailer ARRAY<STRUCT<key STRING, value STRING>>

        When loading metadata for a table each key in the struct is displayed as a
        separate pseudo-column, eg:

            - author
            - author.name
            - author.email
            - trailer
            - trailer.key
            - trailer.value

        When generating the `SELECT *` statement we want to remove any keys from
        structs inside an array, since selecting them results in an error. The correct
        select statement should look like this:

            SELECT
              `author`,
              `author`.`name`,
              `author`.`email`,
              `trailer`
            FROM
              table

        Selecting `trailer.key` or `trailer.value` results in an error, as opposed to
        selecting `author.name`, since they are keys in a structure inside an array.

        This method removes any array pseudo-columns.
        """
        if cols:
            # For arrays of structs, remove the child columns, otherwise the query
            # will fail.
            array_prefixes = {
                col["name"] for col in cols if isinstance(col["type"], sqltypes.ARRAY)
            }
            cols = [
                col
                for col in cols
                if "." not in col["name"]
                or col["name"].split(".")[0] not in array_prefixes
            ]

        return super().select_star(
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
    def _get_fields(cls, cols: List[Dict[str, Any]]) -> List[Any]:
        """
        Label columns using their fully qualified name.

        BigQuery supports columns of type `struct`, which are basically dictionaries.
        When loading metadata for a table with struct columns, each key in the struct
        is displayed as a separate pseudo-column, eg:

            author STRUCT<name STRING, email STRING>

        Will be shown as 3 columns:

            - author
            - author.name
            - author.email

        If we select those fields:

            SELECT `author`, `author`.`name`, `author`.`email` FROM table

        The resulting columns will be called "author", "name", and "email", This may
        result in a clash with other columns. To prevent that, we explicitly label
        the columns using their fully qualified name, so we end up with "author",
        "author__name" and "author__email", respectively.
        """
        return [column(c["name"]).label(c["name"].replace(".", "__")) for c in cols]

    @classmethod
    def parse_error_exception(cls, exception: Exception) -> Exception:
        try:
            return Exception(str(exception).splitlines()[0].strip())
        except Exception:  # pylint: disable=broad-except
            # If for some reason we get an exception, for example, no new line
            # We will return the original exception
            return exception
