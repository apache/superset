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

import base64
import hashlib
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from flask_appbuilder import Model
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

ISSUER = "https://superset.example.com"
RESOURCE = "https://superset.example.com/mcp"
CALLBACK = "https://claude.ai/api/mcp/auth_callback"
VERIFIER = "v" * 20 + "-verifier-" + "x" * 20


def s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


@pytest.fixture(scope="session")
def rsa_private_pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()


@pytest.fixture
def oauth_config(app: Any, mocker: MockerFixture, rsa_private_pem: str) -> Any:
    mocker.patch.dict(
        app.config,
        {
            "MCP_OAUTH_ENABLED": True,
            "MCP_OAUTH_ISSUER": ISSUER,
            "MCP_OAUTH_RESOURCES": [RESOURCE],
            "MCP_OAUTH_PRIVATE_KEY": rsa_private_pem,
            "MCP_OAUTH_SCOPES": ["mcp"],
            "MCP_OAUTH_ALLOWED_REDIRECT_URIS": None,
        },
    )
    return app.config


@pytest.fixture
def oauth_db(session: Session, oauth_config: Any) -> Session:
    Model.metadata.create_all(session.get_bind())
    return session


@pytest.fixture
def user(oauth_db: Session) -> Any:
    from superset import security_manager

    alice = security_manager.user_model(
        first_name="Alice",
        last_name="Doe",
        username="alice",
        email="alice@example.com",
        active=True,
    )
    oauth_db.add(alice)
    oauth_db.commit()
    return alice
