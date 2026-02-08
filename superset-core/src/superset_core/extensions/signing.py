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

"""Extension manifest signing utilities.

This module provides cryptographic signing and verification utilities
for Superset extension manifests using Ed25519 signatures.

Ed25519 was chosen for:
    - Fast signature generation and verification
    - Small signature size (64 bytes)
    - Strong security guarantees
    - Resistance to side-channel attacks

Example usage:

    # Generate a new keypair
    >>> private_pem, public_pem = generate_keypair()
    >>> Path("signing-key.pem").write_bytes(private_pem)
    >>> Path("signing-key.pub").write_bytes(public_pem)

    # Sign a manifest
    >>> manifest = Path("manifest.json").read_bytes()
    >>> signature = sign_manifest(manifest, private_pem)
    >>> Path("manifest.sig").write_bytes(signature)

    # Verify a signature
    >>> is_valid = verify_signature(manifest, signature, public_pem)
"""

from __future__ import annotations

import base64

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519


def generate_keypair() -> tuple[bytes, bytes]:
    """Generate a new Ed25519 keypair for signing extensions.

    Returns:
        A tuple of (private_key_pem, public_key_pem) as bytes.

    Example:
        >>> private_pem, public_pem = generate_keypair()
        >>> b"PRIVATE KEY" in private_pem
        True
        >>> b"PUBLIC KEY" in public_pem
        True
    """
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    return private_pem, public_pem


def sign_manifest(manifest_bytes: bytes, private_key_pem: bytes) -> bytes:
    """Sign manifest content and return base64-encoded signature.

    Args:
        manifest_bytes: The raw manifest.json content to sign.
        private_key_pem: The PEM-encoded Ed25519 private key.

    Returns:
        Base64-encoded signature bytes.

    Raises:
        ValueError: If the private key is invalid or not Ed25519.

    Example:
        >>> private_pem, _ = generate_keypair()
        >>> manifest = b'{"id": "test", "name": "Test"}'
        >>> signature = sign_manifest(manifest, private_pem)
        >>> len(base64.b64decode(signature))  # Ed25519 signature is 64 bytes
        64
    """
    private_key = serialization.load_pem_private_key(
        private_key_pem,
        password=None,
    )

    if not isinstance(private_key, ed25519.Ed25519PrivateKey):
        raise ValueError("Private key must be Ed25519")

    signature = private_key.sign(manifest_bytes)
    return base64.b64encode(signature)


def verify_signature(
    manifest_bytes: bytes,
    signature_b64: bytes,
    public_key_pem: bytes,
) -> bool:
    """Verify a manifest signature.

    Args:
        manifest_bytes: The raw manifest.json content that was signed.
        signature_b64: Base64-encoded Ed25519 signature.
        public_key_pem: The PEM-encoded Ed25519 public key.

    Returns:
        True if the signature is valid, False otherwise.

    Example:
        >>> private_pem, public_pem = generate_keypair()
        >>> manifest = b'{"id": "test", "name": "Test"}'
        >>> signature = sign_manifest(manifest, private_pem)
        >>> verify_signature(manifest, signature, public_pem)
        True
        >>> verify_signature(b"tampered", signature, public_pem)
        False
    """
    try:
        public_key = serialization.load_pem_public_key(public_key_pem)

        if not isinstance(public_key, ed25519.Ed25519PublicKey):
            return False

        signature = base64.b64decode(signature_b64)
        public_key.verify(signature, manifest_bytes)
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False


def get_public_key_fingerprint(public_key_pem: bytes) -> str:
    """Get a fingerprint of a public key for display purposes.

    The fingerprint is the first 16 characters of the base64-encoded
    public key bytes, which is enough to identify keys visually.

    Args:
        public_key_pem: The PEM-encoded Ed25519 public key.

    Returns:
        A short fingerprint string for the key.

    Example:
        >>> _, public_pem = generate_keypair()
        >>> fingerprint = get_public_key_fingerprint(public_pem)
        >>> len(fingerprint)
        16
    """
    public_key = serialization.load_pem_public_key(public_key_pem)
    raw_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(raw_bytes).decode("ascii")[:16]
