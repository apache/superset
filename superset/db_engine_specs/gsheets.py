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
from contextlib import closing
from typing import Any, Dict, List, Optional, Pattern, Tuple, TYPE_CHECKING
from urllib.parse import urlencode

import jwt
import urllib3
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask import current_app, g, url_for
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.url import URL
from typing_extensions import TypedDict

from superset import security_manager
from superset.constants import PASSWORD_MASK
from superset.databases.schemas import encrypted_field_properties, EncryptedString
from superset.db_engine_specs.base import OAuth2State, OAuth2TokenResponse
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError

try:
    from shillelagh.adapters.api.gsheets.lib import SCOPES
    from shillelagh.exceptions import UnauthenticatedError
except ModuleNotFoundError:
    SCOPES = []
    UnauthenticatedError = OAuth2RedirectError

if TYPE_CHECKING:
    from superset.models.core import Database


SYNTAX_ERROR_REGEX = re.compile('SQLError: near "(?P<server_error>.*?)": syntax error')

ma_plugin = MarshmallowPlugin()
http = urllib3.PoolManager()


class GSheetsParametersSchema(Schema):
    catalog = fields.Dict()
    service_account_info = EncryptedString(
        required=False,
        description="Contents of GSheets JSON credentials.",
        field_name="service_account_info",
    )


class GSheetsParametersType(TypedDict):
    service_account_info: str
    catalog: Optional[Dict[str, str]]


