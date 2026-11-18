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

# The Superset Artifacts SDK

An artifact is a small app that an agent writes and places on a Canvas. Its
code is untrusted: it runs only in a sandboxed frame on a separate site, with
no login and no network, and it reaches Superset data only through its host,
as the viewer.

The SDK holds the public contracts for artifacts, in two packages that ship
with the artifacts extension:

- `python/`: `superset_artifacts_sdk` (distribution `superset-artifacts-sdk`),
  the server-side contracts. It defines interfaces and models, and the pure
  rules they share (the policy, paths and hashes); the machinery behind them
  (the sandbox host, builds, packages, checks and storage at scale) belongs to
  a provider that a host registers. It depends only on pydantic.
- `browser/`: `@superset-oss/artifacts-sdk`, the in-frame runtime
  (`window.superset`), the host end of the bridge and the bridge protocol,
  which only browser code speaks. It declares the capabilities and the
  manifest's shape again, for TypeScript;
  `python/tests/test_artifact_typescript_sync.py` fails when the two halves
  drift apart.

The extension and a host (the code that registers a provider) both depend on
these packages; Superset core depends on neither.

## Modules

| Module | What it is |
|---|---|
| `capabilities` | `Capability`: the named rights an artifact declares and a host grants for each context |
| `manifest` | `ArtifactManifest` (`manifest.json`): bindings, events, capabilities, exact-pinned dependencies and snapshot provenance, validated on every write |
| `policy` | `ArtifactPolicy`: the Locked, Standard and Open profiles, layers that only narrow them (`policy_layer`, `resolve_policy`), and the grant a frame gets in each context (`grant_for`: manifest ∩ policy ∩ context) |
| `store` | The git-shaped file store: path rules, content hashing, `validate_tree` and the `ArtifactStoreBackend` protocol with compare-and-swap refs, which its host scopes (to one tenant, say) |
| `provider` | `ArtifactRuntimeProvider`: the roles `FrameLinkMinter`, `FrameSources` (the sandbox's sources, for host pages' `frame-src`), `ArtifactBuilder`, `ArtifactChecker`, `ArtifactStoreSource` (the store backend) and `PolicySource` (the provider's policy layer, such as a workspace's), combined; and `VersionNotFoundError`, which links, builds and checks raise for a version the store doesn't hold |
| `registry` | `register_provider`, `get_provider` and `artifacts_available`: the one switch, a plain module the host calls; no provider means artifacts are off |
| `authoring` | The authoring tool contract: tool names, request and response models, error codes, mirroring Anthropic's text-editor and memory tools |
| `testing` | `InMemoryArtifactStore`, an in-memory `ArtifactStoreBackend` for tests and development, and `ArtifactStoreBackendConformance`, the backend contract as tests that any backend's suite inherits |

## Develop

```bash
PYTHONPATH=python/src python -m pytest python/tests -q
cd browser && npm test
```

## Invariants the contracts encode

- The frame never sends queries: the host builds every query from the stored
  manifest and runs it as the viewer. The frame may only send values for
  declared parameters, and declared events.
- Capabilities are checked on both sides of the bridge; the host's check is
  the authoritative one.
- Every write names the version it starts from, and refs move only by
  compare-and-swap, together with their history, so a stale write never wins
  and no move goes unrecorded.
- Publishing moves the `published` ref only after the user confirms.
- Dependencies are exact versions, never ranges, tags, URLs or git specs.
- No capability or policy knob lets a frame reach the network or run `eval`;
  WebAssembly and workers come only with the `compute.wasm` and
  `compute.workers` capabilities, where the policy's `compute` allows them.

## Open questions

These are noted in the code where they apply, and are not adopted:

- Bindings shaped like the `SemanticQuery` of
  [SIP-231](https://github.com/apache/superset/issues/44875) §7.
- A retry-safe `op_id` on every write, and paging limits for `view`, `search`
  and `history`.
- Where the user confirms publishing: a host screen that shows the diff.
- Parameter values checked against each parameter's `type`.
- Deletion (retention, GDPR erasure) and per-resource quotas in the store.
- Screenshots in `check`, and a smaller provider interface.
