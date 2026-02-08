---
title: Extension Signing
sidebar_position: 11
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

# Extension Signing

Signing your extension allows administrators to verify its authenticity and integrity. Signed extensions can run as `core` trust level in production environments where signature verification is required.

## Why Sign Extensions?

- **Trust**: Administrators can verify your extension comes from a known source
- **Integrity**: Ensures the extension hasn't been modified since you signed it
- **Core Access**: Required for extensions needing `core` trust level in secured deployments
- **Distribution**: Makes your extension suitable for enterprise environments

## Generating Signing Keys

Generate a new Ed25519 keypair for signing your extensions:

```bash
superset-extensions generate-keys --output my-signing-key.pem
```

This creates two files:

| File | Purpose | Share? |
|------|---------|--------|
| `my-signing-key.pem` | Private key for signing | **Never share!** |
| `my-signing-key.pub` | Public key for verification | Share with administrators |

**Output example:**

```
✅ Private key: my-signing-key.pem
✅ Public key:  my-signing-key.pub
   Fingerprint: MCowBQYDK2Vw...

⚠️  Keep the private key secure! Only share the public key with administrators.

Usage:
  Sign an extension:  superset-extensions bundle --sign my-signing-key.pem
  Share with admins:  my-signing-key.pub
```

## Signing an Extension

### During Bundle

The easiest way to sign is during the bundle step:

```bash
superset-extensions bundle --sign my-signing-key.pem
```

This builds, signs the manifest, and creates the `.supx` bundle in one command.

**Output:**

```
✅ Full build completed in dist/
✅ Manifest signed
✅ Bundle created (signed): my-extension-1.0.0.supx
```

### Signing Existing Manifest

To sign an already-built manifest:

```bash
superset-extensions sign --key my-signing-key.pem --manifest dist/manifest.json
```

This creates `dist/manifest.sig` containing the signature.

## Bundle Structure

A signed extension bundle contains:

```
my-extension-1.0.0.supx
├── manifest.json       # Extension manifest
├── manifest.sig        # Ed25519 signature (base64-encoded)
├── frontend/dist/      # Frontend assets
└── backend/src/        # Backend code (if applicable)
```

The signature file (`manifest.sig`) contains a base64-encoded Ed25519 signature of the manifest content.

## Distributing Your Public Key

Share your public key (`.pub` file) with administrators who want to trust your extensions:

1. **Direct sharing**: Send the `.pub` file via secure channels
2. **Documentation**: Include in your extension's README
3. **Website**: Host on your organization's website with HTTPS

Administrators will add your public key to their `EXTENSIONS_TRUST_CONFIG.trusted_signers` configuration.

### Key Fingerprint

The fingerprint helps administrators verify they have the correct key. Include it in your documentation:

```
Public Key Fingerprint: MCowBQYDK2Vw...
```

Administrators should verify this fingerprint matches when adding your key.

## Security Best Practices

### Protect Your Private Key

- **Never commit** private keys to version control
- **Use secure storage** like hardware security modules (HSM) for production keys
- **Limit access** to the private key to authorized personnel only
- **Back up securely** in case of key loss

### Key Rotation

Consider rotating keys periodically:

1. Generate a new keypair
2. Notify administrators of the new public key
3. Sign new releases with the new key
4. Keep the old key available for verifying existing releases

### Multiple Keys

For organizations, consider separate keys for:

- Development/testing releases
- Production releases
- Different product teams

## Requesting Core Trust

If your extension needs `core` trust level:

1. **Sign your extension** using the process above
2. **Document your public key** with fingerprint
3. **Explain why core is needed** in your extension documentation
4. **Provide your public key** to administrators

Administrators will then:
1. Add your public key to `trusted_signers`
2. Enable `require_core_signatures: True`
3. Your signed extension can now run as `core`

## Verification Process

When Superset loads your extension:

1. Reads `manifest.json` and `manifest.sig` from the bundle
2. Checks if the extension requests `core` trust level
3. If `require_core_signatures` is enabled, verifies the signature
4. Checks the signature against all keys in `trusted_signers`
5. If verification passes, grants the requested trust level
6. If verification fails, downgrades to `default_trust_level`

## Troubleshooting

### "Signature verification failed"

- Ensure you're using the matching private key for the public key given to admins
- Verify the manifest wasn't modified after signing
- Check that the `.sig` file was included in the bundle

### "Private key must be Ed25519"

- The signing system only supports Ed25519 keys
- Generate a new key using `superset-extensions generate-keys`

### Administrator Reports Invalid Signature

- Verify the public key file wasn't corrupted during transfer
- Confirm the fingerprint matches between your key and theirs
- Re-sign the extension and redistribute

## Technical Details

### Signature Algorithm

Extensions use **Ed25519** signatures:

- Fast signature generation and verification
- Small signature size (64 bytes)
- Strong security guarantees
- Deterministic signatures (same input always produces same output)

### Signature Format

The `manifest.sig` file contains:

```
<base64-encoded Ed25519 signature>
```

The signature is computed over the raw bytes of `manifest.json`.

### Key Format

Keys are stored in PEM format:

**Private key:**
```
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEI...
-----END PRIVATE KEY-----
```

**Public key:**
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA...
-----END PUBLIC KEY-----
```
