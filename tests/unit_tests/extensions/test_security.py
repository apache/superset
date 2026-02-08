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

"""Tests for the extension security module."""

from __future__ import annotations

from superset_core.extensions.signing import generate_keypair, sign_manifest

from superset.extensions.security import (
    ExtensionSecurityManager,
    reset_security_manager,
    TrustDecision,
)


class TestTrustDecision:
    """Tests for TrustDecision dataclass."""

    def test_was_downgraded_true(self) -> None:
        decision = TrustDecision(
            extension_id="test",
            requested_trust_level="core",
            granted_trust_level="iframe",
        )
        assert decision.was_downgraded is True

    def test_was_downgraded_false(self) -> None:
        decision = TrustDecision(
            extension_id="test",
            requested_trust_level="iframe",
            granted_trust_level="iframe",
        )
        assert decision.was_downgraded is False


class TestExtensionSecurityManager:
    """Tests for ExtensionSecurityManager class."""

    def setup_method(self) -> None:
        """Reset security manager before each test."""
        reset_security_manager()

    def test_default_config(self) -> None:
        """Test that default configuration is applied."""
        manager = ExtensionSecurityManager()
        assert manager.trusted_extensions == frozenset()
        assert manager.allow_unsigned_core is False
        assert manager.default_trust_level == "iframe"
        assert manager.require_core_signatures is False

    def test_custom_config(self) -> None:
        """Test that custom configuration is applied."""
        config = {
            "trusted_extensions": ["ext-1", "ext-2"],
            "allow_unsigned_core": True,
            "default_trust_level": "wasm",
            "require_core_signatures": True,
        }
        manager = ExtensionSecurityManager(config)
        assert manager.trusted_extensions == frozenset(["ext-1", "ext-2"])
        assert manager.allow_unsigned_core is True
        assert manager.default_trust_level == "wasm"
        assert manager.require_core_signatures is True

    def test_invalid_default_trust_level_falls_back(self) -> None:
        """Test that invalid default trust level falls back to iframe."""
        config = {"default_trust_level": "invalid"}
        manager = ExtensionSecurityManager(config)
        assert manager.default_trust_level == "iframe"


class TestTrustLevelValidation:
    """Tests for trust level validation logic."""

    def setup_method(self) -> None:
        """Reset security manager before each test."""
        reset_security_manager()

    def test_trusted_extension_gets_core(self) -> None:
        """Test that trusted extensions get core trust."""
        config = {"trusted_extensions": ["my-ext"]}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level("my-ext", "core")

        assert decision.granted_trust_level == "core"
        assert decision.was_downgraded is False
        assert decision.rejection_reason is None

    def test_untrusted_extension_downgraded(self) -> None:
        """Test that untrusted extensions requesting core are downgraded."""
        config = {"trusted_extensions": [], "default_trust_level": "iframe"}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level("unknown-ext", "core")

        assert decision.granted_trust_level == "iframe"
        assert decision.was_downgraded is True
        assert decision.rejection_reason is not None

    def test_allow_unsigned_core_grants_core(self) -> None:
        """Test that allow_unsigned_core allows any extension to run as core."""
        config = {"allow_unsigned_core": True}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level("any-ext", "core")

        assert decision.granted_trust_level == "core"
        assert decision.was_downgraded is False

    def test_non_core_trust_passes_through(self) -> None:
        """Test that non-core trust levels pass through unchanged."""
        manager = ExtensionSecurityManager()

        for trust_level in ["iframe", "worker", "wasm"]:
            decision = manager.validate_trust_level("ext", trust_level)
            assert decision.granted_trust_level == trust_level
            assert decision.was_downgraded is False

    def test_invalid_trust_level_uses_default(self) -> None:
        """Test that invalid trust level falls back to default."""
        config = {"default_trust_level": "wasm"}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level("ext", "invalid")

        assert decision.granted_trust_level == "wasm"

    def test_none_trust_level_uses_default(self) -> None:
        """Test that None trust level uses default."""
        config = {"default_trust_level": "worker"}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level("ext", None)

        assert decision.granted_trust_level == "worker"


