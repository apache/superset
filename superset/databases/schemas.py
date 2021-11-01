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
from typing import Any, Dict, Optional, Type

from flask import current_app
from flask_babel import lazy_gettext as _
from marshmallow import EXCLUDE, fields, pre_load, Schema, validates_schema
from marshmallow.validate import Length, ValidationError
from marshmallow_enum import EnumField
from sqlalchemy import MetaData
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError

from superset.db_engine_specs import BaseEngineSpec, get_engine_specs
from superset.exceptions import CertificateException, SupersetSecurityException
from superset.models.core import ConfigurationMethod, PASSWORD_MASK
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from superset.utils.core import markdown, parse_ssl_cert

database_schemas_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}

database_name_description = "A database name to identify this connection."
port_description = "Port number for the database connection."
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
allow_file_upload_description = (
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
configuration_method_description = (
    "Configuration_method is used on the frontend to "
    "inform the backend whether to explode parameters "
    "or to provide only a sqlalchemy_uri."
)
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
    "3. The ``schemas_allowed_for_file_upload`` is a comma separated list "
    "of schemas that CSVs are allowed to upload to. "
    'Specify it as **"schemas_allowed_for_file_upload": '
    '["public", "csv_upload"]**. '
    "If database flavor does not support schema or any schema is allowed "
    "to be accessed, just leave the list empty<br/>"
    "4. the ``version`` field is a string specifying the this db's version. "
    "This should be used with Presto DBs so that the syntax is correct<br/>"
    "5. The ``allows_virtual_table_explore`` field is a boolean specifying "
    "whether or not the Explore button in SQL Lab results is shown.",
    True,
)
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}
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
        uri = make_url(value.strip())
    except (ArgumentError, AttributeError, ValueError) as ex:
        raise ValidationError(
            [
                _(
                    "Invalid connection string, a valid string usually follows: "
                    "driver://user:password@database-host/database-name"
                )
            ]
        ) from ex
    if current_app.config.get("PREVENT_UNSAFE_DB_CONNECTIONS", True):
        try:
            check_sqlalchemy_uri(uri)
        except SupersetSecurityException as ex:
            raise ValidationError([str(ex)]) from ex
    return value


def server_cert_validator(value: str) -> str:
    """
    Validate the server certificate
    """
    if value:
        try:
            parse_ssl_cert(value)
        except CertificateException as ex:
            raise ValidationError([_("Invalid certificate")]) from ex
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
            ) from ex
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
            ) from ex
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


