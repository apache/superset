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
"""RS256 signing key for MCP OAuth access tokens, and its public forms."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from authlib.jose import JsonWebKey, jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

ACCESS_TOKEN_ALGORITHM = "RS256"  # noqa: S105


class OAuthKeyConfigError(ValueError):
    """``MCP_OAUTH_PRIVATE_KEY`` is missing or not an RSA private key."""


@dataclass(frozen=True)
class SigningKey:
    """A loaded signing key with the public material verifiers need."""

    private_pem: bytes
    public_pem: str
    kid: str
    public_jwk: dict[str, Any]


@lru_cache(maxsize=4)
def _load(private_pem: str) -> SigningKey:
    try:
        private_key = serialization.load_pem_private_key(
            private_pem.encode(), password=None
        )
    except (ValueError, TypeError) as ex:
        raise OAuthKeyConfigError(
            "MCP_OAUTH_PRIVATE_KEY is not a valid PEM key"
        ) from ex
    if not isinstance(private_key, rsa.RSAPrivateKey):
        raise OAuthKeyConfigError("MCP_OAUTH_PRIVATE_KEY must be an RSA private key")

    public_pem = (
        private_key.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    jwk = JsonWebKey.import_key(public_pem)
    kid = jwk.thumbprint()
    public_jwk = {
        **jwk.as_dict(is_private=False),
        "kid": kid,
        "use": "sig",
        "alg": ACCESS_TOKEN_ALGORITHM,
    }
    return SigningKey(
        private_pem=private_pem.encode(),
        public_pem=public_pem,
        kid=kid,
        public_jwk=public_jwk,
    )


def load_signing_key(config: Any) -> SigningKey:
    """Load the signing key from app config (``MCP_OAUTH_PRIVATE_KEY``)."""
    private_pem = config.get("MCP_OAUTH_PRIVATE_KEY")
    if not private_pem:
        raise OAuthKeyConfigError("MCP_OAUTH_PRIVATE_KEY is not configured")
    return _load(str(private_pem))


def sign_access_token(key: SigningKey, claims: dict[str, Any]) -> str:
    """Sign access token claims as an RS256 JWT carrying the key id."""
    header = {"alg": ACCESS_TOKEN_ALGORITHM, "kid": key.kid, "typ": "at+jwt"}
    token = jwt.encode(header, claims, key.private_pem)
    return token.decode() if isinstance(token, bytes) else str(token)
