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

from __future__ import annotations

import logging
import re
from re import Pattern
from typing import Any, TYPE_CHECKING, TypedDict

import pandas as pd
from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask import g
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.exceptions import ValidationError
from requests import Session
from requests.exceptions import HTTPError
from shillelagh.adapters.api.gsheets.lib import SCOPES
from shillelagh.exceptions import UnauthenticatedError
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL

from superset import db, security_manager
from superset.databases.schemas import encrypted_field_properties, EncryptedString
from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.shillelagh import ShillelaghEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetException
from superset.superset_typing import OAuth2TokenResponse
from superset.utils import json
from superset.utils.oauth2 import get_oauth2_access_token

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import Table
    from superset.superset_typing import OAuth2ClientConfig, OAuth2State

_logger = logging.getLogger()

EXAMPLE_GSHEETS_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1LcWZMsdCl92g7nA-D6qGRqg1T5TiHyuKJUY1u9XAnsk/edit#gid=0"
)

SYNTAX_ERROR_REGEX = re.compile('SQLError: near "(?P<server_error>.*?)": syntax error')

ma_plugin = MarshmallowPlugin()


class GSheetsParametersSchema(Schema):
    catalog = fields.Dict()
    service_account_info = EncryptedString(
        required=False,
        metadata={
            "description": "Contents of GSheets JSON credentials.",
            "field_name": "service_account_info",
        },
    )
    oauth2_client_info = EncryptedString(
        required=False,
        metadata={
            "description": "OAuth2 client information",
            "default": {
                "scope": " ".join(SCOPES),
                "authorization_request_uri": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_request_uri": "https://oauth2.googleapis.com/token",
            },
        },
        allow_none=True,
    )


class GSheetsParametersType(TypedDict, total=False):
    service_account_info: str
    catalog: dict[str, str] | None
    oauth2_client_info: dict[str, str] | None


class GSheetsPropertiesType(TypedDict, total=False):
    parameters: GSheetsParametersType
    catalog: dict[str, str]
    masked_encrypted_extra: str