class DatabaseParametersSchemaMixin:  # pylint: disable=too-few-public-methods
    """
    Allow SQLAlchemy URI to be passed as separate parameters.

    This mixin is a first step in allowing the users to test, create and
    edit databases without having to know how to write a SQLAlchemy URI.
    Instead, each database defines the parameters that it takes (eg,
    username, password, host, etc.) and the SQLAlchemy URI is built from
    these parameters.

    When using this mixin make sure that `sqlalchemy_uri` is not required.
    """

    engine = fields.String(allow_none=True, description="SQLAlchemy engine to use")
    parameters = fields.Dict(
        keys=fields.String(),
        values=fields.Raw(),
        description="DB-specific parameters for configuration",
    )
    configuration_method = EnumField(
        ConfigurationMethod,
        by_value=True,
        description=configuration_method_description,
        missing=ConfigurationMethod.SQLALCHEMY_FORM,
    )

    # pylint: disable=no-self-use, unused-argument
    @pre_load
    def build_sqlalchemy_uri(
        self, data: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Build SQLAlchemy URI from separate parameters.

        This is used for databases that support being configured by individual
        parameters (eg, username, password, host, etc.), instead of requiring
        the constructed SQLAlchemy URI to be passed.
        """
        parameters = data.pop("parameters", {})
        # TODO(AAfghahi) standardize engine.
        engine = (
            data.pop("engine", None)
            or parameters.pop("engine", None)
            or data.pop("backend", None)
        )

        configuration_method = data.get("configuration_method")
        if configuration_method == ConfigurationMethod.DYNAMIC_FORM:
            engine_spec = get_engine_spec(engine)

            if not hasattr(engine_spec, "build_sqlalchemy_uri") or not hasattr(
                engine_spec, "parameters_schema"
            ):
                raise ValidationError(
                    [
                        _(
                            'Engine spec "InvalidEngine" does not support '
                            "being configured via individual parameters."
                        )
                    ]
                )

            # validate parameters
            parameters = engine_spec.parameters_schema.load(parameters)  # type: ignore

            serialized_encrypted_extra = data.get("encrypted_extra") or "{}"
            try:
                encrypted_extra = json.loads(serialized_encrypted_extra)
            except json.decoder.JSONDecodeError:
                encrypted_extra = {}

            data["sqlalchemy_uri"] = engine_spec.build_sqlalchemy_uri(  # type: ignore
                parameters, encrypted_extra
            )

        return data


def get_engine_spec(engine: Optional[str]) -> Type[BaseEngineSpec]:
    if not engine:
        raise ValidationError(
            [
                _(
                    "An engine must be specified when passing "
                    "individual parameters to a database."
                )
            ]
        )
    engine_specs = get_engine_specs()
    if engine not in engine_specs:
        raise ValidationError(
            [_('Engine "%(engine)s" is not a valid engine.', engine=engine,)]
        )
    return engine_specs[engine]


class DatabaseValidateParametersSchema(Schema):
    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

    engine = fields.String(required=True, description="SQLAlchemy engine to use")
    parameters = fields.Dict(
        keys=fields.String(),
        values=fields.Raw(allow_none=True),
        description="DB-specific parameters for configuration",
    )
    database_name = fields.String(
        description=database_name_description, allow_none=True, validate=Length(1, 250),
    )
    impersonate_user = fields.Boolean(description=impersonate_user_description)
    extra = fields.String(description=extra_description, validate=extra_validator)
    encrypted_extra = fields.String(
        description=encrypted_extra_description,
        validate=encrypted_extra_validator,
        allow_none=True,
    )
    server_cert = fields.String(
        description=server_cert_description,
        allow_none=True,
        validate=server_cert_validator,
    )
    configuration_method = EnumField(
        ConfigurationMethod,
        by_value=True,
        required=True,
        description=configuration_method_description,
    )


class DatabasePostSchema(Schema, DatabaseParametersSchemaMixin):
    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

    database_name = fields.String(
        description=database_name_description, required=True, validate=Length(1, 250),
    )
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    expose_in_sqllab = fields.Boolean(description=expose_in_sqllab_description)
    allow_run_async = fields.Boolean(description=allow_run_async_description)
    allow_file_upload = fields.Boolean(description=allow_file_upload_description)
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
        validate=[Length(1, 1024), sqlalchemy_uri_validator],
    )


class DatabasePutSchema(Schema, DatabaseParametersSchemaMixin):
    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

    database_name = fields.String(
        description=database_name_description, allow_none=True, validate=Length(1, 250),
    )
    cache_timeout = fields.Integer(
        description=cache_timeout_description, allow_none=True
    )
    expose_in_sqllab = fields.Boolean(description=expose_in_sqllab_description)
    allow_run_async = fields.Boolean(description=allow_run_async_description)
    allow_file_upload = fields.Boolean(description=allow_file_upload_description)
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
        validate=[Length(0, 1024), sqlalchemy_uri_validator],
    )


class DatabaseTestConnectionSchema(Schema, DatabaseParametersSchemaMixin):
    database_name = fields.String(
        description=database_name_description, allow_none=True, validate=Length(1, 250),
    )
    impersonate_user = fields.Boolean(description=impersonate_user_description)
    extra = fields.String(description=extra_description, validate=extra_validator)
    encrypted_extra = fields.String(
        description=encrypted_extra_description,
        validate=encrypted_extra_validator,
        allow_none=True,
    )
    server_cert = fields.String(
        description=server_cert_description,
        allow_none=True,
        validate=server_cert_validator,
    )
    sqlalchemy_uri = fields.String(
        description=sqlalchemy_uri_description,
        validate=[Length(1, 1024), sqlalchemy_uri_validator],
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


class DatabaseFunctionNamesResponse(Schema):
    function_names = fields.List(fields.String())


class ImportV1DatabaseExtraSchema(Schema):
    # pylint: disable=no-self-use, unused-argument
    @pre_load
    def fix_schemas_allowed_for_csv_upload(
        self, data: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Fix ``schemas_allowed_for_file_upload`` being a string.

        Due to a bug in the database modal, some databases might have been
        saved and exported with a string for ``schemas_allowed_for_file_upload``.
        """
        schemas_allowed_for_file_upload = data.get("schemas_allowed_for_file_upload")
        if isinstance(schemas_allowed_for_file_upload, str):
            data["schemas_allowed_for_file_upload"] = json.loads(
                schemas_allowed_for_file_upload
            )

        return data

    metadata_params = fields.Dict(keys=fields.Str(), values=fields.Raw())
    engine_params = fields.Dict(keys=fields.Str(), values=fields.Raw())
    metadata_cache_timeout = fields.Dict(keys=fields.Str(), values=fields.Integer())
    schemas_allowed_for_file_upload = fields.List(fields.String())
    cost_estimate_enabled = fields.Boolean()


class ImportV1DatabaseSchema(Schema):
    database_name = fields.String(required=True)
    sqlalchemy_uri = fields.String(required=True)
    password = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    expose_in_sqllab = fields.Boolean()
    allow_run_async = fields.Boolean()
    allow_ctas = fields.Boolean()
    allow_cvas = fields.Boolean()
    allow_file_upload = fields.Boolean()
    extra = fields.Nested(ImportV1DatabaseExtraSchema)
    uuid = fields.UUID(required=True)
    version = fields.String(required=True)

    # pylint: disable=no-self-use, unused-argument
    @validates_schema
    def validate_password(self, data: Dict[str, Any], **kwargs: Any) -> None:
        """If sqlalchemy_uri has a masked password, password is required"""
        uri = data["sqlalchemy_uri"]
        password = make_url(uri).password
        if password == PASSWORD_MASK and data.get("password") is None:
            raise ValidationError("Must provide a password for the database")


class EncryptedField:  # pylint: disable=too-few-public-methods
    """
    A database field that should be stored in encrypted_extra.
    """


class EncryptedString(EncryptedField, fields.String):
    pass


class EncryptedDict(EncryptedField, fields.Dict):
    pass


def encrypted_field_properties(self, field: Any, **_) -> Dict[str, Any]:  # type: ignore
    ret = {}
    if isinstance(field, EncryptedField):
        if self.openapi_version.major > 2:
            ret["x-encrypted-extra"] = True
    return ret
