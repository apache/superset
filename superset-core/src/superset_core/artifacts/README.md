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

# `superset_core.artifacts`: the Superset Artifacts SDK

An artifact is a small app that an agent writes and places on a Canvas. Its
code is untrusted: it runs only in a sandboxed frame on a separate site, with
no login and no network, and it reaches Superset data only through its host,
as the viewer.

This package holds the public contracts for artifacts. It defines interfaces
and models only; the machinery behind them (the sandbox host, builds,
packages, checks and storage at scale) belongs to a provider that a host
registers. It depends only on pydantic.

The browser half of the SDK is `@apache-superset/artifact-sdk` in
`superset-frontend/packages/superset-artifact-sdk`: the in-frame runtime
(`window.superset`), the host end of the bridge and the bridge protocol,
which only browser code speaks. It declares the capabilities and the
manifest's shape again, for TypeScript;
`tests/artifacts/test_artifact_typescript_sync.py` fails when the two halves
drift apart.

## Modules

| Module | What it is |
|---|---|
| `capabilities` | `Capability`: the named rights an artifact declares and a host grants for each context |
| `manifest` | `ArtifactManifest` (`manifest.json`): bindings, events, capabilities, exact-pinned dependencies and snapshot provenance, validated on every write |
| `store` | The git-shaped file store: path rules, content hashing, `validate_tree` and the `ArtifactStoreBackend` protocol with compare-and-swap refs |
| `provider` | `ArtifactRuntimeProvider`: the roles `FrameLinkMinter`, `ArtifactBuilder` and `ArtifactChecker`, plus the package host and the store backend; and a placeholder registry, where no provider means artifacts are off |
| `authoring` | The authoring tool contract: tool names, request and response models, error codes, mirroring Anthropic's text-editor and memory tools |
| `testing` | `InMemoryArtifactStore`, an in-memory `ArtifactStoreBackend` for tests and development, and `ArtifactStoreBackendConformance`, the backend contract as tests that any backend's suite inherits |

`provider.register_provider` is a stand-in until Superset settles how a host
implements an interface that an extension defines.

## Invariants the contracts encode

- The frame never sends queries: the host builds every query from the stored
  manifest and runs it as the viewer. The frame may only send values for
  declared parameters, and declared events.
- Capabilities are checked on both sides of the bridge; the host's check is
  the authoritative one.
- Every write names the version it starts from, and refs move only by
  compare-and-swap, so a stale write never wins.
- Publishing moves the `published` ref only after the user confirms.
- Dependencies are exact versions, never ranges, tags, URLs or git specs.

## Open questions

These are noted in the code where they apply, and are not adopted:

- A compute capability for WebAssembly, workers and `eval`.
- Bindings shaped like SIP-231's `SemanticQuery`.
- Per-workspace namespaces for the store (every store method takes a
  `namespace` argument for it).
- A retry-safe `op_id`, and paging limits.
- The check pool's isolation, the publish confirmation screen, query limits,
  build-time bundling and a smaller provider interface.
