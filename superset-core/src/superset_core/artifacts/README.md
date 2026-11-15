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

This package holds the public contracts for artifacts (proposal §5.1, the
Superset Artifacts SDK). It defines interfaces and models only; the machinery
behind them (the sandbox host, builds, packages, checks and storage at scale)
belongs to a provider that a host registers. It depends only on pydantic.

The browser half of the SDK is `@apache-superset/artifact-sdk` in
`superset-frontend/packages/superset-artifact-sdk`: the in-frame runtime, the
host end of the bridge and the bridge protocol, which only browser code
speaks. It declares the capabilities and the manifest's shape again, for
TypeScript; `tests/artifacts/test_artifact_typescript_sync.py` fails when the
two halves drift apart.

## Modules

| Module | What it is | Proposal | Decisions |
|---|---|---|---|
| `capabilities` | `Capability`: the named rights an artifact declares and a host grants for each context | 5.1, E6, E7; SIP B | DR-11 |
| `manifest` | `ArtifactManifest` (`manifest.json`): bindings, events, capabilities, exact-pinned dependencies and snapshot provenance, validated on every write | 5.1, 5.3, E7; SIP B | DR-08, DR-09, DR-10, DR-11 |
| `store` | The git-shaped file store: path rules, content hashing, `validate_tree` and the `ArtifactStoreBackend` protocol with compare-and-swap refs | 5.4, E2, E3 | DR-05, DR-19 |
| `provider` | `ArtifactRuntimeProvider`: the roles `FrameLinkMinter`, `ArtifactBuilder` and `ArtifactChecker`, plus the package host and the store backend; and a placeholder registry, where no provider means artifacts are off | 5.1, E8; SIP C | DR-03, DR-18 |
| `authoring` | The authoring tool contract: tool names, request and response models, error codes, mirroring Anthropic's text-editor and memory tools | 5.4, 5.7, E4, E5; SIP B | DR-04, DR-06, DR-12, DR-13 |
| `testing` | `InMemoryArtifactStore`, an in-memory `ArtifactStoreBackend` for tests and development | 5.4, E3 | DR-05 |

How the work items map:

- **SIP B** (the Superset Artifacts SDK): the package and manifest format,
  capabilities, the runtime protocol and the authoring-tool contract. Here:
  `manifest`, `capabilities` and `authoring`; the runtime protocol is in the
  TypeScript package.
- **SIP C** (providers for extensions): how a host implements an interface
  that an extension defines. `provider.register_provider` is a stand-in until
  SIP C settles the mechanism.
- **E6** (the runtime SDK, `window.superset`): the TypeScript package.
- **E7** (the manifest): `manifest`.
- **E8** (the provider interface): `provider`.

## Invariants the contracts encode

- The frame never sends queries: the host builds every query from the stored
  manifest and runs it as the viewer. The frame may only send values for
  declared parameters, and declared events (DR-08, DR-10, DR-11).
- Capabilities are checked on both sides of the bridge; the host's check is
  the authoritative one.
- Every write names the version it starts from, and refs move only by
  compare-and-swap, so a stale write never wins (DR-05).
- Publishing moves the `published` ref only after the user confirms (DR-12).
- Dependencies are exact versions, never ranges, tags, URLs or git specs
  (DR-09).

## Pending review findings

These are noted in the code where they apply, and are not adopted:

- K1: a compute capability for WebAssembly, workers and `eval`.
- D1: bindings shaped like SIP-231's `SemanticQuery`.
- G11: per-workspace namespaces for the store (every store method takes a
  `namespace` argument for it).
- M12, M13: a retry-safe `op_id`, and paging limits.
- T2, T5, T16, K2, K17: the check pool's isolation, the publish confirmation
  screen, query limits, build-time bundling and a smaller provider interface.
