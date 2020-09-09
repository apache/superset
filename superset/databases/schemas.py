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
import inspect
import json

from flask_babel import lazy_gettext as _
from marshmallow import fields, Schema
from marshmallow.validate import Length, ValidationError
from sqlalchemy import MetaData
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError

from superset import app
from superset.exceptions import CertificateException
from superset.utils.core import markdown, parse_ssl_cert

database_schemas_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}

database_name_description = "A database name to identify this connection."
cache_timeout_description = (
    "Duration (in seconds) of the caching timeout for charts of this database. "
    "A timeout of 0 indicates that the cache never expires. "
    "Note this defaults to the global timeout if undefined."
)
expose_in_sqllab_description = "Expose this database to SQLLab"
allow_run_async_description = (
    "Operate the database in asynchronous mode, meaning  "
    "that the queries are executed on remote workers as opposed "
    "to on the web server itself. "
    "This assumes that you have a Celery worker setup as well "
    "as a results backend. Refer to the installation docs "
    "for more information."
)
allow_csv_upload_description = (
    "Allow to upload CSV file data into this database"
    "If selected, please set the schemas allowed for csv upload in Extra."
)
allow_ctas_description = "Allow CREATE TABLE AS option in SQL Lab"
allow_cvas_description = "Allow CREATE VIEW AS option in SQL Lab"
allow_dml_description = (
    "Allow users to run non-SELECT statements "
    "(UPDATE, DELETE, CREATE, ...) "
    "in SQL Lab"
)
allow_multi_schema_metadata_fetch_description = (
    "Allow SQL Lab to fetch a list of all tables and all views across "
    "all database schemas. For large data warehouse with thousands of "
    "tables, this can be expensive and put strain on the system."
)  # pylint: disable=invalid-name
impersonate_user_description = (
    "If Presto, all the queries in SQL Lab are going to be executed as the "
    "currently logged on user who must have permission to run them.<br/>"
    "If Hive and hive.server2.enable.doAs is enabled, will run the queries as "
    "service account, but impersonate the currently logged on user "
    "via hive.server2.proxy.user property."
)
force_ctas_schema_description = (
    "When allowing CREATE TABLE AS option in SQL Lab, "
    "this option forces the table to be created in this schema"
)
encrypted_extra_description = markdown(
    "JSON string containing additional connection configuration.<br/>"
    "This is used to provide connection information for systems like "
    "Hive, Presto, and BigQuery, which do not conform to the username:password "
    "syntax normally used by SQLAlchemy.",
    True,
)
extra_description = markdown(
    "JSON string containing extra configuration elements.<br/>"
    "1. The ``engine_params`` object gets unpacked into the "
    "[sqlalchemy.create_engine]"
    "(https://docs.sqlalchemy.org/en/latest/core/engines.html#"
    "sqlalchemy.create_engine) call, while the ``metadata_params`` "
    "gets unpacked into the [sqlalchemy.MetaData]"
    "(https://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html"
    "#sqlalchemy.schema.MetaData) call.<br/>"
    "2. The ``metadata_cache_timeout`` is a cache timeout setting "
    "in seconds for metadata fetch of this database. Specify it as "
    '**"metadata_cache_timeout": {"schema_cache_timeout": 600, '
    '"table_cache_timeout": 600}**. '
    "If unset, cache will not be enabled for the functionality. "
    "A timeout of 0 indicates that the cache never expires.<br/>"
    "3. The ``schemas_allowed_for_csv_upload`` is a comma separated list "
    "of schemas that CSVs are allowed to upload to. "
    'Specify it as **"schemas_allowed_for_csv_upload": '
    '["public", "csv_upload"]**. '
    "If database flavor does not support schema or any schema is allowed "
    "to be accessed, just leave the list empty<br/>"
    "4. the ``version`` field is a string specifying the this db's version. "
    "This should be used with Presto DBs so that the syntax is correct<br/>"
    "5. The ``allows_virtual_table_explore`` field is a boolean specifying "
    "whether or not the Explore button in SQL Lab results is shown.",
    True,
)
sqlalchemy_uri_description = markdown(
    "Refer to the "
    "[SqlAlchemy docs]"
    "(https://docs.sqlalchemy.org/en/rel_1_2/core/engines.html#"
    "database-urls) "
    "for more information on how to structure your URI.",
    True,
)
server_cert_description = markdown(
    "Optional CA_BUNDLE contents to validate HTTPS requests. Only available "
    "on certain database engines.",
    True,
)


