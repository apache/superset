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

from collections.abc import Callable
from typing import Any, TYPE_CHECKING

from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.exc import NoSuchTableError

from superset.commands.database.exceptions import DatabaseInvalidError
from superset.constants import EMBEDDED_CREDENTIALS_KEY, PASSWORD_MASK
from superset.sql.parse import Table
from superset.utils import json

if TYPE_CHECKING:
    from superset.databases.schemas import (
        TableMetadataColumnsResponse,
        TableMetadataForeignKeysIndexesResponse,
        TableMetadataResponse,
    )
    from superset.db_engine_specs.base import BaseEngineSpec


def get_foreign_keys_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    foreign_keys = database.get_foreign_keys(table)
    for fk in foreign_keys:
        fk["column_names"] = fk.pop("constrained_columns")
        fk["type"] = "fk"
    return foreign_keys


def get_indexes_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    indexes = database.get_indexes(table)
    for idx in indexes:
        idx["type"] = "index"
    return indexes


def get_col_type(col: dict[Any, Any]) -> str:
    try:
        dtype = f"{col['type']}"
    except Exception:  # pylint: disable=broad-except
        # sqla.types.JSON __str__ has a bug, so using __class__.
        dtype = col["type"].__class__.__name__
    return dtype


def get_table_metadata(database: Any, table: Table) -> TableMetadataResponse:
    """
    Get table metadata information, including type, pk, fks.
    This function raises SQLAlchemyError when a schema is not found.

    :param database: The database model
    :param table: Table instance
    :return: Dict table metadata ready for API response
    """
    keys = []
    table_missing = False
    try:
        # get_columns is the table-existence check: SQLAlchemy 2.0's sqlite
        # dialect raises NoSuchTableError from reflection for a table that
        # doesn't exist - 1.4's sqlite dialect silently returned empty
        # results instead, which this API has always relied on to answer
        # with an empty-but-200 payload for sqlite specifically (other
        # backends' dialects already raised on missing tables pre-2.0, so
        # they're unaffected and still surface as the 422 below). Only
        # sqlite gets the graceful fallback, matching that pre-existing,
        # dialect-driven difference in behavior between backends. Only this
        # first call is guarded, so a NoSuchTableError raised later while
        # reflecting fks/indexes/comments for a table confirmed to exist
        # still propagates instead of being mistaken for a missing table.
        columns = database.get_columns(table)
    except NoSuchTableError:
        if database.backend != "sqlite":
            raise
        table_missing = True
        columns = []
    if not table_missing:
        primary_key = database.get_pk_constraint(table)
        foreign_keys = get_foreign_keys_metadata(database, table)
        indexes = get_indexes_metadata(database, table)
        table_comment = database.get_table_comment(table)
    else:
        primary_key = {"constrained_columns": None, "name": None}
        foreign_keys = []
        indexes = []
        table_comment = None
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"
        keys += [primary_key]
    keys += foreign_keys + indexes
    payload_columns: list[TableMetadataColumnsResponse] = []
    for col in columns:
        dtype = get_col_type(col)
        payload_columns.append(
            {
                "name": col["column_name"],
                "type": dtype.split("(")[0] if "(" in dtype else dtype,
                "longType": dtype,
                "keys": [k for k in keys if col["column_name"] in k["column_names"]],
                "comment": col.get("comment"),
            }
        )
    return {
        "name": table.table,
        "columns": payload_columns,
        "selectStar": database.select_star(
            table,
            show_cols=True if columns else False,
            indent=True,
            cols=columns,
            # A missing table has no partitions to look up, and asking
            # anyway would just re-trigger the same NoSuchTableError via
            # select_star()'s own internal database.get_columns() fallback
            # (it re-fetches columns itself whenever `cols` is empty and
            # either show_cols or latest_partition is set).
            latest_partition=not table_missing,
        ),
        "primaryKey": primary_key,
        "foreignKeys": foreign_keys,
        "indexes": keys,
        "comment": table_comment,
    }


def make_url_safe(raw_url: str | URL) -> URL:
    """
    Wrapper for SQLAlchemy's make_url(), which tends to raise too detailed of
    errors, which inevitably find their way into server logs. ArgumentErrors
    tend to contain usernames and passwords, which makes them non-log-friendly
    :param raw_url:
    :return:
    """

    if isinstance(raw_url, str):
        url = raw_url.strip()
        try:
            return make_url(url)  # noqa
        except Exception as ex:
            raise DatabaseInvalidError() from ex

    else:
        return raw_url


def _is_present(value: Any) -> bool:
    """Is a credential field actually filled in? Whitespace does not count."""
    if isinstance(value, str):
        return bool(value.strip())
    return bool(value)


