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
from paramiko import DSSKey, ECDSAKey, Ed25519Key, RSAKey, SSHException

from superset.extensions.ssh import SSHManager, SSHManagerFactory


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

def test_load_rsa_private_key() -> None:
    """Test that RSA keys can be loaded successfully (existing behavior)."""
    # Generate a test RSA key
    test_key = RSAKey.generate(bits=2048)
    key_file = StringIO()
    test_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using the new method
    loaded_key = SSHManager._load_private_key(key_str)

    # Verify it's an RSA key
    assert isinstance(loaded_key, RSAKey)
    assert loaded_key.get_name() == "ssh-rsa"


def test_load_ed25519_private_key() -> None:
    """Test that Ed25519 keys can be loaded successfully (new behavior)."""
    # Generate a test Ed25519 key
    test_key = Ed25519Key.generate()
    key_file = StringIO()
    test_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using the new method
    loaded_key = SSHManager._load_private_key(key_str)

    # Verify it's an Ed25519 key
    assert isinstance(loaded_key, Ed25519Key)
    assert loaded_key.get_name() == "ssh-ed25519"


def test_load_ecdsa_private_key() -> None:
    """Test that ECDSA keys can be loaded successfully."""
    # Generate a test ECDSA key
    test_key = ECDSAKey.generate()
    key_file = StringIO()
    test_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using the new method
    loaded_key = SSHManager._load_private_key(key_str)

    # Verify it's an ECDSA key
    assert isinstance(loaded_key, ECDSAKey)
    assert "ecdsa-sha2" in loaded_key.get_name()


def test_load_dss_private_key() -> None:
    """Test that DSS keys can be loaded successfully."""
    # Generate a test DSS key
    test_key = DSSKey.generate(bits=1024)
    key_file = StringIO()
    test_key.write_private_key(key_file)
    key_str = key_file.getvalue()

    # Load the key using the new method
    loaded_key = SSHManager._load_private_key(key_str)

    # Verify it's a DSS key
    assert isinstance(loaded_key, DSSKey)
    assert loaded_key.get_name() == "ssh-dss"


def test_load_encrypted_rsa_key_with_password() -> None:
    """Test that encrypted RSA keys can be loaded with correct password."""
    # Generate a test RSA key with encryption
    test_key = RSAKey.generate(bits=2048)
    key_file = StringIO()
    password = "test_password"
    test_key.write_private_key(key_file, password=password)
    key_str = key_file.getvalue()

    # Load the key with password
    loaded_key = SSHManager._load_private_key(key_str, password)

    # Verify it loaded successfully
    assert isinstance(loaded_key, RSAKey)
    assert loaded_key.get_name() == "ssh-rsa"


def test_load_encrypted_ed25519_key_with_password() -> None:
    """Test that encrypted Ed25519 keys can be loaded with correct password."""
    # Generate a test Ed25519 key with encryption
    test_key = Ed25519Key.generate()
    key_file = StringIO()
    password = "test_password"
    test_key.write_private_key(key_file, password=password)
    key_str = key_file.getvalue()

    # Load the key with password
    loaded_key = SSHManager._load_private_key(key_str, password)

    # Verify it loaded successfully
    assert isinstance(loaded_key, Ed25519Key)
    assert loaded_key.get_name() == "ssh-ed25519"


def test_load_invalid_key_raises_exception() -> None:
    """Test that invalid key content raises SSHException."""
    invalid_key = "-----BEGIN RSA PRIVATE KEY-----\nINVALID\n-----END RSA PRIVATE KEY-----"

    with pytest.raises(SSHException) as exc_info:
        SSHManager._load_private_key(invalid_key)

    assert "Unable to load private key" in str(exc_info.value)
    assert "Supported formats" in str(exc_info.value)


def test_load_key_with_wrong_password_raises_exception() -> None:
    """Test that encrypted key with wrong password raises exception."""
    # Generate encrypted RSA key
    test_key = RSAKey.generate(bits=2048)
    key_file = StringIO()
    test_key.write_private_key(key_file, password="correct_password")
    key_str = key_file.getvalue()

    # Try to load with wrong password - should raise exception
    with pytest.raises(SSHException):
        SSHManager._load_private_key(key_str, "wrong_password")


def test_load_empty_string_raises_exception() -> None:
    """Test that empty key string raises SSHException."""
    with pytest.raises(SSHException) as exc_info:
        SSHManager._load_private_key("")

    assert "Unable to load private key" in str(exc_info.value)


def test_load_malformed_key_raises_exception() -> None:
    """Test that malformed key content raises SSHException with helpful message."""
    malformed_key = "not a key at all"

    with pytest.raises(SSHException) as exc_info:
        SSHManager._load_private_key(malformed_key)

    # Verify the error message is helpful
    assert "Unable to load private key" in str(exc_info.value)
    assert "RSA, Ed25519, ECDSA, DSS" in str(exc_info.value)


def test_key_type_auto_detection_order() -> None:
    """Test that key type detection works regardless of actual key type."""
    # Generate keys of different types
    rsa_key = RSAKey.generate(bits=2048)
    ed25519_key = Ed25519Key.generate()

    # Convert to strings
    rsa_file = StringIO()
    rsa_key.write_private_key(rsa_file)
    rsa_str = rsa_file.getvalue()

    ed25519_file = StringIO()
    ed25519_key.write_private_key(ed25519_file)
    ed25519_str = ed25519_file.getvalue()

    # Load both and verify correct types detected
    loaded_rsa = SSHManager._load_private_key(rsa_str)
    loaded_ed25519 = SSHManager._load_private_key(ed25519_str)

    assert isinstance(loaded_rsa, RSAKey)
    assert isinstance(loaded_ed25519, Ed25519Key)
    assert loaded_rsa.get_name() == "ssh-rsa"
    assert loaded_ed25519.get_name() == "ssh-ed25519"