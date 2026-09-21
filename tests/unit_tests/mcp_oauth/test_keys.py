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

import pytest
from authlib.jose import JsonWebKey, jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from superset.mcp_oauth.keys import (
    load_signing_key,
    OAuthKeyConfigError,
    sign_access_token,
)


def test_sign_access_token_verifies_with_jwks(rsa_private_pem: str) -> None:
    key = load_signing_key({"MCP_OAUTH_PRIVATE_KEY": rsa_private_pem})
    token = sign_access_token(key, {"sub": "alice", "aud": "x"})

    assert "d" not in key.public_jwk
    assert key.public_jwk["kid"] == key.kid
    claims = jwt.decode(token, JsonWebKey.import_key(key.public_jwk))
    assert claims["sub"] == "alice"
    assert claims.header["typ"] == "at+jwt"
    assert claims.header["kid"] == key.kid


def test_load_signing_key_missing() -> None:
    with pytest.raises(OAuthKeyConfigError):
        load_signing_key({})


def test_load_signing_key_rejects_non_rsa() -> None:
    pem = (
        ec.generate_private_key(ec.SECP256R1())
        .private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        .decode()
    )
    with pytest.raises(OAuthKeyConfigError):
        load_signing_key({"MCP_OAUTH_PRIVATE_KEY": pem})
