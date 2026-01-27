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

# ruff: noqa: S608

from __future__ import annotations

from typing import Any, Sequence

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

from snowflake_semantic_layer.schemas import (
    PrivateKeyAuth,
    SnowflakeConfiguration,
    UserPasswordAuth,
)
from superset.exceptions import SupersetParseError
from superset.sql.parse import SQLStatement


def substitute_parameters(query: str, parameters: Sequence[Any] | None) -> str:
    """
    Substitute parametereters in templated query.

    This is used to convert bind query parameters so that we can return the executed
    query for logging/auditing purposes. With Snowflake the binding happens on the
    server, so the only way to get the true executed query would be to query the
    database, which is innefficient.
    """
    if not parameters:
        return query

    result = query
    for parameter in parameters:
        if parameter is None:
            replacement = "NULL"
        elif isinstance(parameter, bool):
            # Check bool before int/float since bool is a subclass of int
            replacement = str(parameter).upper()
        elif isinstance(parameter, (int, float)):
            replacement = str(parameter)
        else:
            # String - escape single quotes
            quoted = str(parameter).replace("'", "''")
            replacement = f"'{quoted}'"

        result = result.replace("?", replacement, 1)

    return result


def validate_order_by(definition: str) -> None:
    """
    Validate that an ORDER BY expression is safe to use.

    Note that `definition` could contain multiple expressions separated by commas.
    """
    try:
        # this ensures that we have a single statement, preventing SQL injection via a
        # semicolon in the order by clause
        SQLStatement(f"SELECT 1 ORDER BY {definition}", "snowflake")
    except SupersetParseError as ex:
        raise ValueError("Invalid ORDER BY expression") from ex


def get_connection_parameters(configuration: SnowflakeConfiguration) -> dict[str, Any]:
    """
    Convert the configuration to connection parameters for the Snowflake connector.
    """
    params = {
        "account": configuration.account_identifier,
        "application": "Apache Superset",
        "paramstyle": "qmark",
        "insecure_mode": True,
    }

    if configuration.role:
        params["role"] = configuration.role
    if configuration.warehouse:
        params["warehouse"] = configuration.warehouse
    if configuration.database:
        params["database"] = configuration.database
    if configuration.schema_:
        params["schema"] = configuration.schema_

    auth = configuration.auth
    if isinstance(auth, UserPasswordAuth):
        params["user"] = auth.username
        params["password"] = auth.password.get_secret_value()
    elif isinstance(auth, PrivateKeyAuth):
        pem_private_key = serialization.load_pem_private_key(
            auth.private_key.get_secret_value().encode(),
            password=(
                auth.private_key_password.get_secret_value().encode()
                if auth.private_key_password
                else None
            ),
            backend=default_backend(),
        )
        params["private_key"] = pem_private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    else:
        raise ValueError("Unsupported authentication method")

    return params
