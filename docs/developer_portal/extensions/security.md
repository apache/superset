---
title: Security
sidebar_position: 9
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

# Security

By default, extensions are disabled and must be explicitly enabled by setting the `ENABLE_EXTENSIONS` feature flag. Built-in extensions are included as part of the Superset codebase and are held to the same security standards and review processes as the rest of the application.

## Extension Sandboxing

Superset provides a tiered sandbox architecture for running extensions with varying levels of trust and isolation. Extensions can declare their trust level and permissions in their manifest, and Superset will load them in the appropriate sandbox:

- **Core (Tier 1)**: Trusted extensions run in the main context with full access
- **Iframe (Tier 2)**: Semi-trusted extensions run in browser-sandboxed iframes
- **WASM (Tier 3)**: Untrusted logic runs in WebAssembly sandboxes

For detailed information about the sandbox system, see [Extension Sandboxing](./sandbox).

## Trust Model

Administrators are responsible for evaluating and verifying the security of any extensions they choose to install. Superset's sandbox system provides defense-in-depth:

1. **Core extensions** require explicit trust configuration and optionally signature verification
2. **Iframe-sandboxed extensions** are isolated by the browser's same-origin policy
3. **WASM-sandboxed extensions** have no access to browser APIs

A directory of community extensions is available in the [Community Extensions](./registry) page. Note that these extensions are not vetted by the Apache Superset project—administrators must evaluate each extension before installation.

## Extension Signing

Extensions can be cryptographically signed to verify their authenticity and integrity. This is required for extensions that need `core` trust level in production environments with signature verification enabled.

- **Developers**: See [Extension Signing](./signing) to learn how to sign your extensions
- **Administrators**: See [Administrator Configuration](./admin-configuration) to configure trusted signers

## Administrator Configuration

Superset provides extensive configuration options for controlling extension trust levels, signature verification, and security policies. Key settings include:

- **Trusted extensions list**: Extensions allowed to run as `core`
- **Signature verification**: Require valid signatures for core trust
- **Default trust level**: Sandbox level for unlisted extensions

For complete configuration details, see [Administrator Configuration](./admin-configuration).

## Security Reporting

**Any performance or security vulnerabilities introduced by external extensions should be reported directly to the extension author, not as Superset vulnerabilities.**

Any security concerns regarding built-in extensions (included in Superset's monorepo) should be reported to the Superset Security mailing list for triage and resolution by maintainers.