def validated_embedded_credentials(credentials: Any) -> dict[str, str] | None:
    """
    Return a complete embedded fallback credential, or ``None``.

    The canonical shape is ``{username, password}`` or ``{username, auth_method:
    "keypair", privatekey_body, privatekey_pass}``; a half-filled credential is
    ignored rather than half-applied. Engines may override this default through
    ``BaseEngineSpec.validate_embedded_credentials`` for both query-time and
    authoring-time validation.
    """
    if not isinstance(credentials, dict):
        return None

    username = credentials.get("username")
    if not isinstance(username, str) or not _is_present(username):
        return None

    auth_method = credentials.get("auth_method", "password")
    if auth_method == "keypair":
        privatekey_body = credentials.get("privatekey_body")
        privatekey_pass = credentials.get("privatekey_pass", "")
        if (
            not isinstance(privatekey_body, str)
            or not privatekey_body
            or not isinstance(privatekey_pass, str)
        ):
            return None
        return {
            "username": username,
            "auth_method": "keypair",
            "privatekey_body": privatekey_body,
            "privatekey_pass": privatekey_pass,
        }

    password = credentials.get("password")
    if auth_method != "password" or not isinstance(password, str) or not password:
        return None
    return {"username": username, "password": password}


def embedded_credentials_present(value: Any) -> bool:
    """
    Does a stored or submitted value configure an embedded credential at all?

    Absent, empty and entirely blank values mean "no credential configured";
    ``auth_method`` alone does not count, since the dialog writes it as soon as the
    selector renders. Anything else counts, complete or not.
    """
    if value is None or value == "":
        return False
    if isinstance(value, dict):
        return any(
            _is_present(field) for key, field in value.items() if key != "auth_method"
        )
    return True


def embedded_credentials_incomplete(
    value: Any,
    validate_credentials: Callable[[Any], dict[str, str] | None],
) -> bool:
    """
    Is an embedded credential malformed or incomplete for its engine?

    Absent and entirely blank values pass -- they mean "no credential configured".
    Accepts the value as a dict or as the JSON string the connection dialog posts.
    Use the engine's query-time validator when the connection is known, keeping
    authoring checks consistent with engine-specific credential shapes.
    """
    if value is None or value == "":
        return False

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return True

    if value is None:
        return False
    if not isinstance(value, dict):
        return True

    # `auth_method` alone is not a credential -- the dialog writes it as soon as the
    # selector renders, so an untouched sub-form must not count as half-filled.
    if not any(
        _is_present(field) for key, field in value.items() if key != "auth_method"
    ):
        return False

    return validate_credentials(value) is None


def embedded_credentials_error(
    engine_spec: type[BaseEngineSpec],
    credentials: Any,
    stored_encrypted_extra: str | None,
) -> str | None:
    """
    Why an authored embedded credential cannot be used, or ``None``.

    Complements :func:`embedded_credentials_incomplete`, which only checks that the
    fields are filled in, by asking the engine whether their values work (see
    ``BaseEngineSpec.get_embedded_credentials_error``). An edit sends unchanged
    secrets masked, so they are first restored from ``stored_encrypted_extra``; a
    secret that is still masked has nothing to restore it from and is not checked.
    """
    if not isinstance(credentials, dict):
        return None
    unmasked = engine_spec.unmask_encrypted_extra(
        stored_encrypted_extra,
        json.dumps({EMBEDDED_CREDENTIALS_KEY: credentials}),
    )
    try:
        credentials = json.loads(unmasked or "{}").get(EMBEDDED_CREDENTIALS_KEY)
    except (AttributeError, json.JSONDecodeError):
        return None
    validated = engine_spec.validate_embedded_credentials(credentials)
    if validated is None or PASSWORD_MASK in validated.values():
        return None
    return engine_spec.get_embedded_credentials_error(validated)


def embedded_credentials_missing_fields(credentials: Any) -> list[str]:
    """
    Name the fields of the canonical credential shape that ``credentials`` lacks.

    Paths are JSONPath into Secure Extra (``$.embedded_credentials.<field>``), the
    form the import already uses to name a secret it needs. Returns an empty list
    when nothing canonical is missing, e.g. an unknown ``auth_method`` or a shape
    only an engine-specific validator rejects.
    """
    if not isinstance(credentials, dict):
        return []

    missing: list[str] = []
    if not _is_present(credentials.get("username")):
        missing.append("username")

    auth_method = credentials.get("auth_method", "password")
    if auth_method == "keypair":
        if not _is_present(credentials.get("privatekey_body")):
            missing.append("privatekey_body")
    elif auth_method == "password":
        if not _is_present(credentials.get("password")):
            missing.append("password")

    return [f"$.{EMBEDDED_CREDENTIALS_KEY}.{field}" for field in missing]
