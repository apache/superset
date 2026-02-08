---
title: Administrator Configuration
sidebar_position: 12
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Extension Administrator Configuration

This guide covers how to configure extension security for production deployments. As an administrator, you control which extensions can run and at what trust level.

## Trust Configuration

Configure extension trust in `superset_config.py`:

```python
EXTENSIONS_TRUST_CONFIG = {
    # Extensions that can run with full privileges ('core' trust level)
    "trusted_extensions": [
        "official-parquet-export",
        "enterprise-sso-plugin",
    ],

    # Allow any extension to run as 'core' without signature verification
    # WARNING: NEVER enable in production - development use only!
    "allow_unsigned_core": False,

    # Default sandbox for extensions without explicit trust configuration
    # Options: 'core', 'iframe', 'worker', 'wasm'
    "default_trust_level": "iframe",

    # Require valid signatures for extensions requesting 'core' trust
    # Recommended for production deployments
    "require_core_signatures": True,

    # Public keys for verified publishers (file paths or PEM strings)
    "trusted_signers": [
        "/etc/superset/keys/apache-official.pub",
        "/etc/superset/keys/enterprise-team.pub",
    ],
}
```

## Configuration Options

### `trusted_extensions`

A list of extension IDs that are allowed to run as `core` trust level without signature verification. Use this for extensions you've reviewed and trust completely.

```python
"trusted_extensions": [
    "my-company-plugin",
    "approved-community-extension",
],
```

### `allow_unsigned_core`

When `True`, allows any extension to run as `core` trust level regardless of signatures or trusted list. **Never enable this in production** - it's intended only for development environments.

```python
# Development only!
"allow_unsigned_core": True,
```

### `default_trust_level`

The trust level assigned to extensions that don't specify one in their manifest. The safest option is `iframe`, which provides browser-enforced isolation.

| Level | Description |
|-------|-------------|
| `iframe` | Browser-sandboxed iframe with controlled API access (recommended default) |
| `worker` | Web Worker sandbox for command-only extensions |
| `wasm` | WASM sandbox with no DOM access (most restrictive) |
| `core` | Full access to main context (not recommended as default) |

```python
"default_trust_level": "iframe",
```

### `require_core_signatures`

When `True`, extensions requesting `core` trust level must have a valid signature from a trusted signer. Extensions without valid signatures are downgraded to `default_trust_level`.

```python
"require_core_signatures": True,
```

### `trusted_signers`

A list of public keys authorized to sign extensions. Keys can be specified as file paths or inline PEM strings.

```python
"trusted_signers": [
    # File path to public key
    "/etc/superset/keys/publisher.pub",

    # Inline PEM string
    """-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA...
-----END PUBLIC KEY-----""",
],
```

## Signature Verification

### How It Works

1. Extension developers generate a signing keypair using the CLI
2. They sign their extension's manifest during the build process
3. The signed bundle includes `manifest.sig` alongside `manifest.json`
4. When Superset loads the extension, it verifies the signature against `trusted_signers`
5. If verification passes, the extension can run at its requested trust level

### Configuring Trusted Signers

1. Obtain the publisher's public key file (`.pub` extension)
2. Place it in a secure location on your server (e.g., `/etc/superset/keys/`)
3. Add the path to `trusted_signers` in your configuration

```python
EXTENSIONS_TRUST_CONFIG = {
    "trusted_signers": [
        "/etc/superset/keys/acme-corp.pub",
    ],
    "require_core_signatures": True,
}
```

### Verifying a Key Fingerprint

Before adding a public key to your trusted signers, verify its fingerprint with the publisher:

```bash
# On the publisher's machine
superset-extensions generate-keys --output my-key.pem
# Output: Fingerprint: MCowBQYDK2Vw...
```

Compare this fingerprint with what you receive to ensure authenticity.

## Security Recommendations

### Production Deployments

1. **Set `require_core_signatures: True`** - Ensures core extensions are verified
2. **Set `allow_unsigned_core: False`** - Never allow unsigned core extensions
3. **Use `iframe` as default** - Provides strong browser isolation
4. **Limit `trusted_extensions`** - Only add extensions you've thoroughly reviewed
5. **Secure key storage** - Store public keys in protected directories

### Development Environments

For local development, you may relax some restrictions:

```python
# Development configuration
EXTENSIONS_TRUST_CONFIG = {
    "trusted_extensions": [],
    "allow_unsigned_core": True,  # OK for development
    "default_trust_level": "core",  # Easier debugging
    "require_core_signatures": False,
    "trusted_signers": [],
}
```

## Extension Installation

### From Trusted Sources

1. Download the `.supx` bundle from a trusted source
2. Verify any checksums or signatures provided by the publisher
3. Place the bundle in your `EXTENSIONS_PATH` directory
4. If the extension requires `core` trust, add it to `trusted_extensions` or configure signature verification

### From Community Registry

Extensions from the community registry should be treated as semi-trusted at best. Consider:

1. Using `iframe` sandbox for community extensions
2. Reviewing the extension's source code before installation
3. Testing in a staging environment first

## Monitoring Extensions

### Logging

Extension trust decisions are logged at the INFO level:

```
INFO: Extension my-extension granted core trust (trusted + valid signature)
WARNING: Extension unknown-ext trust downgraded from core to iframe: Extension not in trusted list
```

Review these logs to monitor extension behavior and identify potential issues.

### Trust Downgrades

If an extension's trust is downgraded, you'll see a warning in the logs. Common reasons:

| Reason | Meaning |
|--------|---------|
| "Extension not in trusted list" | Extension requests core but isn't in `trusted_extensions` |
| "Core trust requires a valid signature" | `require_core_signatures` is enabled but signature is missing |
| "Signature verification failed" | Signature doesn't match any trusted signer |

## Troubleshooting

### Extension Not Loading as Core

1. Check if the extension ID is in `trusted_extensions`
2. If using signatures, verify the public key is in `trusted_signers`
3. Check logs for trust downgrade messages
4. Verify the extension bundle contains `manifest.sig`

### Signature Verification Failing

1. Ensure the public key file is readable by the Superset process
2. Verify the key is in PEM format with correct Ed25519 type
3. Check that the manifest wasn't modified after signing
4. Confirm the signature was created with the matching private key

### Permission Denied Errors

Sandboxed extensions may encounter permission errors if:

1. The extension's declared permissions don't match its API calls
2. The sandbox is blocking access correctly (working as intended)
3. The extension was downgraded to a more restrictive sandbox

Check the extension's `sandbox.permissions` configuration against its actual needs.
