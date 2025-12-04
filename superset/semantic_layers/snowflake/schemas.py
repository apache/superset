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

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator, SecretStr


class UserPasswordAuth(BaseModel):
    """
    Username and password authentication.
    """

    model_config = ConfigDict(title="Username and password")

    auth_type: Literal["user_password"] = "user_password"
    username: str = Field(description="The username to authenticate as.")
    password: SecretStr = Field(
        description="The password to authenticate with.",
        repr=False,
    )


class PrivateKeyAuth(BaseModel):
    """
    Private key authentication.
    """

    model_config = ConfigDict(title="Private key")

    auth_type: Literal["private_key"] = "private_key"
    private_key: SecretStr = Field(
        description="The private key to authenticate with, in PEM format.",
        repr=False,
    )
    private_key_password: SecretStr = Field(
        description="The password to decrypt the private key with.",
        repr=False,
    )


class SnowflakeConfiguration(BaseModel):
    """
    Parameters needed to connect to Snowflake.
    """

    # account is the only required parameter
    account_identifier: str = Field(
        description="The Snowflake account identifier.",
        json_schema_extra={"examples": ["abc12345"]},
    )

    role: str | None = Field(
        default=None,
        description="The default role to use.",
        json_schema_extra={"examples": ["myrole"]},
    )
    warehouse: str | None = Field(
        default=None,
        description="The default warehouse to use.",
        json_schema_extra={"examples": ["testwh"]},
    )

    auth: Union[UserPasswordAuth, PrivateKeyAuth] = Field(
        discriminator="auth_type",
        description="Authentication method",
    )

    # database and schema can be optionally provided; if not provided the user
    # will be able to browse databases/schemas
    database: str | None = Field(
        default=None,
        description="The default database to use.",
        json_schema_extra={
            "examples": ["testdb"],
            "x-dynamic": True,
            "x-dependsOn": ["account_identifier", "auth"],
        },
    )
    allow_changing_database: bool = Field(
        default=False,
        description="Allow changing the default database.",
    )
    schema_: str | None = Field(
        default=None,
        description="The default schema to use.",
        json_schema_extra={
            "examples": ["public"],
            "x-dynamic": True,
            "x-dependsOn": ["account_identifier", "auth", "database"],
        },
        # `schema` is an attribute of `BaseModel` so it needs to be aliased
        alias="schema",
    )
    allow_changing_schema: bool = Field(
        default=False,
        description="Allow changing the default schema.",
    )

    @model_validator(mode="after")
    def validate_database_schema_settings(self) -> SnowflakeConfiguration:
        """
        Validate that if database or schema is not specified, the corresponding
        allow_changing flag must be true.
        """
        if not self.database and not self.allow_changing_database:
            raise ValueError(
                "If no database is specified, allow_changing_database must be true"
            )
        if not self.schema_ and not self.allow_changing_schema:
            raise ValueError(
                "If no schema is specified, allow_changing_schema must be true"
            )
        return self