class TestSignatureVerification:
    """Tests for signature verification functionality."""

    def setup_method(self) -> None:
        """Reset security manager before each test."""
        reset_security_manager()

    def test_require_signatures_rejects_unsigned(self) -> None:
        """Test that require_core_signatures rejects unsigned extensions."""
        config = {"require_core_signatures": True}
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level(
            extension_id="unsigned-ext",
            manifest_trust_level="core",
            signature=None,
            manifest_bytes=None,
        )

        assert decision.granted_trust_level == "iframe"
        assert decision.signature_valid is False
        assert decision.rejection_reason is not None
        assert "signature" in decision.rejection_reason.lower()

    def test_valid_signature_grants_core(self) -> None:
        """Test that valid signature grants core trust."""
        # Generate test keypair
        private_pem, public_pem = generate_keypair()
        manifest_bytes = b'{"id": "test", "name": "Test Extension"}'
        signature = sign_manifest(manifest_bytes, private_pem)

        config = {
            "require_core_signatures": True,
            "trusted_signers": [public_pem.decode("utf-8")],
        }
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level(
            extension_id="signed-ext",
            manifest_trust_level="core",
            signature=signature,
            manifest_bytes=manifest_bytes,
        )

        assert decision.granted_trust_level == "core"
        assert decision.signature_valid is True

    def test_invalid_signature_downgrades(self) -> None:
        """Test that invalid signature downgrades trust."""
        # Generate two different keypairs
        private_pem1, _ = generate_keypair()
        _, public_pem2 = generate_keypair()

        manifest_bytes = b'{"id": "test", "name": "Test Extension"}'
        # Sign with key 1 but verify with key 2
        signature = sign_manifest(manifest_bytes, private_pem1)

        config = {
            "require_core_signatures": True,
            "trusted_signers": [public_pem2.decode("utf-8")],
        }
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level(
            extension_id="bad-sig-ext",
            manifest_trust_level="core",
            signature=signature,
            manifest_bytes=manifest_bytes,
        )

        assert decision.granted_trust_level == "iframe"
        assert decision.signature_valid is False

    def test_trusted_extension_with_signature(self) -> None:
        """Test that trusted extensions can also have signature verification."""
        private_pem, public_pem = generate_keypair()
        manifest_bytes = b'{"id": "trusted-ext", "name": "Trusted"}'
        signature = sign_manifest(manifest_bytes, private_pem)

        config = {
            "trusted_extensions": ["trusted-ext"],
            "trusted_signers": [public_pem.decode("utf-8")],
        }
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level(
            extension_id="trusted-ext",
            manifest_trust_level="core",
            signature=signature,
            manifest_bytes=manifest_bytes,
        )

        assert decision.granted_trust_level == "core"
        assert decision.signature_valid is True

    def test_tampered_manifest_fails_verification(self) -> None:
        """Test that tampered manifest fails signature verification."""
        private_pem, public_pem = generate_keypair()
        original_manifest = b'{"id": "test", "name": "Test Extension"}'
        tampered_manifest = b'{"id": "test", "name": "Malicious Extension"}'
        signature = sign_manifest(original_manifest, private_pem)

        config = {
            "require_core_signatures": True,
            "trusted_signers": [public_pem.decode("utf-8")],
        }
        manager = ExtensionSecurityManager(config)

        decision = manager.validate_trust_level(
            extension_id="tampered-ext",
            manifest_trust_level="core",
            signature=signature,
            manifest_bytes=tampered_manifest,
        )

        assert decision.granted_trust_level == "iframe"
        assert decision.signature_valid is False


class TestSigningUtilities:
    """Tests for the signing utilities module."""

    def test_generate_keypair(self) -> None:
        """Test that generate_keypair creates valid keys."""
        private_pem, public_pem = generate_keypair()

        assert b"PRIVATE KEY" in private_pem
        assert b"PUBLIC KEY" in public_pem

    def test_sign_and_verify(self) -> None:
        """Test that signing and verification work correctly."""
        from superset_core.extensions.signing import verify_signature

        private_pem, public_pem = generate_keypair()
        manifest = b'{"id": "test", "name": "Test"}'

        signature = sign_manifest(manifest, private_pem)
        assert verify_signature(manifest, signature, public_pem) is True

    def test_verify_fails_for_wrong_key(self) -> None:
        """Test that verification fails with wrong key."""
        from superset_core.extensions.signing import verify_signature

        private_pem1, _ = generate_keypair()
        _, public_pem2 = generate_keypair()
        manifest = b'{"id": "test", "name": "Test"}'

        signature = sign_manifest(manifest, private_pem1)
        assert verify_signature(manifest, signature, public_pem2) is False

    def test_verify_fails_for_tampered_data(self) -> None:
        """Test that verification fails for tampered data."""
        from superset_core.extensions.signing import verify_signature

        private_pem, public_pem = generate_keypair()
        manifest = b'{"id": "test", "name": "Test"}'
        tampered = b'{"id": "test", "name": "Evil"}'

        signature = sign_manifest(manifest, private_pem)
        assert verify_signature(tampered, signature, public_pem) is False

    def test_get_public_key_fingerprint(self) -> None:
        """Test that fingerprint generation works."""
        from superset_core.extensions.signing import get_public_key_fingerprint

        _, public_pem = generate_keypair()
        fingerprint = get_public_key_fingerprint(public_pem)

        assert len(fingerprint) == 16
        assert isinstance(fingerprint, str)
