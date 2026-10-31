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

# Changelog

This changelog tracks the `apache-superset-core` Python package. Unreleased entries
describe the next release; the package version is bumped during the coordinated
core-package release process.

## 0.2.0 (unreleased)

### Added

- Semantic-layer provider contracts for configuration, execution context, cache
  identity, query requests, results, and typed query rejection.
- `SemanticResultCompletenessError` for providers that cannot guarantee a complete
  result. See the [result-completeness guide](../docs/developer_docs/semantic-result-completeness.md).
- A provider conformance test kit in `superset_core.semantic_layers.testing`.

### Compatibility

- This pre-1.0 minor release contains provider contract changes. Review the
  [extension dependency policy](../docs/developer_docs/extensions/dependencies.md)
  and test providers with the matching Superset host before deployment.

## 0.1.0 (2026-05-11)

- First stable `apache-superset-core` release; earlier versions were pre-releases
  (`0.0.1rc1`–`0.0.1rc4` and `0.1.0rc1`–`0.1.0rc3`).
