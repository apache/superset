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

"""Extension security and trust validation.

This module provides trust-level validation and signature verification
for Superset extensions. It enforces the configured trust policy to ensure
that only approved extensions can run with elevated privileges.

Trust Levels:
    - core: Full access, runs in main context (requires explicit trust or signature)
    - iframe: Runs in sandboxed iframe with controlled API access
    - worker: Runs in Web Worker with postMessage API
    - wasm: Runs in WASM sandbox with no DOM access

Example configuration in superset_config.py:

    EXTENSIONS_TRUST_CONFIG = {
        "trusted_extensions": ["official-plugin", "enterprise-sso"],
        "allow_unsigned_core": False,
        "default_trust_level": "iframe",
        "require_core_signatures": True,
        "trusted_signers": ["/etc/superset/keys/publisher.pub"],
    }
"""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TYPE_CHECKING

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import load_pem_public_key

if TYPE_CHECKING:
    from flask import Flask

logger = logging.getLogger(__name__)

# Valid trust levels
TRUST_LEVELS = frozenset({"core", "iframe", "worker", "wasm"})

# Default trust configuration
DEFAULT_TRUST_CONFIG: dict[str, Any] = {
    "trusted_extensions": [],
    "allow_unsigned_core": False,
    "default_trust_level": "iframe",
    "require_core_signatures": False,
    "trusted_signers": [],
}


@dataclass
class TrustDecision:
    """Result of trust level validation for an extension.

    Attributes:
        extension_id: The unique identifier of the extension.
        requested_trust_level: The trust level requested in the extension manifest.
        granted_trust_level: The actual trust level granted after validation.
        signature_valid: Whether signature verification passed (None if not checked).
        rejection_reason: Human-readable reason if trust was downgraded.
    """

    extension_id: str
    requested_trust_level: str
    granted_trust_level: str
    signature_valid: bool | None = None
    rejection_reason: str | None = None

    @property
    def was_downgraded(self) -> bool:
        """Check if the extension was downgraded from its requested trust level."""
        return self.requested_trust_level != self.granted_trust_level


