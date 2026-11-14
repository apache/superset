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

## Unreleased

Changes since `apache-superset-core` 0.2.0, the version on the 7.0 release line.

### Added

- Semantic-layer provider contracts for execution context
  (`superset_core.semantic_layers.context`), cache identity and result-cache
  versioning, provider HTTP transport (`superset_core.semantic_layers.transport`),
  credential readiness (`SemanticCredentialReadiness`), OR filter groups
  (`OrFilter`, `FilterExpression`), typed query rejection and backend errors
  (`superset_core.semantic_layers.errors`).
- `SemanticView` selection identity versioning (`selection_identity_version`,
  `validate_selection_version`), `preferred_temporal_dimension`,
  `metadata_cache_token`, and the `ROW_OFFSET` and `ADHOC_COLUMN_EXPRESSIONS`
  features.
- `StatementResult.truncated` in `superset_core.queries.types`.
- `SemanticResultCompletenessError` for providers that cannot guarantee a complete
  result. See the [result-completeness guide](../docs/developer_docs/semantic-result-completeness.md).
- A provider conformance test kit in `superset_core.semantic_layers.testing`; install
  `apache-superset-core[testing]` for its pytest dependency.

### Compatibility

- This pre-1.0 release contains breaking provider contract changes from 0.2.0:
  `SemanticLayer.from_configuration` requires keyword-only `cache_token`, `context`,
  and `transport`, and must also accept keyword-only
  `credentials: SemanticCredentials | None = None`, which the host always passes.
  `get_configuration_schema` and `get_runtime_schema` require
  keyword-only `transport` and `readiness`. `SemanticQuery.filters` and
  `GroupLimit.filters` can contain `OrFilter` groups that providers must render.
  Review the
  [extension dependency policy](../docs/developer_docs/extensions/dependencies.md)
  and test providers with the matching Superset host before deployment.
- When a query has no `order`, the matching Superset host sorts ascending by its
  first selected date, timestamp or time dimension before calling the provider,
  so `get_table` can receive a non-empty `order` the chart did not request.
  `get_row_count` receives no default order.
- The `sqlalchemy-utils` upper bound is raised to `<0.44`. Python, SQLAlchemy and
  the other runtime requirements are unchanged from 0.2.0.

## 0.2.0 (7.0 release line)

Changes since the published 0.1.0. This version is not yet published to PyPI.

### Added

- Semantic-layer contracts in `superset_core.semantic_layers`: the
  `SemanticLayer` and `SemanticView` base classes, the `semantic_layer` decorator,
  query and result types (including aggregation types and the `ILIKE` and
  `NOT_ILIKE` operators), configuration helpers, and host-bound models and DAOs.
- Extension storage: `superset_core.extensions.context` (`ExtensionContext`,
  `get_context`) and ephemeral and persistent state in
  `superset_core.extensions.storage`.
- `Role`, `Group` and `Subject` models with `RoleDAO`, `GroupDAO` and `SubjectDAO`
  in `superset_core.common`.
- Task subscriptions (`superset_core.tasks.subscription.TaskSubscriptionPolicy`),
  task dependencies (`TaskDependency`, `TaskContext.get_dependency_payloads`) and
  private task properties.

### Compatibility

- `apache-superset-core` requires Python 3.11 or later and SQLAlchemy 2.0
  (`sqlalchemy>=2.0.0,<2.1`); 0.1.0 allowed Python 3.10 and SQLAlchemy 1.4. It
  also requires `sqlglot>=30.8.0,<31` (0.1.0: `<29`), `flask-appbuilder>=5.2.0`,
  `pyarrow>=16.0.0` and `isodate>=0.7.0`.
- Host extensions: `TaskProperties` no longer holds `exception_type` and
  `stack_trace` at the top level; the framework writes them under
  `private["framework"]`, which the Task REST API omits outside debug mode.
  `TaskSubscriber.user_id` is `None` for embedded-guest subscribers (`guest_key`).

## 0.1.0 (2026-05-11)

- First stable `apache-superset-core` release; earlier versions were pre-releases
  (`0.0.1rc1`–`0.0.1rc4` and `0.1.0rc1`–`0.1.0rc3`).
