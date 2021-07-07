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
import urllib  # pylint: disable=unused-import
from contextlib import closing
from typing import Any, Dict, List, Optional, Pattern, Tuple, TYPE_CHECKING

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy.engine.url import make_url, URL
from typing_extensions import TypedDict

from superset import security_manager
from superset.databases.schemas import encrypted_field_properties, EncryptedField
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.errors import SupersetError, SupersetErrorType

if TYPE_CHECKING:
    from superset.models.core import Database


SYNTAX_ERROR_REGEX = re.compile('SQLError: near "(?P<server_error>.*?)": syntax error')

ma_plugin = MarshmallowPlugin()


class GSheetsParametersSchema(Schema):
    credentials_info = EncryptedField(
        required=False, description="Contents of Google Sheets JSON credentials.",
    )
    table_catalog = fields.Dict(required=False)


class GSheetsParametersType(TypedDict):
    credentials_info: Dict[str, Any]
    query: Dict[str, Any]


class GSheetsEngineSpec(SqliteEngineSpec):
    """Engine for Google spreadsheets"""

    engine = "gsheets"
    engine_name = "Google Sheets"
    allows_joins = True
    allows_subqueries = True

    parameters_schema = GSheetsParametersSchema()
    default_driver = "apsw"
    sqlalchemy_uri_placeholder = "gsheets://"

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        SYNTAX_ERROR_REGEX: (
            __(
                'Please check your query for syntax errors near "%(server_error)s". '
                "Then, try running your query again."
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @classmethod
    def modify_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> None:
        if impersonate_user and username is not None:
            user = security_manager.find_user(username=username)
            if user and user.email:
                url.query["subject"] = user.email

    @classmethod
    def extra_table_metadata(
        cls, database: "Database", table_name: str, schema_name: str,
    ) -> Dict[str, Any]:
        engine = cls.get_engine(database, schema=schema_name)
        with closing(engine.raw_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT GET_METADATA("{table_name}")')
            results = cursor.fetchone()[0]

        try:
            metadata = json.loads(results)
        except Exception:  # pylint: disable=broad-except
            metadata = {}

        return {"metadata": metadata["extra"]}

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: GSheetsParametersType,
        encrypted_extra: Optional[
            Dict[str, Any]
        ] = None,  # pylint: disable=unused-argument
    ) -> str:
        # All gsheets return just the engine in the format of the uri, the above are temporary for csi
        return "gsheets://"

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,
        encrypted_extra: Optional[
            Dict[str, str]
        ] = None,  # pylint: disable=unused-argument
    ) -> Any:
        # value = make_url(uri)

        # Building parameters from encrypted_extra and uri
        if encrypted_extra:
            return {**encrypted_extra}

        raise ValidationError("Invalid service credentials")

    @classmethod
    def validate_parameters(
        cls, parameters: GSheetsParametersType  # pylint: disable=unused-argument
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
