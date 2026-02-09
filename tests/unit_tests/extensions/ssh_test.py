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
from io import StringIO
from unittest.mock import Mock

import pytest
import sshtunnel
from paramiko import ECDSAKey, Ed25519Key, RSAKey

from superset.extensions.ssh import _load_private_key, SSHManagerFactory


def test_ssh_tunnel_timeout_setting() -> None:
    app = Mock()
    app.config = {
        "SSH_TUNNEL_MAX_RETRIES": 2,
        "SSH_TUNNEL_LOCAL_BIND_ADDRESS": "test",
        "SSH_TUNNEL_TIMEOUT_SEC": 123.0,
        "SSH_TUNNEL_PACKET_TIMEOUT_SEC": 321.0,
        "SSH_TUNNEL_MANAGER_CLASS": "superset.extensions.ssh.SSHManager",
    }
    factory = SSHManagerFactory()
    factory.init_app(app)
    assert sshtunnel.TUNNEL_TIMEOUT == 123.0
    assert sshtunnel.SSH_TIMEOUT == 321.0


def test_load_private_key_rsa() -> None:
    """Test loading RSA private key (backward compatibility)."""
    # Generate a test RSA key
    rsa_key = RSAKey.generate(bits=2048)
    key_file = StringIO()
    rsa_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using auto-detection
    loaded_key = _load_private_key(key_str)

    # Verify it's an RSA key and matches
    assert isinstance(loaded_key, RSAKey)
    assert loaded_key.get_base64() == rsa_key.get_base64()


def test_load_private_key_ed25519() -> None:
    """Test loading Ed25519 private key (new functionality)."""
    # Generate a test Ed25519 key using cryptography library
    # Ed25519Key doesn't have a direct generate() method, so we use from_private_key
    # with a newly generated key from the underlying cryptography library
    from cryptography.hazmat.primitives.asymmetric import ed25519

    private_key_crypto = ed25519.Ed25519PrivateKey.generate()
    from cryptography.hazmat.primitives import serialization

    pem = private_key_crypto.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption(),
    )
    key_str = pem.decode("utf-8")

    # Load the key using auto-detection
    loaded_key = _load_private_key(key_str)

    # Verify it's an Ed25519 key
    assert isinstance(loaded_key, Ed25519Key)


def test_load_private_key_ecdsa() -> None:
    """Test loading ECDSA private key."""
    # Generate a test ECDSA key (256-bit curve)
    ecdsa_key = ECDSAKey.generate()
    key_file = StringIO()
    ecdsa_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using auto-detection
    loaded_key = _load_private_key(key_str)

    # Verify it's an ECDSA key and matches
    assert isinstance(loaded_key, ECDSAKey)
    assert loaded_key.get_base64() == ecdsa_key.get_base64()


def test_load_private_key_with_password() -> None:
    """Test loading password-protected private key."""
    # Generate an RSA key and save with password
    rsa_key = RSAKey.generate(bits=2048)
    key_file = StringIO()
    password = "test_password_123"
    rsa_key.write_private_key(key_file, password=password)
    key_str = key_file.getvalue()

    # Load the key with correct password
    loaded_key = _load_private_key(key_str, password)
    assert isinstance(loaded_key, RSAKey)
    assert loaded_key.get_base64() == rsa_key.get_base64()

    # Verify loading fails with wrong password
    with pytest.raises(ValueError, match="Failed to load private key"):
        _load_private_key(key_str, "wrong_password")

    # Verify loading fails without password
    with pytest.raises(ValueError, match="Failed to load private key"):
        _load_private_key(key_str)


def test_load_private_key_invalid() -> None:
    """Test that invalid keys fail cleanly with descriptive error."""
    invalid_key = "not a valid private key"

    with pytest.raises(ValueError) as exc_info:
        _load_private_key(invalid_key)

    error_msg = str(exc_info.value)
    # Error message should mention all attempted key types
    assert "Failed to load private key" in error_msg
    assert "RSAKey" in error_msg
    assert "Ed25519Key" in error_msg
    assert "ECDSAKey" in error_msg


def test_load_private_key_empty() -> None:
    """Test that empty key string fails cleanly."""
    with pytest.raises(ValueError, match="Failed to load private key"):
        _load_private_key("")