class GSheetsEngineSpec(ShillelaghEngineSpec):
    """Engine for Google spreadsheets"""

    engine_name = "Google Sheets"
    engine = "gsheets"
    allows_joins = True
    allows_subqueries = True

    parameters_schema = GSheetsParametersSchema()
    default_driver = "apsw"
    sqlalchemy_uri_placeholder = "gsheets://"

    metadata = {
        "description": (
            "Google Sheets allows querying spreadsheets as SQL tables via shillelagh."
        ),
        "logo": "google-sheets.svg",
        "homepage_url": "https://www.google.com/sheets/about/",
        "categories": [DatabaseCategory.CLOUD_GCP, DatabaseCategory.HOSTED_OPEN_SOURCE],
        "pypi_packages": ["shillelagh[gsheetsapi]"],
        "install_instructions": 'pip install "apache-superset[gsheets]"',
        "connection_string": "gsheets://",
        "notes": (
            "Requires Google service account credentials or OAuth2 authentication. "
            "See docs for setup instructions."
        ),
    }

    # when editing the database, mask this field in `encrypted_extra`
    # pylint: disable=invalid-name
    encrypted_extra_sensitive_fields = {
        "$.service_account_info.private_key",
        "$.oauth2_client_info.secret",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        SYNTAX_ERROR_REGEX: (
            __(
                'Please check your query for syntax errors near "%(server_error)s". '
                "Then, try running your query again.",
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    supports_file_upload = True

    # OAuth 2.0
    supports_oauth2 = True
    oauth2_scope = " ".join(SCOPES)
    oauth2_authorization_request_uri = (  # pylint: disable=invalid-name
        "https://accounts.google.com/o/oauth2/v2/auth"
    )
    oauth2_token_request_uri = "https://oauth2.googleapis.com/token"  # noqa: S105
    oauth2_exception = UnauthenticatedError

    @classmethod
    def get_oauth2_authorization_uri(
        cls,
        config: "OAuth2ClientConfig",
        state: "OAuth2State",
        code_verifier: str | None = None,
    ) -> str:
        """
        Return URI for initial OAuth2 request with Google-specific parameters.

        Google OAuth requires additional parameters for proper token refresh:
        - access_type=offline: Request a refresh token
        - include_granted_scopes=false: Don't include previously granted scopes
        - prompt=consent: Force consent screen to ensure refresh token is returned
        """
        from urllib.parse import urlencode, urljoin

        from superset.utils.oauth2 import encode_oauth2_state, generate_code_challenge

        uri = config["authorization_request_uri"]
        params: dict[str, str] = {
            "scope": config["scope"],
            "response_type": "code",
            "state": encode_oauth2_state(state),
            "redirect_uri": config["redirect_uri"],
            "client_id": config["id"],
            # Google-specific parameters
            "access_type": "offline",
            "include_granted_scopes": "false",
            "prompt": "consent",
        }

        # Add PKCE parameters (RFC 7636) if code_verifier is provided
        if code_verifier:
            params["code_challenge"] = generate_code_challenge(code_verifier)
            params["code_challenge_method"] = "S256"

        return urljoin(uri, "?" + urlencode(params))

    @classmethod
    def needs_oauth2(cls, ex: Exception) -> bool:
        """
        Check if the exception is one that indicates OAuth2 is needed.

        In case the token was manually revoked on Google side, `google-auth` will
        try to automatically refresh credentials, but it fails since it only has the
        access token. This override catches this scenario as well.

        Also catches the case where no credentials are configured at all
        (missing Application Default Credentials).
        """
        error_message = str(ex).lower()
        return (
            g
            and hasattr(g, "user")
            and (
                isinstance(ex, cls.oauth2_exception)
                or "credentials do not contain the necessary fields" in error_message
                or "default credentials were not found" in error_message
            )
        )

    @classmethod
    def get_oauth2_fresh_token(
        cls,
        config: OAuth2ClientConfig,
        refresh_token: str,
    ) -> OAuth2TokenResponse:
        """
        Refresh an OAuth2 access token that has expired.

        When trying to refresh an expired token that was revoked on Google side,
        the request fails with 400 status code.
        """
        try:
            return super().get_oauth2_fresh_token(config, refresh_token)
        except HTTPError as ex:
            if ex.response is not None and ex.response.status_code == 400:
                error_data = ex.response.json()
                if error_data.get("error") == "invalid_grant":
                    raise UnauthenticatedError(
                        error_data.get("error_description", "Token has been revoked")
                    ) from ex
            raise

    @classmethod
    def impersonate_user(
        cls,
        database: Database,
        username: str | None,
        user_token: str | None,
        url: URL,
        engine_kwargs: dict[str, Any],
    ) -> tuple[URL, dict[str, Any]]:
        if username is not None:
            user = security_manager.find_user(username=username)
            if user and user.email:
                url = url.update_query_dict({"subject": user.email})

        if user_token:
            url = url.update_query_dict({"access_token": user_token})

        return url, engine_kwargs

    @classmethod
    def get_table_names(
        cls,
        database: Database,
        inspector: Inspector,
        schema: str | None,
    ) -> set[str]:
        """
        Get all sheets added to the connection.

        For OAuth2 connections, force the OAuth2 dance in case the user
        doesn't have a token yet to avoid showing table names berofe auth.
        """
        if database.is_oauth2_enabled() and not get_oauth2_access_token(
            database.get_oauth2_config(),
            database.id,
            g.user.id,
            database.db_engine_spec,
        ):
            database.start_oauth2_dance()
        return super().get_table_names(database, inspector, schema)

    @classmethod
    def get_extra_table_metadata(
        cls,
        database: Database,
        table: Table,
    ) -> dict[str, Any]:
        with database.get_raw_connection(
            catalog=table.catalog,
            schema=table.schema,
        ) as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT GET_METADATA("{table.table}")')
            results = cursor.fetchone()[0]
        try:
            metadata = json.loads(results)
        except Exception:  # pylint: disable=broad-except
            metadata = {}

        return {"metadata": metadata["extra"]}

    @classmethod
    # pylint: disable=unused-argument
    def build_sqlalchemy_uri(
        cls,
        _: GSheetsParametersType,
        encrypted_extra: None | (dict[str, Any]) = None,
    ) -> str:
        if encrypted_extra and "oauth2_client_info" in encrypted_extra:
            del encrypted_extra["oauth2_client_info"]

        return "gsheets://"

    @staticmethod
    def update_params_from_encrypted_extra(
        database: Database,
        params: dict[str, Any],
    ) -> None:
        """
        Remove `oauth2_client_info` from `encrypted_extra`.
        """
        ShillelaghEngineSpec.update_params_from_encrypted_extra(database, params)

        if "oauth2_client_info" in params:
            del params["oauth2_client_info"]

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,  # pylint: disable=unused-argument
        encrypted_extra: dict[str, Any] | None = None,
    ) -> Any:
        # Building parameters from encrypted_extra and uri
        if encrypted_extra:
            return {**encrypted_extra}

        raise ValidationError("Invalid service credentials")

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
    ) -> list[SupersetError]:
        errors: list[SupersetError] = []

        # backwards compatible just incase people are send data
        # via parameters for validation
        parameters = properties.get("parameters", {})
        if parameters and parameters.get("catalog"):
            table_catalog = parameters.get("catalog") or {}
        else:
            table_catalog = properties.get("catalog") or {}

        encrypted_credentials = parameters.get("service_account_info") or "{}"

        # On create the encrypted credentials are a string,
        # at all other times they are a dict
        if isinstance(encrypted_credentials, str):
            encrypted_credentials = json.loads(encrypted_credentials)

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

        # Check for OAuth2 config. Skip URL access for OAuth2 connections (user
        # might not have a token, or admin adding a sheet they don't have access to)
        oauth2_config_in_params = parameters.get("oauth2_client_info")
        oauth2_config_in_secure_extra = json.loads(
            properties.get("masked_encrypted_extra", "{}")
        ).get("oauth2_client_info")
        is_oauth2_conn = bool(oauth2_config_in_params or oauth2_config_in_secure_extra)

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

            if is_oauth2_conn:
                continue

            try:
                url = url.replace('"', '""')
                results = conn.execute(f'SELECT * FROM "{url}" LIMIT 1')  # noqa: S608
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

    @staticmethod
    def _do_post(
        session: Session,  # pylint: disable=disallowed-name
        url: str,
        body: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        POST to the Google API.

        Helper function that handles logging and error handling.
        """
        _logger.info("POST %s", url)
        _logger.debug(body)
        response = session.post(
            url,
            json=body,
            **kwargs,
        )

        payload = response.json()
        _logger.debug(payload)

        if "error" in payload:
            raise SupersetException(payload["error"]["message"])

        return payload

    @classmethod
    def df_to_sql(  # pylint: disable=too-many-locals
        cls,
        database: Database,
        table: Table,
        df: pd.DataFrame,
        to_sql_kwargs: dict[str, Any],
    ) -> None:
        """
        Create a new sheet and update the DB catalog.

        Since Google Sheets is not a database, uploading a file is slightly different
        from other traditional databases. To create a table with a given name we first
        create a spreadsheet with the contents of the dataframe, and we later update the
        database catalog to add a mapping between the desired table name and the URL of
        the new sheet.

        If the table already exists and the user wants it replaced we clear all the
        cells in the existing sheet before uploading the new data. Appending to an
        existing table is not supported because we can't ensure that the schemas match.
        """
        # pylint: disable=import-outside-toplevel
        from shillelagh.backends.apsw.dialects.base import get_adapter_for_table_name

        # grab the existing catalog, if any
        extra = database.get_extra()
        engine_params = extra.setdefault("engine_params", {})
        catalog = engine_params.setdefault("catalog", {})

        # sanity checks
        spreadsheet_url = catalog.get(table.table)
        if spreadsheet_url and "if_exists" in to_sql_kwargs:
            if to_sql_kwargs["if_exists"] == "append":
                # no way we're going to append a dataframe to a spreadsheet, that's
                # never going to work
                raise SupersetException("Append operation not currently supported")
            if to_sql_kwargs["if_exists"] == "fail":
                raise SupersetException("Table already exists")
            if to_sql_kwargs["if_exists"] == "replace":
                pass

        # get the Google session from the Shillelagh adapter
        with cls.get_engine(
            database,
            catalog=table.catalog,
            schema=table.schema,
        ) as engine:
            with engine.connect() as conn:
                # any GSheets URL will work to get a working session
                adapter = get_adapter_for_table_name(
                    conn,
                    spreadsheet_url or EXAMPLE_GSHEETS_URL,
                )
                session = (  # pylint: disable=disallowed-name
                    adapter._get_session()  # pylint: disable=protected-access
                )

        # clear existing sheet, or create a new one
        if spreadsheet_url:
            spreadsheet_id = adapter._spreadsheet_id  # pylint: disable=protected-access
            range_ = adapter._sheet_name  # pylint: disable=protected-access
            url = (
                "https://sheets.googleapis.com/v4/spreadsheets/"
                f"{spreadsheet_id}/values/{range_}:clear"
            )
            cls._do_post(session, url, {})
        else:
            payload = cls._do_post(
                session,
                "https://sheets.googleapis.com/v4/spreadsheets",
                {"properties": {"title": table.table}},
            )
            spreadsheet_id = payload["spreadsheetId"]
            range_ = payload["sheets"][0]["properties"]["title"]
            spreadsheet_url = payload["spreadsheetUrl"]

        # insert data
        data = df.fillna("").values.tolist()
        data.insert(0, df.columns.values.tolist())
        body = {
            "range": range_,
            "majorDimension": "ROWS",
            "values": data,
        }
        url = (
            "https://sheets.googleapis.com/v4/spreadsheets/"
            f"{spreadsheet_id}/values/{range_}:append"
        )
        cls._do_post(
            session,
            url,
            body,
            params={"valueInputOption": "USER_ENTERED"},
        )

        # update catalog
        catalog[table.table] = spreadsheet_url
        database.extra = json.dumps(extra)
        db.session.add(database)
        db.session.commit()  # pylint: disable=consider-using-transaction