class ExtensionSecurityManager:
    """Manages extension trust validation and signature verification.

    This class is responsible for validating extension trust levels based on
    the configured trust policy. It ensures that:

    1. Only trusted extensions can run as 'core' trust level
    2. Signatures are verified for extensions that require them
    3. Untrusted extensions are downgraded to a safer trust level

    Example:
        >>> config = {"trusted_extensions": ["my-ext"], "default_trust_level": "iframe"}
        >>> manager = ExtensionSecurityManager(config)
        >>> decision = manager.validate_trust_level("my-ext", "core")
        >>> decision.granted_trust_level
        'core'
        >>> decision = manager.validate_trust_level("unknown-ext", "core")
        >>> decision.granted_trust_level
        'iframe'
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        """Initialize the security manager with configuration.

        Args:
            config: Trust configuration dictionary. Uses DEFAULT_TRUST_CONFIG
                for any missing keys.
        """
        config = {**DEFAULT_TRUST_CONFIG, **(config or {})}

        self.trusted_extensions: frozenset[str] = frozenset(
            config.get("trusted_extensions", [])
        )
        self.allow_unsigned_core: bool = config.get("allow_unsigned_core", False)
        self.default_trust_level: str = config.get("default_trust_level", "iframe")
        self.require_core_signatures: bool = config.get(
            "require_core_signatures", False
        )
        self._trusted_signers: list[ed25519.Ed25519PublicKey] = []

        # Load trusted signers
        signers = config.get("trusted_signers", [])
        self._load_trusted_signers(signers)

        # Validate default trust level
        if self.default_trust_level not in TRUST_LEVELS:
            logger.warning(
                "Invalid default_trust_level '%s', using 'iframe'",
                self.default_trust_level,
            )
            self.default_trust_level = "iframe"

    def _load_trusted_signers(self, signers: list[str]) -> None:
        """Load public keys from PEM strings or file paths.

        Args:
            signers: List of PEM strings or file paths to public key files.
        """
        for signer in signers:
            try:
                # Check if it's a file path
                if not signer.startswith("-----BEGIN"):
                    path = Path(signer)
                    if path.exists():
                        pem_data = path.read_bytes()
                    else:
                        logger.warning("Trusted signer key file not found: %s", signer)
                        continue
                else:
                    pem_data = signer.encode("utf-8")

                public_key = load_pem_public_key(pem_data)
                if isinstance(public_key, ed25519.Ed25519PublicKey):
                    self._trusted_signers.append(public_key)
                else:
                    logger.warning(
                        "Trusted signer key is not Ed25519: %s",
                        signer[:50] + "..." if len(signer) > 50 else signer,
                    )
            except Exception:
                logger.exception("Failed to load trusted signer key")

        if signers and not self._trusted_signers:
            logger.warning(
                "No valid trusted signers loaded from %d configured keys",
                len(signers),
            )

    def validate_trust_level(
        self,
        extension_id: str,
        manifest_trust_level: str | None,
        signature: bytes | None = None,
        manifest_bytes: bytes | None = None,
    ) -> TrustDecision:
        """Validate and potentially downgrade extension trust level.

        This method checks whether an extension should be granted its
        requested trust level based on the configured trust policy.

        Args:
            extension_id: The unique identifier of the extension.
            manifest_trust_level: The trust level declared in the extension manifest.
            signature: Optional base64-encoded signature of the manifest.
            manifest_bytes: Optional raw manifest content for signature verification.

        Returns:
            TrustDecision containing the granted trust level and any rejection reason.
        """
        requested = manifest_trust_level or self.default_trust_level

        # Validate requested trust level
        if requested not in TRUST_LEVELS:
            logger.warning(
                "Extension %s requested invalid trust level '%s', using default",
                extension_id,
                requested,
            )
            requested = self.default_trust_level

        # Core trust requires additional validation
        if requested == "core":
            return self._validate_core_trust(extension_id, signature, manifest_bytes)

        # Non-core trust levels pass through without signature check
        return TrustDecision(
            extension_id=extension_id,
            requested_trust_level=requested,
            granted_trust_level=requested,
            signature_valid=None,
        )

    def _validate_core_trust(
        self,
        extension_id: str,
        signature: bytes | None,
        manifest_bytes: bytes | None,
    ) -> TrustDecision:
        """Validate an extension requesting core trust.

        Core trust validation follows this order:
        1. Check if extension is in trusted_extensions whitelist
        2. Check if allow_unsigned_core is enabled (dev mode)
        3. Check signature if require_core_signatures is enabled
        4. Downgrade to default_trust_level if none of the above pass

        Args:
            extension_id: The unique identifier of the extension.
            signature: Optional base64-encoded signature.
            manifest_bytes: Optional manifest content for verification.

        Returns:
            TrustDecision for core trust request.
        """
        # Check if extension is explicitly trusted
        if extension_id in self.trusted_extensions:
            sig_valid = None
            if signature and manifest_bytes:
                sig_valid = self._verify_signature(signature, manifest_bytes)
                if sig_valid:
                    logger.info(
                        "Extension %s granted core trust (trusted + valid signature)",
                        extension_id,
                    )
                else:
                    logger.info(
                        "Extension %s granted core trust (trusted, invalid signature)",
                        extension_id,
                    )
            else:
                logger.info(
                    "Extension %s granted core trust (in trusted list)",
                    extension_id,
                )

            return TrustDecision(
                extension_id=extension_id,
                requested_trust_level="core",
                granted_trust_level="core",
                signature_valid=sig_valid,
            )

        # Check if unsigned core is allowed (dev mode)
        if self.allow_unsigned_core:
            logger.warning(
                "Extension %s granted core trust (allow_unsigned_core=True). "
                "This should only be used in development!",
                extension_id,
            )
            return TrustDecision(
                extension_id=extension_id,
                requested_trust_level="core",
                granted_trust_level="core",
                signature_valid=None,
            )

        # Check signature if core signatures are required
        if self.require_core_signatures:
            if not signature or not manifest_bytes:
                logger.warning(
                    "Extension %s denied core trust: signature required but missing",
                    extension_id,
                )
                return TrustDecision(
                    extension_id=extension_id,
                    requested_trust_level="core",
                    granted_trust_level=self.default_trust_level,
                    signature_valid=False,
                    rejection_reason="Core trust requires a valid signature",
                )

            if self._verify_signature(signature, manifest_bytes):
                logger.info(
                    "Extension %s granted core trust (valid signature)",
                    extension_id,
                )
                return TrustDecision(
                    extension_id=extension_id,
                    requested_trust_level="core",
                    granted_trust_level="core",
                    signature_valid=True,
                )
            else:
                logger.warning(
                    "Extension %s denied core trust: invalid signature",
                    extension_id,
                )
                return TrustDecision(
                    extension_id=extension_id,
                    requested_trust_level="core",
                    granted_trust_level=self.default_trust_level,
                    signature_valid=False,
                    rejection_reason="Signature verification failed",
                )

        # Downgrade to default trust level
        logger.info(
            "Extension %s downgraded from core to %s (not in trusted list)",
            extension_id,
            self.default_trust_level,
        )
        return TrustDecision(
            extension_id=extension_id,
            requested_trust_level="core",
            granted_trust_level=self.default_trust_level,
            signature_valid=None,
            rejection_reason="Extension not in trusted list",
        )

    def _verify_signature(self, signature: bytes, data: bytes) -> bool:
        """Verify signature against trusted signers.

        Args:
            signature: Base64-encoded Ed25519 signature.
            data: The data that was signed (manifest content).

        Returns:
            True if any trusted signer's public key verifies the signature.
        """
        if not self._trusted_signers:
            logger.debug("No trusted signers configured, signature cannot be verified")
            return False

        try:
            sig_bytes = base64.b64decode(signature)
        except Exception:
            logger.warning("Failed to decode signature as base64")
            return False

        for public_key in self._trusted_signers:
            try:
                public_key.verify(sig_bytes, data)
                return True
            except InvalidSignature:
                continue
            except Exception:
                logger.exception("Error during signature verification")
                continue

        return False


# Module-level instance cache
_security_manager: ExtensionSecurityManager | None = None


def get_extension_security_manager(
    app: Flask | None = None,
) -> ExtensionSecurityManager:
    """Get the extension security manager instance.

    This function returns a cached singleton instance of the security manager,
    initialized with the application's EXTENSIONS_TRUST_CONFIG.

    Args:
        app: Optional Flask application. If not provided, uses current_app.

    Returns:
        The ExtensionSecurityManager instance.
    """
    global _security_manager

    if _security_manager is not None:
        return _security_manager

    if app is None:
        from flask import current_app

        app = current_app

    config = app.config.get("EXTENSIONS_TRUST_CONFIG", DEFAULT_TRUST_CONFIG)
    _security_manager = ExtensionSecurityManager(config)
    return _security_manager


def reset_security_manager() -> None:
    """Reset the cached security manager instance.

    This is primarily useful for testing to ensure a fresh manager is created.
    """
    global _security_manager
    _security_manager = None
