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
"""
Utilities for API key generation and validation.

This module provides cryptographically secure API key generation and validation
using Python's built-in secrets module and bcrypt for hashing.
"""

import secrets

import bcrypt

# API key configuration
API_KEY_PREFIX = "pst"  # Preset/Superset prefix for easy identification
API_KEY_RANDOM_BYTES = 32  # 32 bytes = ~43 characters in base64
BCRYPT_ROUNDS = 12  # Cost factor for bcrypt (higher = more secure but slower)


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a cryptographically secure API key.

    Returns a tuple of (plaintext_key, key_hash, key_prefix) where:
    - plaintext_key: The full API key to show to the user (only shown once)
    - key_hash: The bcrypt hash to store in the database
    - key_prefix: The first 8 characters for identification

    Example:
        >>> plaintext, hash, prefix = generate_api_key()
        >>> plaintext
        'pst_abc123...'
        >>> prefix
        'pst_abc1'
    """
    # Generate secure random bytes and encode as URL-safe base64
    random_part = secrets.token_urlsafe(API_KEY_RANDOM_BYTES)

    # Construct full key with prefix
    plaintext_key = f"{API_KEY_PREFIX}_{random_part}"

    # Extract prefix (first 8 chars) for display/identification
    key_prefix = plaintext_key[:8]

    # Hash the key using bcrypt
    key_hash = bcrypt.hashpw(
        plaintext_key.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS)
    )

    return plaintext_key, key_hash.decode("utf-8"), key_prefix


def validate_api_key(plaintext_key: str, stored_hash: str) -> bool:
    """
    Validate an API key against its stored bcrypt hash.

    Args:
        plaintext_key: The API key provided by the user
            (e.g., from Authorization header)
        stored_hash: The bcrypt hash stored in the database

    Returns:
        True if the key is valid, False otherwise

    Example:
        >>> plaintext, hash, _ = generate_api_key()
        >>> validate_api_key(plaintext, hash)
        True
        >>> validate_api_key("wrong_key", hash)
        False
    """
    try:
        return bcrypt.checkpw(
            plaintext_key.encode("utf-8"), stored_hash.encode("utf-8")
        )
    except (ValueError, AttributeError):
        # Invalid hash format or encoding issue
        return False


def extract_api_key_from_header(authorization_header: str | None) -> str | None:
    """
    Extract API key from Authorization header.

    Supports both "Bearer <key>" and raw key formats.

    Args:
        authorization_header: Value of the Authorization HTTP header

    Returns:
        The extracted API key, or None if not found or invalid format

    Example:
        >>> extract_api_key_from_header("Bearer pst_abc123")
        'pst_abc123'
        >>> extract_api_key_from_header("pst_abc123")
        'pst_abc123'
        >>> extract_api_key_from_header(None)
        None
    """
    if not authorization_header:
        return None

    # Remove "Bearer " prefix if present (case-insensitive)
    if authorization_header.lower().startswith("bearer "):
        return authorization_header[7:].strip()

    return authorization_header.strip()
