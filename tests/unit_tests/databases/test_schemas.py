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


def test_engine_information_schema_includes_supports_offset() -> None:
    """
    The frontend consumes EngineInformationSchema to know what the engine
    can do. supports_offset is a new field that must pass through.
    """
    from superset.databases.schemas import EngineInformationSchema

    schema = EngineInformationSchema()
    result = schema.dump(
        {
            "supports_file_upload": True,
            "disable_ssh_tunneling": False,
            "supports_dynamic_catalog": False,
            "supports_oauth2": False,
            "supports_offset": False,
        }
    )

    assert result["supports_offset"] is False


def test_engine_information_schema_includes_identifier_quote() -> None:
    """
    identifier_quote is a nested field that must pass the dialect-specific
    quote characters through unchanged.
    """
    from superset.databases.schemas import EngineInformationSchema

    schema = EngineInformationSchema()
    result = schema.dump(
        {
            "supports_file_upload": True,
            "disable_ssh_tunneling": False,
            "supports_dynamic_catalog": False,
            "supports_oauth2": False,
            "supports_offset": False,
            "identifier_quote": {"start": "`", "end": "`"},
        }
    )

    assert result["identifier_quote"] == {"start": "`", "end": "`"}


def test_engine_information_schema_includes_identifier_quote_escape_by_doubling() -> (
    None
):
    """
    escape_by_doubling tells the client whether an embedded closing-quote
    character is escaped by doubling it or with a backslash (e.g. BigQuery).
    """
    from superset.databases.schemas import EngineInformationSchema

    schema = EngineInformationSchema()
    result = schema.dump(
        {
            "supports_file_upload": True,
            "disable_ssh_tunneling": False,
            "supports_dynamic_catalog": False,
            "supports_oauth2": False,
            "supports_offset": False,
            "identifier_quote": {
                "start": "`",
                "end": "`",
                "escape_by_doubling": False,
            },
        }
    )

    assert result["identifier_quote"] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": False,
    }


def test_engine_information_schema_includes_encrypted_extra_sensitive_fields() -> None:
    """
    The sensitive field labels must pass through so the modal can render a
    field per stored secret.
    """
    from superset.databases.schemas import EngineInformationSchema

    labels = {
        "$.connect_args.jwt": "JWT Token",
        "$.oauth2_client_info.secret": "OAuth2 client secret",
    }
    result = EngineInformationSchema().dump(
        {"encrypted_extra_sensitive_fields": labels}
    )

    assert result["encrypted_extra_sensitive_fields"] == labels