class GSheetsPropertiesType(TypedDict):
    parameters: GSheetsParametersType
    catalog: Dict[str, str]


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
                "Then, try running your query again.",
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    supports_file_upload = False

    @classmethod
    def get_url_for_impersonation(
        cls,
        url: URL,
        impersonate_user: bool,
        username: Optional[str],
        access_token: Optional[str] = None,
    ) -> URL:
        if not impersonate_user:
            return url

        if username is not None:
            user = security_manager.find_user(username=username)
            if user and user.email:
                url = url.update_query_dict({"subject": user.email})

        if access_token:
            url = url.update_query_dict({"access_token": access_token})

        return url

    # exception raised by shillelagh that should trigger OAuth2
    oauth2_exception = UnauthenticatedError

    @classmethod
    def extra_table_metadata(
        cls,
        database: "Database",
        table_name: str,
        schema_name: Optional[str],
    ) -> Dict[str, Any]:
        with cls.get_engine(database, schema=schema_name) as engine:
            with closing(engine.raw_connection()) as conn:
                cursor = conn.cursor()
                cursor.execute(f'SELECT GET_METADATA("{table_name}")')
                results = cursor.fetchone()[0]

        try:
            metadata = json.loads(results)
        except Exception:  # pylint: disable=broad-except
            metadata = {}

        return {"metadata": metadata["extra"]}

    @staticmethod
    def is_oauth2_enabled() -> bool:
        """
        Return if OAuth2 is enabled for GSheets.
        """
        return (
            "GSHEETS_OAUTH2_CLIENT_ID" in current_app.config
            and "GSHEETS_OAUTH2_CLIENT_SECRET" in current_app.config
        )

    @staticmethod
    def get_oauth2_authorization_uri(database_id: int) -> str:
        """
        Return URI for initial OAuth2 request.

        https://developers.google.com/identity/protocols/oauth2/web-server#creatingclient
        """
        default_redirect_uri = url_for("DatabaseRestApi.oauth2", _external=True)
        redirect_uri = current_app.config.get(
            "GSHEETS_OAUTH2_REDIRECT_URI",
            default_redirect_uri,
        )

        # state to be passed back to Superset after authenticating so it can store the
        # OAuth2 token
        payload: OAuth2State = {
            "database_id": database_id,
            "user_id": g.user.id,
            # if the config has a custom redirect URI (eg, because Superset is behind a
            # proxy) we need the original redirect URI so that the request can be
            # forwarded
            "default_redirect_uri": default_redirect_uri,
        }

        # sign payload to prevent spoofing
        state = jwt.encode(
            payload=payload,
            key=current_app.config["SECRET_KEY"],
            algorithm="HS256",
        )
        # periods in the state break Google OAuth2 for some reason
        state = state.replace(".", "%2E")

        params = {
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "include_granted_scopes": "false",
            "response_type": "code",
            "state": state,
            "redirect_uri": redirect_uri,
            "client_id": current_app.config["GSHEETS_OAUTH2_CLIENT_ID"],
            "prompt": "consent",
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)

    @staticmethod
    def get_oauth2_token(code: str) -> OAuth2TokenResponse:
        """
        Exchange authorization code for refresh/access tokens.
        """
        redirect_uri = current_app.config.get(
            "GSHEETS_OAUTH2_REDIRECT_URI",
            url_for("DatabaseRestApi.oauth2", _external=True),
        )

        response = http.request(  # type: ignore
            "POST",
            "https://oauth2.googleapis.com/token",
            fields={
                "code": code,
                "client_id": current_app.config["GSHEETS_OAUTH2_CLIENT_ID"],
                "client_secret": current_app.config["GSHEETS_OAUTH2_CLIENT_SECRET"],
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        return json.loads(response.data.decode("utf-8"))

    @staticmethod
    def get_oauth2_fresh_token(refresh_token: str) -> OAuth2TokenResponse:
        """
        Refresh an access token that has expired.
        """
        response = http.request(  # type: ignore
            "POST",
            "https://oauth2.googleapis.com/token",
            fields={
                "client_id": current_app.config["GSHEETS_OAUTH2_CLIENT_ID"],
                "client_secret": current_app.config["GSHEETS_OAUTH2_CLIENT_SECRET"],
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        return json.loads(response.data.decode("utf-8"))

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        _: GSheetsParametersType,
        encrypted_extra: Optional[  # pylint: disable=unused-argument
            Dict[str, Any]
        ] = None,
    ) -> str:
        return "gsheets://"

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,  # pylint: disable=unused-argument
        encrypted_extra: Optional[Dict[str, Any]] = None,
    ) -> Any:
        # Building parameters from encrypted_extra and uri
        if encrypted_extra:
            return {**encrypted_extra}

        raise ValidationError("Invalid service credentials")

    @classmethod
    def mask_encrypted_extra(cls, encrypted_extra: Optional[str]) -> Optional[str]:
        if encrypted_extra is None:
            return encrypted_extra

        try:
            config = json.loads(encrypted_extra)
        except (TypeError, json.JSONDecodeError):
            return encrypted_extra

        try:
            config["service_account_info"]["private_key"] = PASSWORD_MASK
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

        if "service_account_info" not in new_config:
            return new

        if "private_key" not in new_config["service_account_info"]:
            return new

        if new_config["service_account_info"]["private_key"] == PASSWORD_MASK:
            new_config["service_account_info"]["private_key"] = old_config[
                "service_account_info"
            ]["private_key"]

        return json.dumps(new_config)

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
    def validate_parameters(
        cls,
        properties: GSheetsPropertiesType,
    ) -> List[SupersetError]:
        errors: List[SupersetError] = []

        # backwards compatible just incase people are send data
        # via parameters for validation
        parameters = properties.get("parameters", {})
        if parameters and parameters.get("catalog"):
            table_catalog = parameters.get("catalog", {})
        else:
            table_catalog = properties.get("catalog", {})

        encrypted_credentials = parameters.get("service_account_info") or "{}"

        # On create the encrypted credentials are a string,
        # at all other times they are a dict
        if isinstance(encrypted_credentials, str):
            encrypted_credentials = json.loads(encrypted_credentials)

        if not table_catalog:
            # Allowing users to submit empty catalogs
            errors.append(
                SupersetError(
                    message="Sheet name is required",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"catalog": {"idx": 0, "name": True}},
                ),
            )
            return errors

        # We need a subject in case domain wide delegation is set, otherwise the
        # check will fail. This means that the admin will be able to add sheets
        # that only they have access, even if later users are not able to access
        # them.
        subject = g.user.email if g.user else None

        engine = create_engine(
            "gsheets://",
            service_account_info=encrypted_credentials,
            subject=subject,
        )
        conn = engine.connect()
        idx = 0

        for name, url in table_catalog.items():

            if not name:
                errors.append(
                    SupersetError(
                        message="Sheet name is required",
                        error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                        level=ErrorLevel.WARNING,
                        extra={"catalog": {"idx": idx, "name": True}},
                    ),
                )
                return errors

            if not url:
                errors.append(
                    SupersetError(
                        message="URL is required",
                        error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                        level=ErrorLevel.WARNING,
                        extra={"catalog": {"idx": idx, "url": True}},
                    ),
                )
                return errors

            try:
                results = conn.execute(f'SELECT * FROM "{url}" LIMIT 1')
                results.fetchall()
            except Exception:  # pylint: disable=broad-except
                errors.append(
                    SupersetError(
                        message=(
                            "The URL could not be identified. Please check for typos "
                            "and make sure that ‘Type of Google Sheets allowed’ "
                            "selection matches the input."
                        ),
                        error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                        level=ErrorLevel.WARNING,
                        extra={"catalog": {"idx": idx, "url": True}},
                    ),
                )
            idx += 1
        return errors