def sqlalchemy_uri_validator(value: str) -> str:
    """
    Validate if it's a valid SQLAlchemy URI and refuse SQLLite by default
    """
    try:
        make_url(value.strip())
    except (ArgumentError, AttributeError):
        raise ValidationError(
            [
                _(
                    "Invalid connection string, a valid string usually follows:"
                    "'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                    "<p>"
                    "Example:'postgresql://user:password@your-postgres-db/database'"
                    "</p>"
                )
            ]
        )
    if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] and value:
        if value.startswith("sqlite"):
            raise ValidationError(
                [
                    _(
                        "SQLite database cannot be used as a data source for "
                        "security reasons."
                    )
                ]
            )

    return value


def server_cert_validator(value: str) -> str:
    """
    Validate the server certificate
    """
    if value:
        try:
            parse_ssl_cert(value)
        except CertificateException:
            raise ValidationError([_("Invalid certificate")])
    return value


def encrypted_extra_validator(value: str) -> str:
    """
    Validate that encrypted extra is a valid JSON string
    """
    if value:
        try:
            json.loads(value)
        except json.JSONDecodeError as ex:
            raise ValidationError(
                [_("Field cannot be decoded by JSON. %(msg)s", msg=str(ex))]
            )
    return value


def extra_validator(value: str) -> str:
    """
    Validate that extra is a valid JSON string, and that metadata_params
    keys are on the call signature for SQLAlchemy Metadata
    """
    if value:
        try:
            extra_ = json.loads(value)
        except json.JSONDecodeError as ex:
            raise ValidationError(
                [_("Field cannot be decoded by JSON. %(msg)s", msg=str(ex))]
            )
        else:
            metadata_signature = inspect.signature(MetaData)
            for key in extra_.get("metadata_params", {}):
                if key not in metadata_signature.parameters:
                    raise ValidationError(
                        [
                            _(
                                "The metadata_params in Extra field "
                                "is not configured correctly. The key "
                                "%(key)s is invalid.",
                                key=key,
                            )
                        ]
                    )
    return value


class DatabasePostSchema(Schema):
    database_name = fields.String(
        description=database_name_description, required=True, validate=Length(1, 250),
    )
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    expose_in_sqllab = fields.Boolean(description=expose_in_sqllab_description)
    allow_run_async = fields.Boolean(description=allow_run_async_description)
    allow_csv_upload = fields.Boolean(description=allow_csv_upload_description)
    allow_ctas = fields.Boolean(description=allow_ctas_description)
    allow_cvas = fields.Boolean(description=allow_cvas_description)
    allow_dml = fields.Boolean(description=allow_dml_description)
    force_ctas_schema = fields.String(
        description=force_ctas_schema_description,
        allow_none=True,
        validate=Length(0, 250),
    )
    allow_multi_schema_metadata_fetch = fields.Boolean(
        description=allow_multi_schema_metadata_fetch_description,
    )
    impersonate_user = fields.Boolean(description=impersonate_user_description)
    encrypted_extra = fields.String(
        description=encrypted_extra_description,
        validate=encrypted_extra_validator,
        allow_none=True,
    )
    extra = fields.String(description=extra_description, validate=extra_validator)
    server_cert = fields.String(
        description=server_cert_description,
        allow_none=True,
        validate=server_cert_validator,
    )
    sqlalchemy_uri = fields.String(
        description=sqlalchemy_uri_description,
        required=True,
        validate=[Length(1, 1024), sqlalchemy_uri_validator],
    )


class DatabasePutSchema(Schema):
    database_name = fields.String(
        description=database_name_description, allow_none=True, validate=Length(1, 250),
    )
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    expose_in_sqllab = fields.Boolean(description=expose_in_sqllab_description)
    allow_run_async = fields.Boolean(description=allow_run_async_description)
    allow_csv_upload = fields.Boolean(description=allow_csv_upload_description)
    allow_ctas = fields.Boolean(description=allow_ctas_description)
    allow_cvas = fields.Boolean(description=allow_cvas_description)
    allow_dml = fields.Boolean(description=allow_dml_description)
    force_ctas_schema = fields.String(
        description=force_ctas_schema_description,
        allow_none=True,
        validate=Length(0, 250),
    )
    allow_multi_schema_metadata_fetch = fields.Boolean(
        description=allow_multi_schema_metadata_fetch_description
    )
    impersonate_user = fields.Boolean(description=impersonate_user_description)
    encrypted_extra = fields.String(
        description=encrypted_extra_description,
        allow_none=True,
        validate=encrypted_extra_validator,
    )
    extra = fields.String(description=extra_description, validate=extra_validator)
    server_cert = fields.String(
        description=server_cert_description,
        allow_none=True,
        validate=server_cert_validator,
    )
    sqlalchemy_uri = fields.String(
        description=sqlalchemy_uri_description,
        allow_none=True,
        validate=[Length(0, 1024), sqlalchemy_uri_validator],
    )


class TableMetadataOptionsResponseSchema(Schema):
    deferrable = fields.Bool()
    initially = fields.Bool()
    match = fields.Bool()
    ondelete = fields.Bool()
    onupdate = fields.Bool()


class TableMetadataColumnsResponseSchema(Schema):
    keys = fields.List(fields.String(), description="")
    longType = fields.String(description="The actual backend long type for the column")
    name = fields.String(description="The column name")
    type = fields.String(description="The column type")
    duplicates_constraint = fields.String(required=False)


class TableMetadataForeignKeysIndexesResponseSchema(Schema):
    column_names = fields.List(
        fields.String(
            description="A list of column names that compose the foreign key or index"
        )
    )
    name = fields.String(description="The name of the foreign key or index")
    options = fields.Nested(TableMetadataOptionsResponseSchema)
    referred_columns = fields.List(fields.String())
    referred_schema = fields.String()
    referred_table = fields.String()
    type = fields.String()


class TableMetadataPrimaryKeyResponseSchema(Schema):
    column_names = fields.List(
        fields.String(description="A list of column names that compose the primary key")
    )
    name = fields.String(description="The primary key index name")
    type = fields.String()


class TableMetadataResponseSchema(Schema):
    name = fields.String(description="The name of the table")
    columns = fields.List(
        fields.Nested(TableMetadataColumnsResponseSchema),
        description="A list of columns and their metadata",
    )
    foreignKeys = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of foreign keys and their metadata",
    )
    indexes = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of indexes and their metadata",
    )
    primaryKey = fields.Nested(
        TableMetadataPrimaryKeyResponseSchema, description="Primary keys metadata"
    )
    selectStar = fields.String(description="SQL select star")


class SelectStarResponseSchema(Schema):
    result = fields.String(description="SQL select star")


class SchemasResponseSchema(Schema):
    result = fields.List(fields.String(description="A database schema name"))


class DatabaseRelatedChart(Schema):
    id = fields.Integer()
    slice_name = fields.String()
    viz_type = fields.String()


class DatabaseRelatedDashboard(Schema):
    id = fields.Integer()
    json_metadata = fields.Dict()
    slug = fields.String()
    title = fields.String()


class DatabaseRelatedCharts(Schema):
    count = fields.Integer(description="Chart count")
    result = fields.List(
        fields.Nested(DatabaseRelatedChart), description="A list of dashboards"
    )


class DatabaseRelatedDashboards(Schema):
    count = fields.Integer(description="Dashboard count")
    result = fields.List(
        fields.Nested(DatabaseRelatedDashboard), description="A list of dashboards"
    )


class DatabaseRelatedObjectsResponse(Schema):
    charts = fields.Nested(DatabaseRelatedCharts)
    dashboards = fields.Nested(DatabaseRelatedDashboards)
