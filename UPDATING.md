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

# Updating Superset

This file documents any backwards-incompatible changes in Superset and
assists people when migrating to a new version.

## Next

### Owners, dashboard roles, and RLS roles replaced by Subjects

Superset now uses subject-based access assignments for dashboards, charts, datasets,
alerts/reports, and Row Level Security. A Subject can represent a user, role, or group.

This is a breaking API and metadata change:

- `owners` is replaced by `editors` for dashboards, charts, datasets, and alerts/reports.
- Dashboard `roles` and the `DASHBOARD_RBAC` feature flag are replaced by dashboard/chart
  `viewers`, enabled with `ENABLE_VIEWERS`.
- RLS `roles` is replaced by `subjects`.
- The legacy `dashboard_user`, `slice_user`, `sqlatable_user`, `report_schedule_user`,
  `dashboard_roles`, and `rls_filter_roles` tables are migrated into subject junction tables
  and dropped on upgrade.

For deployments that previously used `DASHBOARD_RBAC` and later disabled it: remove stale rows
from the legacy `dashboard_roles` table before upgrading, otherwise those role assignments will
become active dashboard Viewers after migration.

API clients and automation should send and read `editors`, `viewers`, and `subjects` instead
of the legacy fields.

Subject pickers support users, groups, and roles, but only users and groups are selectable by
default. Roles remain supported as Subject types for backwards compatibility with RLS role
assignments and the previous `DASHBOARD_RBAC` model, but they are not recommended for new
resource-specific assignments. Prefer groups for membership-based access and keep roles focused
on capability grants. Existing Role subject assignments remain effective after migration even when
Roles are hidden from the default dropdown values; configure the relevant `SUBJECTS_RELATED_TYPES_*`
setting to make Roles selectable when editing subject lists. See the [Security documentation](docs/admin_docs/security/security.mdx#subjects)
for the full Subject model and picker configuration guidance.

To make roles selectable everywhere:

```python
from superset.subjects.types import SubjectType

SUBJECTS_RELATED_TYPES = [
    SubjectType.USER,
    SubjectType.GROUP,
    SubjectType.ROLE,
]
```

To make roles selectable for RLS while other pickers keep the user and group default, use the
RLS-specific override:

```python
from superset.subjects.types import SubjectType

SUBJECTS_RELATED_TYPES_RLS = [
    SubjectType.USER,
    SubjectType.GROUP,
    SubjectType.ROLE,
]
```

Entity-specific `SUBJECTS_RELATED_TYPES_*` settings replace `SUBJECTS_RELATED_TYPES` for that
picker.

Deployments using `EXTRA_OWNERS_RESOLVER` must migrate to `EXTRA_EDITORS_RESOLVER`. The new
resolver should return editor Subjects, subject IDs, or dicts with an `id` key instead of FAB
User objects. API responses expose these dynamic assignments as `extra_editors` instead of
`extra_owners`.

`DASHBOARD_RBAC` has been removed. To preserve the previous Dashboard RBAC behavior, enable both
subject viewers and viewer datasource bypass:

```python
FEATURE_FLAGS = {
    "ENABLE_VIEWERS": True,
}
VIEWER_PROMISCUOUS_MODE = True
```

Enabling only `ENABLE_VIEWERS` allows assigning dashboard/chart viewer subjects, but viewers still
need normal datasource permissions unless `VIEWER_PROMISCUOUS_MODE` is also enabled.

For backwards compatibility, enabling `ENABLE_VIEWERS` does not change access for dashboards or
charts that have no assigned viewers. Those resources continue to use the implicit dataset-access
model: users who can access the underlying dataset can still see published dashboards that use that
dataset and charts backed by that dataset.
Assigning one or more viewers opts that resource into explicit viewer access for non-editors. To
return a resource to the implicit dataset-access model, remove all viewers from it. Explicit Viewers
are the intended model going forward; deprecating and removing implicit viewership can be considered
in a later major version.

- [41044](https://github.com/apache/superset/issues/41044): Removes the deprecated `AVOID_COLORS_COLLISION` feature flag (it defaulted to `True`). Color-collision avoidance is now permanently enabled; any config override setting it to `False` is ignored.

- [39925](https://github.com/apache/superset/pull/39925): URL prefixing for `SUPERSET_APP_ROOT` subdirectory deployments is now handled automatically by helpers in `src/utils/navigationUtils` (`openInNewTab`, `redirect`, `getShareableUrl`, `<AppLink>`). Direct imports of `ensureAppRoot` / `makeUrl` from `src/utils/pathUtils` are forbidden outside `navigationUtils.ts` (enforced by a static-invariant test); contributors writing new code should use the focused helpers instead. No runtime behaviour change for existing callers — all 19 prior call sites have been migrated and four pre-existing double-prefix and missing-prefix bugs are fixed as part of the migration.

- [39925](https://github.com/apache/superset/pull/39925): `SupersetClient.getUrl()` now strips a single leading application-root segment from the supplied `endpoint` before building the request URL, so a caller that accidentally pre-prefixes its endpoint (for example by wrapping it with `ensureAppRoot` before passing it to the client) no longer produces a doubled `/superset/superset/...` URL under subdirectory deployment. The strip is **single-pass** — a genuine `/superset/superset/<slug>` route is preserved, not collapsed — and **silent** (no console warning); the static-invariant test remains the primary signal for pre-prefixing at the call site, and this runtime strip is a safety net beneath it. Code that intentionally targeted a literal `/<app_root>/<app_root>/...` endpoint through `getUrl` (a configuration that has no legitimate use under the prefixing model) would have its first redundant segment removed.

- **Breaking — `Superset` view class route prefix removed.** The `Superset` view in `superset/views/core.py` now declares `route_base = ""`, overriding Flask-AppBuilder's auto-derived `/superset` prefix. Routes that previously lived at `/superset/welcome/`, `/superset/dashboard/<id>/`, `/superset/dashboard/p/<key>/`, `/superset/explore/`, etc. now respond at `/welcome/`, `/dashboard/<id>/`, `/dashboard/p/<key>/`, `/explore/`, etc. Under subdirectory deployment (`SUPERSET_APP_ROOT=/superset`) the URLs are unchanged from end-user perspective — `AppRootMiddleware` re-applies the prefix via `SCRIPT_NAME`. Under root deployments, any external integration or bookmark that hard-codes `/superset/<endpoint>/` paths must be updated to drop the prefix. This fixes the doubled `/superset/superset/...` URLs that `url_for` emitted for these endpoints under subdirectory deployment and the related 404s on the routes themselves.

- **Breaking — Three sibling view classes route prefix removed.** Following the same rationale as the `Superset` class above, `ExplorePermalinkView` (`superset/views/explore.py`), `TagModelView`, and `TaggedObjectsModelView` (`superset/views/tags.py`, `superset/views/all_entities.py`) now mount at the application root rather than a hard-coded `/superset/...`. The user-visible URLs `/superset/explore/p/<key>/`, `/superset/tags/`, and `/superset/all_entities/` are unchanged under subdirectory deployment; under root deployments these views now serve `/explore/p/<key>/`, `/tags/`, and `/all_entities/`, so any external integration or bookmark must drop the `/superset/` prefix. `Dashboard.url` and `Dashboard.get_url` likewise return `/dashboard/<id>/` instead of the prior `/superset/dashboard/<id>/` literal so downstream consumers (DashboardList row hrefs, MCP service `dashboard_url`) emit a single, deployment-correct prefix.

- **Legacy `/superset/*` path support.** A new outermost WSGI middleware `LegacyPrefixRedirectMiddleware` (`superset/middleware/legacy_prefix_redirect.py`) 308-redirects every enumerated legacy `/superset/<canonical>` path to its post-`route_base=""` canonical location (e.g. `/superset/welcome/` → `/welcome/` under root; → `/superset/welcome/` under `SUPERSET_APP_ROOT=/superset`, because the canonical resolves through `AppRootMiddleware`). Bookmarks, email links, and external integrations survive the route-base collapse for one release cycle. POST against a GET-only canonical returns 410 Gone instead of 308 (308 would 405 on retry). The shim is removed at EOL `5.0.0`, matching the `@deprecated(eol_version="5.0.0")` gate on `Superset.explore` and `Superset.explore_json`.

- **PWA web app manifest served dynamically.** The PWA manifest is now served at `/pwa-manifest.json` (under `APPLICATION_ROOT`) by a new `PwaManifestView` (`superset/views/pwa_manifest.py`) instead of the static file at `/static/assets/pwa-manifest.json`. The legacy static source at `superset-frontend/src/pwa-manifest.json` has been removed (along with its `webpack.config.js` `CopyPlugin` rule). The new endpoint resolves `APPLICATION_ROOT` and `STATIC_ASSETS_PREFIX` at request time so PWA install works under subdirectory deployments and split static-prefix / app-root deployments (where `STATIC_ASSETS_PREFIX` points to a CDN host while the Superset backend stays under `APPLICATION_ROOT`). The `<link rel="manifest">` href in `superset/templates/superset/spa.html` was updated correspondingly (using a new `application_root_rstrip` template global). Operators with a forked `spa.html` should switch any manifest `<link>` to `{{ application_root_rstrip }}/pwa-manifest.json`.

- **Hard re-bookmark break — `/superset/sql/<database_id>/`.** SQL Lab moved to its own blueprint at `/sqllab/`. The legacy `/superset/sql/<id>/` shape changed to a query-string form (`/sqllab/?dbid=<id>`); no 1:1 path mapping exists, so `LegacyPrefixRedirectMiddleware` does **not** redirect this route — it passes through and surfaces a 404. Users with bookmarks to `/superset/sql/<id>/` must update them to `/sqllab/?dbid=<id>`.

- **`SqlaTable.sql_url` query-string format.** `SqlaTable.sql_url` now URL-encodes `table_name` and joins it as a query parameter rather than concatenating a second `?`. Previously, with `Database.sql_url` returning `/sqllab/?dbid=<id>`, the concatenation produced `/sqllab/?dbid=<id>?table_name=<raw>` — a malformed second `?` that broke the query parser. External code that parsed the legacy `<base>?table_name=<raw>` shape now sees properly percent-encoded values (e.g. `/` → `%2F`, ` ` → `+` or `%20`); decode with `urllib.parse.parse_qsl`.

- **New config flag `EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE` (default `False`).** Share/permalink URLs now substitute `window.location.origin` for the backend-supplied origin so a proxied or subdirectory-deployed Superset never hands the user an unreachable internal hostname. Operators whose reverse proxy correctly forwards `X-Forwarded-Host` *and* who want permalinks to carry the backend's literal origin can opt out by setting `EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE = True` in `superset_config.py`. Default `False` (rewrite is on); flipping the default would regress the dominant proxied/subdir deployment to an unreachable host.

- [41651](https://github.com/apache/superset/pull/41651): **New do-not-translate standard for translation catalogs.** Strings that must stay identical to the source — icon names (e.g. `bolt`), enum/option values (`step-after`), SQL keywords, API field names (`error_message`), code constants, and example placeholders — are now marked with a `#. do-not-translate` extracted comment. The list lives in the `superset/translations/do-not-translate.txt` registry; `scripts/translations/apply_do_not_translate.py` stamps the marker onto `messages.pot` during `babel_update.sh`, and `pybabel update` propagates it to every `.po`, so the status is consistent across all languages. The AI backfill (`backfill_po.py`) and translators leave these entries untranslated (source fallback). The legacy per-catalog convention (a `# Не переводить` translator comment in the `ru` catalog) is still honored for back-compat but is superseded by this standard; contributors adding new machine-read strings should add the msgid to the registry rather than annotating individual catalogs.

### SQL Lab denies large-object and information_schema access by default

`DISALLOWED_SQL_FUNCTIONS` and `DISALLOWED_SQL_TABLES` now ship with additional default entries, so SQL Lab and chart-data queries that reference them are rejected where they were previously allowed:

- PostgreSQL large-object routines (`lo_from_bytea`, `lo_export`, `lo_import`, `lo_put`, `lo_create`, `lo_creat`, `lowrite`, `lo_get`, `loread`, `lo_unlink`), which read and write bytes on the database server's filesystem.
- The SQL-standard `information_schema` views (`tables`, `columns`, `routines`, `views`, the privilege/grant views, etc.), which expose table, column, privilege, and view-definition metadata across the whole database.

Deployments that legitimately query these (for example tooling that introspects `information_schema`) can restore the previous behavior by overriding `DISALLOWED_SQL_FUNCTIONS` / `DISALLOWED_SQL_TABLES` in `superset_config.py` to drop the entries they need.

Because the denylist now resolves the effective schema through the query-aware path, PostgreSQL queries that change the `search_path` (e.g. `SET search_path = ...`) are rejected on the SQL Lab execution and cost-estimate paths whenever any `DISALLOWED_SQL_TABLES` entry is configured (the default for PostgreSQL), matching the behavior previously applied only when `RLS_IN_SQLLAB` was enabled.

### SQL parser input length cap (SQL_MAX_PARSE_LENGTH)

The SQL parser now rejects scripts whose UTF-8 byte length exceeds the new
`SQL_MAX_PARSE_LENGTH` config option (default `1_000_000` bytes) before they are
handed to sqlglot, which bounds parser memory and CPU usage. A single query
larger than the cap (for example a very large `IN (...)` list or a big
virtual-dataset SQL) raises a parse error in SQL Lab and dashboard-generated
queries. Deployments that legitimately run queries above this size should raise
the value, and `SQL_MAX_PARSE_LENGTH = None` disables the check entirely.

### Ant Design upgraded from v5 to v6

The frontend now builds against Ant Design 6, and `@superset-ui/core` / `@apache-superset/core` peer-depend on `antd ^6`. Custom plugins, extensions, and themes that interact with Ant Design need review:

- **Internal DOM classes were renamed**, so any custom CSS targeting `.ant-*` internals silently stops matching. Notable renames: `.ant-tabs-content-holder` → `.ant-tabs-body-holder`, `.ant-tabs-content` → `.ant-tabs-body`, `.ant-tabs-tabpane` → `.ant-tabs-content`; `.ant-select-selector` → `.ant-select-content`, `.ant-select-selection-placeholder` → `.ant-select-placeholder`, `.ant-select-arrow` → `.ant-select-suffix`; `.ant-tooltip-inner` → `.ant-tooltip-container`; `.ant-popover-inner` → `.ant-popover-container`; `.ant-steps-item-tail` → `.ant-steps-item-rail`.
- **Some component props changed or were removed** — e.g. `Select` no longer accepts `dropdownAlign`, `visible`/`onVisibleChange` are `open`/`onOpenChange`, `Dropdown` `overlay` is `menu`, `Steps.Step` children are the `items` prop, and `styles.body` on Tooltip/Popover is `styles.container`.
- **CSS variables are on by default** in antd 6, and `ThemeConfig.cssVar` no longer accepts a boolean; Superset theme configs using `cssVar: true`/`false` are coerced (`true` → `{}`, `false` → omitted).

Theme tokens are unaffected — antd 6 removed none of the tokens Superset exposes, so existing theme configurations continue to work. See the [Ant Design v6 migration guide](https://ant.design/docs/react/migration-v6) for the complete upstream list.

### Guest-token RLS rules reject unknown fields

The `rls` rules passed to `POST /api/v1/security/guest_token/` are now validated strictly: a rule may only contain `dataset` and `clause`. Previously unknown fields were silently dropped, so a mistyped or legacy scope key (most commonly `datasource` instead of `dataset`) produced a rule with no `dataset`, which is treated as a *global* rule applied to every dataset the embedded resource can reach. Such a request now returns HTTP 400 identifying the offending field instead of issuing a token with an unintended global rule. Integrators that were sending extra fields in RLS rules must remove them; valid dataset-scoped (`{"dataset": 41, "clause": "..."}`) and global (`{"clause": "..."}`) rules are unaffected.

### MCP service requires `MCP_JWT_AUDIENCE` when JWT auth is enabled

When the MCP service has JWT auth enabled (`MCP_AUTH_ENABLED = True`), an audience must be configured via `MCP_JWT_AUDIENCE` so issued tokens are bound to this service. The service now fails to start with a clear configuration error when the audience is unset, instead of starting with audience validation skipped. Deployments that enable MCP JWT auth must set `MCP_JWT_AUDIENCE` to the audience value their identity provider issues for the MCP service. API-key-only MCP deployments (JWT auth disabled) are unaffected.

### Swagger UI is opt-in (off by default)

`FAB_API_SWAGGER_UI` now defaults to `False` and is driven by the `SUPERSET_ENABLE_SWAGGER_UI` environment variable. The interactive Swagger UI / OpenAPI documentation endpoints (e.g. `/swagger/v1`) are therefore no longer exposed by default. To enable them, set `SUPERSET_ENABLE_SWAGGER_UI=true` (the bundled Docker development environment sets this) or override `FAB_API_SWAGGER_UI = True` in `superset_config.py`.

### Build details (git SHA / build number) are admin-only by default

The git SHA and build number surfaced in the "About" section, the bootstrap payload, and the public `/version` endpoint are now only included for admin users by default; the release version string is still shown to everyone. To expose the build details to all users (the previous behavior), set the `SUPERSET_EXPOSE_BUILD_DETAILS` environment variable (or `EXPOSE_BUILD_DETAILS_TO_USERS = True` in `superset_config.py`).

### Helm chart adopts Kubernetes recommended labels (breaking upgrade)

The Helm chart now labels and selects workloads using the [Kubernetes recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/) (`app.kubernetes.io/*`) instead of the legacy `app`/`release` labels. Because a Deployment's `spec.selector.matchLabels` is immutable, `helm upgrade` against an existing release will fail with a `field is immutable` error.

To upgrade, delete the affected workloads (which selector labels changed) before upgrading, then run the upgrade so they are recreated with the new labels:

```bash
kubectl delete deployment,statefulset -l release=<release-name> -n <namespace>
helm upgrade <release-name> superset/superset
```

Alternatively, perform a fresh install. This is a one-time migration; subsequent upgrades are unaffected.

### Pivot table First/Last aggregations follow data order

The pivot table chart's `First` and `Last` aggregations now return the first and last value in data (query result) order, instead of effectively returning the minimum and maximum. Existing pivot tables that use these aggregations for totals/subtotals may show different values after upgrading. For deterministic results, ensure the underlying query has a stable sort order.

### `FetchRetryOptions` callback parameters widened to allow `null`

The `error` and `response` parameters of the `retryDelay` and `retryOn` callbacks in `FetchRetryOptions` (exported from `@superset-ui/core`) are now typed `Error | null` and `Response | null` to match the actual call-site signature provided by `fetch-retry`. Because these parameter types are contravariant, consumers who typed their callbacks with the non-nullable `(attempt: number, error: Error, response: Response) => number` will get a TypeScript compile error. Widen your callback signatures to accept `Error | null` / `Response | null`.

### `thumbnail_url` removed from dashboard list API response

The `thumbnail_url` field has been removed from `GET /api/v1/dashboard/` list responses. External consumers relying on this field must now construct the thumbnail URL client-side using `id` and `changed_on_utc`:

```
/api/v1/dashboard/{id}/thumbnail/{changed_on_utc}/
```

The thumbnail endpoint redirects to the current digest URL regardless of whether the supplied digest is exact. If the image is not yet cached, that digest URL may return `202` and trigger async generation. Using `changed_on_utc` as the digest is sufficient for cache-busting purposes.

### Tagging fix for `create_all`-bootstrapped schemas

Only affects deployments whose metadata schema was created with SQLAlchemy's `create_all` (rather than `superset db upgrade`) on a foreign-key-enforcing backend — PostgreSQL, or MySQL with `FOREIGN_KEY_CHECKS=1`. Such schemas carry three invalid foreign keys on `tagged_object.object_id` that break tagging (`TAGGING_SYSTEM = True`) with a `ForeignKeyViolation`. Schemas built via `superset db upgrade` are unaffected.

This release stops the ORM from emitting these constraints, but it cannot drop ones already present in your schema. If affected, drop them manually (names vary by backend, so look them up first):

```sql
-- PostgreSQL: names are typically tagged_object_object_id_fkey, _fkey1, _fkey2
ALTER TABLE tagged_object DROP CONSTRAINT <constraint_name>;

-- MySQL: find names via `SHOW CREATE TABLE tagged_object;`
ALTER TABLE tagged_object DROP FOREIGN KEY <constraint_name>;
```
### Entity version-history infrastructure (gated off by default)

Introduces the schema and SQLAlchemy-Continuum wiring that captures version history for charts, dashboards, and datasets, plus read-only `GET /api/v1/{chart,dashboard,dataset}/<uuid>/versions/` endpoints. This ships **inert**: a new config flag `ENABLE_VERSIONING_CAPTURE` defaults to `False`, so no save writes any version rows and the endpoints return empty. It is an operational kill-switch (a release toggle that becomes a permanent ops switch), not a feature flag — set it to `True` to enable capture once validated. The migration is additive; existing entity `PUT` responses gain `old_version_uuid` / `new_version_uuid` body fields and an `ETag` header (both null/absent when capture is off).

A few save- and import-path internals change **unconditionally** (independent of the flag), because the versioned mappers must behave correctly whether or not capture is enabled:

- `DatasetDAO` column/metric updates move from bulk operations to per-row ORM operations, and a metadata refresh now preserves column primary keys via a natural-key (`column_name`) upsert instead of delete-and-reinsert — so charts that reference dataset columns by id keep working across a refresh (previously such references could be invalidated).
- `ImportExportMixin.reset_ownership` stamps the current user onto `created_by`/`changed_by` when a request context is present (previously left null for the column default to fill).
- `UpdateDashboardCommand` runs its body under `no_autoflush`.

These are behavior changes that take effect on upgrade regardless of `ENABLE_VERSIONING_CAPTURE`; no operator action is required.

### Webhook alerts/reports block private/internal hosts by default

Webhook alert/report dispatch (`WebhookNotification.send`) now validates the target URL's host against the same private/internal-IP block applied to dataset import URLs. If the resolved host is in a loopback, link-local, private (RFC-1918), shared-CGNAT, or multicast range, the webhook is rejected with `NotificationParamException`.

Deployments that intentionally point webhooks at internal targets (chatops bridges, internal automation servers, on-premises Mattermost/Rocket.Chat, etc.) can opt out by setting `ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS = True` in `superset_config.py`. This mirrors the existing `DATASET_IMPORT_ALLOW_INTERNAL_DATA_URLS` opt-out for dataset imports.

### Impala cancel_query blocks private/internal hosts by default

The Impala engine spec's `cancel_query` issues an HTTP request from the Superset backend to the host configured on the Impala database connection. That host is now validated before the request: if it resolves to a private/internal IP range, the cancel call is refused and a warning is logged. Operators whose Impala cluster runs on an internal network can opt out by setting `IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS = True` in `superset_config.py`. This mirrors the dataset-import and webhook opt-out flags.

### Map chart renderer and OpenStreetMap migration behavior

The MapLibre migration for deck.gl charts preserves saved non-Mapbox styles on
the MapLibre-compatible path. Saved styles such as OpenStreetMap, `tile://`
tile templates, generic HTTPS style URLs, and charts without a saved style are
not reclassified as Mapbox during migration and do not require
`MAPBOX_API_KEY` only because of the migration.

Saved true Mapbox styles whose value starts with `mapbox://` remain
Mapbox-backed. If a Superset deployment does not configure `MAPBOX_API_KEY`,
those saved Mapbox charts keep the existing missing-key message instead of
silently falling back to MapLibre or another provider. In Explore, deck.gl and
point-cluster renderer controls preserve saved Mapbox state, but the Mapbox
choice is not available as a new working renderer without a configured key.

The MapLibre style choices include `Streets (OSM)`, backed by
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`. This OpenStreetMap tile
service requires visible `© OpenStreetMap contributors` attribution and should
be used through normal browser map tile requests and caching; it is not intended
for bulk prefetch or offline tile downloads.

### Password complexity policy enabled by default

Superset now ships a default password-complexity policy, enforced (via Flask-AppBuilder) across self-registration, the user create/edit/reset forms, and the User REST API. The policy requires a minimum password length of 8 characters and rejects a built-in blocklist of common/guessable passwords.

This is enabled by default (`FAB_PASSWORD_COMPLEXITY_ENABLED = True`), so new or reset passwords that are too short or appear in the blocklist will be rejected where they were previously accepted. Existing stored passwords are unaffected until they are next changed.

Operators can tune or disable the policy via config:

- `AUTH_PASSWORD_MIN_LENGTH` — minimum length (default `8`).
- `AUTH_PASSWORD_COMMON_BLOCKLIST` — extra passwords to reject, in addition to the built-in list.
- `FAB_PASSWORD_COMPLEXITY_VALIDATOR` — replace with your own callable for custom rules.
- `FAB_PASSWORD_COMPLEXITY_ENABLED = False` — disable enforcement entirely.

### Data uploads bounded by UPLOAD_MAX_FILE_SIZE_BYTES

Single data-file uploads (CSV, Excel, columnar) are now bounded by the `UPLOAD_MAX_FILE_SIZE_BYTES` config option, which defaults to `100 * 1024 * 1024` (100 MB). Files larger than this are rejected with a `413` before their contents are buffered into memory. Set `UPLOAD_MAX_FILE_SIZE_BYTES = None` to disable the check and restore unbounded uploads.
### Currency symbol position follows the locale when unset

When a chart's currency control leaves the **Prefix or suffix** field empty, the currency symbol position is now derived from the deployment locale's own convention via `Intl.NumberFormat` instead of always defaulting to a suffix. For example, under the default `en-US` locale `USD`, `GBP`, and `EUR` render as a prefix (`$ 1,000`), while eurozone locales such as `fr-FR` render `EUR` as a suffix (`1 000 €`). An explicit Prefix/Suffix selection is always honored and is unaffected.

Charts that relied on the previous always-suffix default for an unset position will render the symbol on the locale-appropriate side instead; set the position explicitly on the metric's currency control to pin it.

### Duration formatter precision

The `DURATION` number formatter now uses `Intl.DurationFormat` for locale-aware output. By default, sub-second fields are omitted, so values that previously displayed fractional seconds with `pretty-ms`, such as `10500` milliseconds rendering as `10.5s`, now render as `10s`.

To preserve sub-second precision in custom duration formatters, enable `formatSubMilliseconds`.

### Cache warmup authenticates via SUPERSET_CACHE_WARMUP_USER

The `cache-warmup` Celery task now drives a real WebDriver session for reliable authentication and reads the user to authenticate as from the new `SUPERSET_CACHE_WARMUP_USER` config option. It no longer consults `CACHE_WARMUP_EXECUTORS` for the warmup path. `SUPERSET_CACHE_WARMUP_USER` defaults to `None`, so the task fails fast with a clear message until you set it. Operators who previously relied on `CACHE_WARMUP_EXECUTORS` for cache warmup must set `SUPERSET_CACHE_WARMUP_USER` to a dedicated least-privilege user with access to the dashboards they want warmed up before the next warmup run.

### YDB now uses a native sqlglot dialect

YDB SQL parsing now relies on the dedicated [`ydb-sqlglot-plugin`](https://pypi.org/project/ydb-sqlglot-plugin/) dialect, which registers itself with sqlglot automatically. YDB users must install this plugin (e.g., via `pip install "apache-superset[ydb]"`) to avoid a `ValueError` when Superset parses YDB queries.

### Embedded dashboards enforce configured Allowed Domains for postMessage

The embedded dashboard page now validates the origin of incoming `postMessage` events against the dashboard's configured **Allowed Domains**. The server-rendered embedded page exposes the configured domains in its bootstrap payload, and the frontend rejects message events whose origin is not in that list.

Enforcement only applies when the Allowed Domains list is non-empty. If the list is empty (the default), any origin is accepted, so there is no behavior change for embeds that did not configure Allowed Domains.

### Default guest/async JWT secrets are rejected at startup

Superset already refuses to start in production (non-debug, non-testing) when `SECRET_KEY` is left at its built-in default, and when `GUEST_TOKEN_JWT_SECRET` is left at its default while `EMBEDDED_SUPERSET` is enabled. This behavior is extended to `GLOBAL_ASYNC_QUERIES_JWT_SECRET`: if the `GLOBAL_ASYNC_QUERIES` feature flag is enabled and the secret is still the publicly known default (`test-secret-change-me`), Superset logs a clear error and refuses to start.

As with the existing `SECRET_KEY` check, this only fails in production. In debug mode, testing mode, or under the test runner, a warning is logged instead of exiting, so local development is unaffected.

To resolve the error, set a strong random value in `superset_config.py`:

```python
GLOBAL_ASYNC_QUERIES_JWT_SECRET = "<output of: openssl rand -base64 42>"
```

The check is only active when the relevant feature is enabled, so deployments that do not use global async queries (or embedding) are not affected.

### Guest token revocation (opt-in)

Embedded guest tokens can be coarsely revoked at runtime via a new opt-in mechanism. A new config flag `GUEST_TOKEN_REVOCATION_ENABLED` (default `False`) gates the feature. When enabled, every minted guest token carries a revocation version, and tokens whose version is below the current expected version (stored in the metadata database) are rejected at validation time.

Bump the expected version with the new CLI command to invalidate all outstanding guest tokens:

```bash
superset revoke-guest-tokens
```

This change is backward compatible. The feature is off by default, and even when enabled nothing is revoked until an admin explicitly bumps the version: the expected version starts at `0`, and tokens minted before this change (which carry no version claim) are treated as version `0`. No database migration is required.

### Sessions are terminated when an account is disabled

Disabling a user account (setting `active` to `False`, via the admin UI, REST API, or CLI) now terminates that user's outstanding sessions on their next request, instead of relying on a passive check. This works for both client-side cookie sessions and server-side session stores via a per-user invalidation epoch (`user_attribute.sessions_invalidated_at`, added by a migration). The mechanism is inert for users that were never disabled (NULL epoch), so there is no behavior change for active users. Re-enabling an account and logging in again starts a fresh, valid session. The migration backfills the epoch for accounts that are already disabled at upgrade time, so re-enabling such an account does not revive a session that predates this feature.

### Opt-in SSH tunnel server host key verification

SSH tunnels can now optionally pin the expected SSH server host key as a defense-in-depth measure against man-in-the-middle attacks. paramiko's transport performs no known-hosts checking by default, so previously the SSH server's identity was not verified. This feature is opt-in and off by default; existing tunnels are unaffected.

- A new nullable `server_host_key` column on the `ssh_tunnels` table stores the expected host key in authorized-key form (e.g. `ssh-ed25519 AAAA...`). It is a public key and is stored in plaintext. It can be set via the SSH tunnel POST/PUT payloads (`ssh_tunnel.server_host_key`).
- When a tunnel has `server_host_key` set, Superset connects to the SSH server, reads the host key it presents, and rejects the tunnel if it does not match.
- A new config flag `SSH_TUNNEL_STRICT_HOST_KEY_CHECKING` (default `False`) controls fail-closed behavior. When `True`, every tunnel must declare a `server_host_key`; a tunnel without one is rejected.

Runbook to adopt:

1. Capture the SSH server's host key, e.g. `ssh-keyscan -t ed25519 ssh.example.com` (verify it out-of-band).
2. Set that value on the tunnel's `server_host_key` (via the database/SSH tunnel API or UI payload).
3. Optionally set `SSH_TUNNEL_STRICT_HOST_KEY_CHECKING = True` in `superset_config.py` to require host-key verification on all tunnels.

### SMTP server certificate validation enabled by default

`SMTP_SSL_SERVER_AUTH` now defaults to `True` (previously `False`). With this default, STARTTLS/SSL connections to the configured SMTP server validate the server's TLS certificate against the system trusted CA store. This makes outbound email (alerts and reports) verify the mail server's identity out of the box.

If your SMTP server presents a self-signed certificate, or a certificate that is not trusted by the system CA store, email delivery may now fail with a certificate verification error. To restore the previous behavior of skipping certificate validation, set the following in `superset_config.py`:

```python
SMTP_SSL_SERVER_AUTH = False
```

The recommended fix is to add the SMTP server's certificate (or its issuing CA) to the system trust store rather than disabling validation.

### Dataset import validates catalog against the target connection

Importing a dataset now validates the `catalog` field against the target database connection. When the connection has multi-catalog disabled (`allow_multi_catalog` off) and the dataset's catalog is not the connection's default catalog, the import fails instead of silently persisting the non-default catalog. This matches the validation already enforced on the dataset update path and prevents imported datasets from querying an unintended database.

If you relied on importing datasets with a non-default catalog, enable "Allow changing catalogs" on the target connection, or set the dataset's catalog to the connection's default before importing.

### Extension supply-chain controls (denylist + version policy)

Two opt-in static gates control which extensions are allowed to load:

- `EXTENSION_DENYLIST` refuses extensions matching an id (every version) or `id@version` (a single version), e.g. `["compromised-extension", "other-ext@1.2.3"]`.
- `EXTENSION_VERSION_POLICY` enforces a minimum version per extension id, e.g. `{"acme.widget": "1.2.0"}` (PEP 440 comparison); a release below the minimum is refused.

Both default to empty (no behavior change). They apply to both the `LOCAL_EXTENSIONS` and `EXTENSIONS_PATH` load paths.

### Dynamic Group By respects the sort toggle for display values

The Dynamic Group By chart customization now orders its display values according to the "Sort display control values" toggle: ascending (A–Z), descending (Z–A), or the dataset's source order when the toggle is unset. Previously the dropdown always sorted alphabetically. Existing dashboards where the toggle was never set will show options in source order instead of A–Z; open the customization and enable the toggle to restore alphabetical ordering.

### Selectable encryption engine for app-encrypted fields (AES-GCM)

App-encrypted fields (database passwords, SSH tunnel credentials, OAuth tokens, etc.) can now use authenticated **AES-GCM** encryption instead of the historical unauthenticated **AES-CBC**. A new config selects the engine for the default adapter:

```python
# "aes" (AES-CBC, historical default) | "aes-gcm" (authenticated, recommended for new installs)
SQLALCHEMY_ENCRYPTED_FIELD_ENGINE = "aes"
```

**No action required / no behavior change:** the default remains `"aes"`, so existing installs are unaffected.

**Opting in on an existing install:** flipping the engine on a populated database without re-encrypting first will make stored secrets undecryptable, because the two ciphertext formats are not compatible. A migrator is provided. Recommended runbook:

1. Take a metadata-DB backup.
2. Re-encrypt existing secrets into the new engine (the `SECRET_KEY` is unchanged):
   ```bash
   superset re-encrypt-secrets --engine aes-gcm
   ```
3. Set `SQLALCHEMY_ENCRYPTED_FIELD_ENGINE = "aes-gcm"` in your config.
4. Restart Superset.
5. Re-run the migrator once more after the restart:
   ```bash
   superset re-encrypt-secrets --engine aes-gcm
   ```
   A live instance keeps writing *new* secrets as AES-CBC during the window between step 2 and the restart in step 4; this second pass sweeps those up (it is idempotent, so already-migrated values are skipped).

Schedule the cutover in a quiet window. Runtime reads use only the single configured engine, so in a multi-worker deployment there is an unavoidable brief decrypt-outage between the migration commit and the last worker restarting with the new config — each migrator run is transactional, but the fleet-wide cutover is not zero-downtime.

The migration is transactional (all-or-nothing) and idempotent — it can be safely re-run or resumed. Note that AES-GCM, unlike AES-CBC, does not support querying directly over encrypted columns; audit any code that filters on an encrypted column before switching. See the SIP at `docs/sip/authenticated-encryption-at-rest.md` for details.

### Soft delete and restore for datasets

**The soft-delete behavior in this section applies only when the `SOFT_DELETE` feature flag is enabled. The flag defaults to `False`** (`@lifecycle: development`), so on a default deployment `DELETE /api/v1/dataset/<id>` continues to **hard-delete permanently** — nothing is recoverable. Enable `SOFT_DELETE` to get the behavior described below.

**Flag-toggle caveat:** the soft-delete visibility filter is evaluated per query while the flag is on. If datasets are soft-deleted during a flag-on window and the flag is later turned **off**, those rows reappear as live datasets in all lists, lookups, and relationship loads (including charts that reference them). The `POST /<uuid>/restore` endpoint and the `dataset_deleted_state` list filter remain functional regardless of the flag, deliberately, so rows soft-deleted during a flag-on window stay discoverable and restorable after a rollback of the flag.

**Flag-independent parts of this work** (active even with `SOFT_DELETE` off): the restore endpoint and deleted-state filter (above); the database-deletion guard counting soft-deleted datasets; the `get_or_create_dataset` soft-deleted-twin pre-check; the combined datasource listing (`GET /api/v1/datasource/...`) always excluding soft-deleted datasets; and the two uniqueness-validation changes documented at the end of this section. Everything else — the soft DELETE itself and the visibility filtering — is flag-gated.

With the flag enabled: `DELETE /api/v1/dataset/<id>` no longer hard-deletes the dataset (the bulk-delete endpoint behaves the same way). The row is marked with a `deleted_at` timestamp and hidden from all list, detail, and lookup endpoints. Datasets in this state are excluded from default queries and from relationship loads (e.g. `database.tables`).

**No cascade in v1.** Soft-delete does not propagate to dependent charts or dashboards: they remain visible. Loading a chart whose dataset is soft-deleted surfaces a "datasource not found" error at chart-load time. Restore the dataset to recover.

**Database deletion is blocked by soft-deleted datasets.** Superset already refuses to delete a database that still has datasets (`DatabaseDeleteDatasetsExistFailedError`); that check now explicitly counts soft-deleted datasets too (it bypasses the visibility filter), since the soft-deleted `tables` rows still reference the database via `database_id` and must not be orphaned. Consequence: because dataset `DELETE` is soft and v1 ships no hard-delete/purge, **a database that has ever had datasets cannot be deleted through the API once those datasets are soft-deleted** — the rows remain and keep blocking the delete. Until a purge capability lands, operators who must remove such a database have to hard-delete the underlying `tables` rows out-of-band first. This is a deliberate trade-off (no orphaned rows / restorable datasets) and is expected to be resolved by the planned purge work.

**Side-effect change for operators.** Because the row is no longer physically deleted, FAB `ab_view_menu` / permission-view rows tied to the dataset are also preserved. Downstream automation that relied on `DELETE /api/v1/dataset/<id>` cleaning up those rows must now react to the new `POST /api/v1/dataset/<uuid>/restore` lifecycle, or call the eventual hard-delete endpoint.

**New endpoint** — `POST /api/v1/dataset/<uuid>/restore` clears `deleted_at` and returns the dataset to active state. Requires `can_write on Dataset` and editorship of the row (or admin). Soft-deleted datasets can also be surfaced in the list endpoint via the new `dataset_deleted_state` rison filter: `include` returns both live and soft-deleted rows, `only` returns just the soft-deleted ones. Any other value is ignored. For non-admin users, soft-deleted rows are limited to datasets they can edit — the same audience that can restore them.

**Permissions migration:** existing role grants of `can_write on Dataset` cover the new restore endpoint automatically; no role migration is required.

**Schema migration:** the migration adds a nullable `deleted_at` column and an index on it (`ix_tables_deleted_at`) to the `tables` table. The column add is instant; the index build runs inline (no `CONCURRENTLY`) and may briefly block writes on the `tables` table (INSERT/UPDATE/DELETE are queued while the index builds; reads are unaffected) on large Postgres deployments. MySQL InnoDB builds the index online (no blocking). Production deployments with many thousands of datasets should run this migration during a maintenance window.

**Rollback note:** if the application code is rolled back after datasets have been soft-deleted, the older code path's visibility filter no longer applies and previously hidden rows become visible to the older code. Pair the rollback with a data decision (restore the rows, hard-delete them, or also downgrade the migration) rather than assuming the old hard-delete semantics still hold. **Downgrading the migration destroys the deletion markers**: `downgrade()` drops the `deleted_at` column, so any not-yet-restored soft-deleted datasets silently become live, active datasets with no record they were ever deleted. Reconcile the trash (restore or hard-delete each row) *before* downgrading, and disable the `SOFT_DELETE` flag first so no new soft deletes land mid-rollback.

**SQL Lab / dataset-creation flows:** creating a dataset over a table whose dataset sits in the trash is refused. The SQL Lab "save as dataset" flow (`get_or_create_dataset`) and file uploads return a **422 naming the hidden twin and the restore endpoint**; the plain create, update, and duplicate paths currently fail with the generic "already exists" 422. In all cases the remediation is the same: restore the hidden dataset (or use a different table name). Perm-string maintenance also covers hidden rows: renaming a database rewrites `perm`/`schema_perm`/`catalog_perm` on soft-deleted datasets and their charts, so a later restore does not resurrect stale permission strings.

**Importer behavior:** importing a dataset YAML whose UUID matches an existing **soft-deleted** dataset is treated as an implicit restore-with-update — **and this happens even when `overwrite` is not set**. This is a deliberate asymmetry with active rows: an active dataset imported without `overwrite=true` is returned unchanged, but a soft-deleted UUID match is restored *and* has the upload's contents applied regardless of the `overwrite` argument, on the reasoning that re-importing a deleted dataset's exact UUID is an explicit request to bring it back. The restore preserves the original PK, the chart back-reference, `table_columns`, and `sql_metrics`. Non-editors get `ImportFailedError`. Callers without `can_write` get `ImportFailedError` instead of silently receiving the soft-deleted row.

**Uniqueness-validation changes that apply regardless of the feature flag:** two dataset uniqueness checks were tightened alongside this work and are active even with `SOFT_DELETE` off. (1) Create/update uniqueness treats a dataset whose `catalog` is `NULL` as belonging to the database's default catalog, so a legacy twin pair (`catalog=NULL` vs. `catalog=<default>`, same database/schema/name) that older versions allowed now fails validation with "already exists" when either row is edited — resolve by renaming or removing one of the twins. (2) Duplicating a dataset now checks name collisions scoped to the target (database, catalog, schema) instead of globally by name alone: duplicates into other databases that were previously blocked are now allowed.

### Soft delete and restore for charts

**Everything in this section applies only when the `SOFT_DELETE` feature flag is enabled. The flag defaults to `False`** (`@lifecycle: development`), so on a default deployment `DELETE /api/v1/chart/<id>` continues to **hard-delete permanently** — nothing is recoverable. Enable `SOFT_DELETE` to get the behavior described below.

**Flag-toggle caveat:** the soft-delete visibility filter is evaluated per query while the flag is on. If charts are soft-deleted during a flag-on window and the flag is later turned **off**, those rows reappear as live charts in all lists, lookups, and relationship loads (including dashboards that contained them). The `POST /<uuid>/restore` endpoint and the `chart_deleted_state` list filter remain functional regardless of the flag, deliberately, so rows soft-deleted during a flag-on window stay discoverable and restorable after a rollback of the flag.

With the flag enabled: `DELETE /api/v1/chart/<id>` no longer hard-deletes the chart (the bulk-delete endpoint behaves the same way). The row is marked with a `deleted_at` timestamp and hidden from all list, detail, and lookup endpoints. Charts in this state are excluded from default queries and from relationship loads (e.g. `dashboard.slices`).

**Operational notes:** a report schedule whose target chart is soft-deleted now fails its runs with an explicit error ("The chart this report targets was deleted...") until the chart is restored or the report re-pointed — chart deletion is blocked while a report references the chart, but a validate/commit race or a flag toggle can still produce this state. Dashboards **preserve** their membership rows for soft-deleted charts: saving a dashboard does not sever a trashed member, and restoring the chart re-attaches it to its dashboards.

**New endpoint** — `POST /api/v1/chart/<uuid>/restore` clears `deleted_at` and returns the chart to active state. Requires `can_write on Chart` and editorship of the row (or admin). Soft-deleted charts can also be surfaced in the list endpoint via the new `chart_deleted_state` rison filter: `include` returns both live and soft-deleted rows, `only` returns just the soft-deleted ones. Any other value is ignored. For non-admin users, soft-deleted rows are limited to charts they can edit — the same audience that can restore them.

**Permissions migration:** existing role grants of `can_write on Chart` cover the new restore endpoint automatically; no role migration is required.

**Schema migration:** the migration adds a nullable `deleted_at` column and an index on it (`ix_slices_deleted_at`) to the `slices` table. The column add is instant; the index build runs inline (no `CONCURRENTLY`) and may briefly block writes on the `slices` table (INSERT/UPDATE/DELETE are queued while the index builds; reads are unaffected) on large Postgres deployments. MySQL InnoDB builds the index online (no blocking).

**Rollback note:** if the application code is rolled back after charts have been soft-deleted, the older code path's visibility filter no longer applies and previously hidden rows become visible to the older code. Pair the rollback with a data decision (restore the rows, hard-delete them, or also downgrade the migration) rather than assuming the old hard-delete semantics still hold. **Downgrading the migration destroys the deletion markers**: `downgrade()` drops the `deleted_at` column, so any not-yet-restored soft-deleted charts silently become live, active charts with no record they were ever deleted. Reconcile the trash (restore or hard-delete each row) *before* downgrading, and disable the `SOFT_DELETE` flag first so no new soft deletes land mid-rollback.

**Importer behavior:** importing a chart YAML whose UUID matches an existing **soft-deleted** chart is treated as an implicit restore-with-update — **and this happens even when `overwrite` is not set**. This is a deliberate asymmetry with active rows: an active chart imported without `overwrite=true` is returned unchanged, but a soft-deleted UUID match is restored *and* has the upload's contents applied regardless of the `overwrite` argument, on the reasoning that re-importing a deleted chart's exact UUID is an explicit request to bring it back. The restore preserves the original PK and all out-of-archive references (`dashboard_slices` junctions, `report.chart_id`, tag rows). The operation is permission-gated: non-editors get `ImportFailedError`, and callers without `can_write` get `ImportFailedError` instead of silently receiving the soft-deleted row.

- [39914](https://github.com/apache/superset/pull/39914) `ALERT_REPORT_SLACK_V2` now defaults to `True` and the legacy Slack v1 integration (`Slack` recipient type, `files.upload` API) is deprecated for removal in the next major. Slack blocked new apps from `files.upload` in May 2024 and fully retired the method for all apps on November 12, 2025; because the v1 path sends files through `files.upload`, v1 file-bearing sends now fail at the API level — only text-only `chat_postMessage` still works via the legacy path. Grant your Slack bot the `channels:read` and `groups:read` scopes so existing `Slack` recipients can be auto-upgraded to `SlackV2` on next send. Operators who explicitly override the flag to `False`, or whose Slack bot is missing those scopes, will see deprecation warnings while text-only sends continue through the legacy path.

### Soft delete and restore for dashboards

**Everything in this section applies only when the `SOFT_DELETE` feature flag is enabled. The flag defaults to `False`** (`@lifecycle: development`), so on a default deployment `DELETE /api/v1/dashboard/<id>` continues to **hard-delete permanently** — nothing is recoverable. Enable `SOFT_DELETE` to get the behavior described below.

**Flag-toggle caveat:** the soft-delete visibility filter is evaluated per query while the flag is on. If dashboards are soft-deleted during a flag-on window and the flag is later turned **off**, those rows reappear as live dashboards in all lists and lookups (including slug lookups — if a soft-deleted dashboard's slug was reused while the flag was on, both rows become visible with the same slug). The `POST /<uuid>/restore` endpoint and the `dashboard_deleted_state` list filter remain functional regardless of the flag, deliberately, so rows soft-deleted during a flag-on window stay discoverable and restorable after a rollback of the flag.

With the flag enabled: `DELETE /api/v1/dashboard/<id>` no longer hard-deletes the dashboard (the bulk-delete endpoint behaves the same way). The row is marked with a `deleted_at` timestamp and hidden from the dashboard API's list, detail, and lookup endpoints, which return 404 for soft-deleted dashboards. The embedded-dashboard iframe URL (`/embedded/<uuid>`) keeps rendering because it reads only `embedded.allowed_domains` and `embedded.dashboard_id` (the FK column) without dereferencing the parent dashboard; the frontend's subsequent dashboard-API fetch is what sees the 404 and surfaces "dashboard not found" to the user.

**New endpoint** — `POST /api/v1/dashboard/<uuid>/restore` clears `deleted_at` and returns the dashboard to active state. Requires `can_write on Dashboard` and editorship of the row (or admin). Soft-deleted dashboards can also be surfaced in the list endpoint via the new `dashboard_deleted_state` rison filter: `include` returns both live and soft-deleted rows, `only` returns just the soft-deleted ones. Any other value is ignored. For non-admin users, soft-deleted rows are limited to dashboards they can edit — the same audience that can restore them.

**Permissions migration:** existing role grants of `can_write on Dashboard` cover the new restore endpoint automatically; no role migration is required.

**Schema migration:** the migration adds a nullable `deleted_at` column and an index on it (`ix_dashboards_deleted_at`) to the `dashboards` table, and **replaces the full unique constraint on `slug`** with a partial unique index (`ix_dashboards_active_slug`) enforcing slug uniqueness only among active (non-soft-deleted) rows. The column add is instant. On Postgres the constraint swap briefly blocks reads and writes during `ALTER TABLE ... DROP CONSTRAINT` (acquires `ACCESS EXCLUSIVE`), then blocks writes only during `CREATE UNIQUE INDEX` (acquires `ShareLock`); reads pass through during the index build. Both windows are sub-second on a typical `dashboards` table. MySQL InnoDB builds the functional index online (no blocking).

**Rollback note:** the downgrade restores the original full unique constraint on `slug`. If the partial-index window allowed slug reuse (a soft-deleted row and an active row holding the same slug), `ALTER TABLE ... ADD CONSTRAINT idx_unique_slug UNIQUE (slug)` will abort with a unique-constraint violation. Before downgrading, hard-delete the soft-deleted duplicates (or rename one side) so each slug appears at most once across all rows. Rolling back the application code while leaving the new migration in place is also possible but exposes soft-deleted rows to the older code path; pair the rollback with a data decision (restore, hard-delete, or migrate-down).

The partial-index replacement is dialect-dependent: PostgreSQL uses a native `WHERE deleted_at IS NULL` partial index; MySQL 8.0.13+ uses a functional index over `(CASE WHEN deleted_at IS NULL THEN slug END)` (8.0.13 is the first release with functional key parts). **MySQL <8.0.13, MariaDB, and SQLite keep the original full unique constraint** (functional indexes / column-level UNIQUE recreation aren't supported cleanly — MariaDB is excluded even at 10.x because its `CASE`-expression index semantics differ), so on those backends a soft-deleted dashboard continues to reserve its slug for the lifetime of the row.

**Slug semantics:** on PostgreSQL and MySQL 8.0.13+, the slug of a soft-deleted dashboard is **free for reuse**. A new active dashboard can claim it immediately. Restoring a soft-deleted dashboard whose slug has since been claimed returns **422 with a clean error** (`DashboardSlugConflictError`) — rename one of the dashboards and retry; the restore is not silently rejected by a database-level constraint violation.

**Importer behavior:** importing a dashboard YAML whose UUID matches an existing **soft-deleted** dashboard is treated as an implicit restore-with-update — **and this happens even when `overwrite` is not set**. This is a deliberate asymmetry with active rows: an active dashboard imported without `overwrite=true` is returned unchanged (the import never mutates it), but a soft-deleted UUID match is restored *and* has the upload's contents applied regardless of the `overwrite` argument, on the reasoning that re-importing a deleted dashboard's exact UUID is an explicit request to bring it back. The restore preserves the original PK and all pre-deletion relationship rows (`dashboard_slices` junctions, editor/viewer subjects, tags). Callers whose imports must never mutate existing state should treat bundles that may contain previously deleted UUIDs accordingly. The operation is permission-gated: it requires `can_write` and editorship of the deleted row (or admin) — non-editors get `ImportFailedError`, and callers without `can_write` get `ImportFailedError` instead of silently receiving the soft-deleted row.

### Granular Export Controls

A new feature flag `GRANULAR_EXPORT_CONTROLS` introduces three fine-grained permissions that replace the legacy `can_csv` permission:

| Permission | Controls |
|---|---|
| `can_export_data` | CSV, Excel, JSON exports |
| `can_export_image` | Screenshot/PDF exports |
| `can_copy_clipboard` | Copy-to-clipboard operations |

When the feature flag is enabled, these permissions are enforced on both the frontend (disabled buttons with tooltips) and backend (403 responses from API endpoints). When disabled, legacy `can_csv` behavior is preserved.

**Migration behavior:** All three new permissions are granted to every role that currently has `can_csv`, preserving existing access. Admins can then selectively revoke individual export permissions from specific roles as needed.

### Deck.gl MapBox viewport and opacity controls are functional

The Deck.gl MapBox chart's **Opacity**, **Default longitude**, **Default latitude**, and **Zoom** controls were previously non-functional — changing them had no effect on the rendered map. These controls are now wired up correctly.

**Behavior change for existing charts:** Previously, the viewport controls had hard-coded default values (`-122.405293`, `37.772123`, zoom `11` — San Francisco) that were stored in each chart's `form_data` but never applied. The map always used `fitBounds` to center on the data. With this fix, those stored values are now respected, which means existing MapBox charts may open centered on the old default coordinates instead of fitting to data bounds.

**To restore fit-to-data behavior:** Open the chart in Explore, clear the **Default longitude**, **Default latitude**, and **Zoom** fields in the Viewport section, and re-save the chart.

### Combined datasource list endpoint

Added a new combined datasource list endpoint at `GET /api/v1/datasource/` to serve datasets and semantic views in one response.

- The endpoint is available to users with at least one of `can_read` on `Dataset` or `SemanticView`.
- Semantic views are included only when the `SEMANTIC_LAYERS` feature flag is enabled.
- The endpoint enforces strict `order_column` validation and returns `400` for invalid sort columns.

## 6.1.0

### ClickHouse minimum driver version bump

The minimum required version of `clickhouse-connect` has been raised to `>=0.13.0`. If you are using the ClickHouse connector, please upgrade your `clickhouse-connect` package. The `_mutate_label` workaround that appended hash suffixes to column aliases has also been removed, as it is no longer needed with modern versions of the driver.

### MCP Tool Observability

MCP (Model Context Protocol) tools now include enhanced observability instrumentation for monitoring and debugging:

**Two-layer instrumentation:**
1. **Middleware layer** (`LoggingMiddleware`): Automatically logs all MCP tool calls with `duration_ms` and `success` status in the audit log (Action Log UI, logs table)
2. **Sub-operation tracking**: All 19 MCP tools include granular `event_logger.log_context()` blocks for tracking individual operations like validation, database writes, and query execution

**Action naming convention:**
- Tool-level logs: `mcp_tool_call` (via middleware)
- Sub-operation logs: `mcp.{tool_name}.{operation}` (e.g., `mcp.generate_chart.validation`, `mcp.execute_sql.query_execution`)

**Querying MCP logs:**
```sql
-- Top slowest MCP operations
SELECT action, COUNT(*) as calls, AVG(duration_ms) as avg_ms
FROM logs
WHERE action LIKE 'mcp.%'
GROUP BY action
ORDER BY avg_ms DESC
LIMIT 20;

-- MCP tool success rate
SELECT
    json_extract(curated_payload, '$.tool') as tool,
    COUNT(*) as total_calls,
    SUM(CASE WHEN json_extract(curated_payload, '$.success') = 'true' THEN 1 ELSE 0 END) as successful,
    ROUND(100.0 * SUM(CASE WHEN json_extract(curated_payload, '$.success') = 'true' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM logs
WHERE action = 'mcp_tool_call'
GROUP BY tool
ORDER BY total_calls DESC;
```

**Security note:** Sensitive parameters (passwords, API keys, tokens) are automatically redacted in logs as `[REDACTED]`.

### Distributed Coordination Backend

A new `DISTRIBUTED_COORDINATION_CONFIG` configuration provides a unified Redis-based backend for real-time coordination features in Superset. This backend enables:

- **Pub/sub messaging** for real-time event notifications between workers
- **Atomic distributed locking** using Redis SET NX EX (more performant than database-backed locks)
- **Event-based coordination** for background task management

The distributed coordination is used by the Global Task Framework (GTF) for abort notifications and task completion signaling, and will eventually replace `GLOBAL_ASYNC_QUERIES_CACHE_BACKEND` as the standard signaling backend. Configuring this is recommended for Redis enabled production deployments.

Example configuration in `superset_config.py`:
```python
DISTRIBUTED_COORDINATION_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_KEY_PREFIX": "signal_",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
    "CACHE_DEFAULT_TIMEOUT": 300,
}
```

See `superset/config.py` for complete configuration options.

### WebSocket config for GAQ with Docker

[35896](https://github.com/apache/superset/pull/35896) and [37624](https://github.com/apache/superset/pull/37624) updated documentation on how to run and configure Superset with Docker. Specifically for the WebSocket configuration, a new `docker/superset-websocket/config.example.json` was added to the repo, so that users could copy it to create a `docker/superset-websocket/config.json` file. The existing `docker/superset-websocket/config.json` was removed and git-ignored, so if you're using GAQ / WebSocket make sure to:
- Stash/backup your existing `config.json` file, to re-apply it after (will get git-ignored going forward)
- Update the `volumes` configuration for the `superset-websocket` service in your `docker-compose.override.yml` file, to include the `docker/superset-websocket/config.json` file. For example:
``` yaml
services:
  superset-websocket:
    volumes:
      - ./superset-websocket:/home/superset-websocket
      - /home/superset-websocket/node_modules
      - /home/superset-websocket/dist
      - ./docker/superset-websocket/config.json:/home/superset-websocket/config.json:ro
```

### Example Data Loading Improvements

#### New Directory Structure
Examples are now organized by name with data and configs co-located:
```
superset/examples/
├── _shared/              # Shared database & metadata configs
├── birth_names/          # Each example is self-contained
│   ├── data.parquet     # Dataset (Parquet format)
│   ├── dataset.yaml     # Dataset metadata
│   ├── dashboard.yaml   # Dashboard config (optional)
│   └── charts/          # Chart configs (optional)
└── ...
```

#### Simplified Parquet-based Loading
- Auto-discovery: create `superset/examples/my_dataset/data.parquet` to add a new example
- Parquet is an Apache project format: compressed (~27% smaller), self-describing schema
- YAML configs define datasets, charts, and dashboards declaratively
- Removed Python-based data generation from individual example files

#### Test Data Reorganization
- Moved `big_data.py` to `superset/cli/test_loaders.py` - better reflects its purpose as a test utility
- Fixed inverted logic for `--load-test-data` flag (now correctly includes .test.yaml files when flag is set)
- Clarified CLI flags:
  - `--force` / `-f`: Force reload even if tables exist
  - `--only-metadata` / `-m`: Create table metadata without loading data
  - `--load-test-data` / `-t`: Include test dashboards and .test.yaml configs
  - `--load-big-data` / `-b`: Generate synthetic stress-test data

#### Bug Fixes
- Fixed numpy array serialization for PostgreSQL (converts complex types to JSON strings)
- Fixed KeyError for `allow_csv_upload` field in database configs (now optional with default)
- Fixed test data loading logic that was incorrectly filtering files

### MCP Service

The MCP (Model Context Protocol) service enables AI assistants and automation tools to interact programmatically with Superset.

#### New Features
- MCP service infrastructure with FastMCP framework
- Tools for dashboards, charts, datasets, SQL Lab, and instance metadata
- Optional dependency: install with `pip install apache-superset[fastmcp]`
- Runs as separate process from Superset web server
- JWT-based authentication for production deployments

#### New Configuration Options

**Development** (single-user, local testing):
```python
# superset_config.py
MCP_DEV_USERNAME = "admin"  # User for MCP authentication
MCP_SERVICE_HOST = "localhost"
MCP_SERVICE_PORT = 5008
```

**Production** (JWT-based, multi-user):
```python
# superset_config.py
MCP_AUTH_ENABLED = True
MCP_JWT_ISSUER = "https://your-auth-provider.com"
MCP_JWT_AUDIENCE = "superset-mcp"
MCP_JWT_ALGORITHM = "RS256"  # or "HS256" for shared secrets

# Option 1: Use JWKS endpoint (recommended for RS256)
MCP_JWKS_URI = "https://auth.example.com/.well-known/jwks.json"

# Option 2: Use static public key (RS256)
MCP_JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----..."

# Option 3: Use shared secret (HS256)
MCP_JWT_ALGORITHM = "HS256"
MCP_JWT_SECRET = "your-shared-secret-key"

# Optional overrides
MCP_SERVICE_HOST = "0.0.0.0"
MCP_SERVICE_PORT = 5008
MCP_SESSION_CONFIG = {
    "SESSION_COOKIE_SECURE": True,
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SAMESITE": "Strict",
}
```

#### Running the MCP Service

```bash
# Development
superset mcp run --port 5008 --debug

# Production
superset mcp run --port 5008

# With factory config
superset mcp run --port 5008 --use-factory-config
```

#### Deployment Considerations

The MCP service runs as a **separate process** from the Superset web server.

**Important**:
- Requires same Python environment and configuration as Superset
- Shares database connections with main Superset app
- Can be scaled independently from web server
- Requires `fastmcp` package (optional dependency)

**Installation**:
```bash
# Install with MCP support
pip install apache-superset[fastmcp]

# Or add to requirements.txt
apache-superset[fastmcp]>=X.Y.Z
```

**Process Management**:
Use systemd, supervisord, or Kubernetes to manage the MCP service process.
See `superset/mcp_service/PRODUCTION.md` for deployment guides.

**Security**:
- Development: Uses `MCP_DEV_USERNAME` for single-user access
- Production: **MUST** configure JWT authentication
- See `superset/mcp_service/SECURITY.md` for details

#### Documentation

- Architecture: `superset/mcp_service/ARCHITECTURE.md`
- Security: `superset/mcp_service/SECURITY.md`
- Production: `superset/mcp_service/PRODUCTION.md`
- Developer Guide: `superset/mcp_service/CLAUDE.md`
- Quick Start: `superset/mcp_service/README.md`

---

- [35621](https://github.com/apache/superset/pull/35621): The default hash algorithm has changed from MD5 to SHA-256 for improved security and FedRAMP compliance. This affects cache keys for thumbnails, dashboard digests, chart digests, and filter option names. Existing cached data will be invalidated upon upgrade. To opt out of this change and maintain backward compatibility, set `HASH_ALGORITHM = "md5"` in your `superset_config.py`.
- [35062](https://github.com/apache/superset/pull/35062): Changed the function signature of `setupExtensions` to `setupCodeOverrides` with options as arguments.

### Breaking Changes
- [37370](https://github.com/apache/superset/pull/37370): The `APP_NAME` configuration variable no longer controls the browser window/tab title or other frontend branding. Application names should now be configured using the theme system with the `brandAppName` token. The `APP_NAME` config is still used for backend contexts (MCP service, logs, etc.) and serves as a fallback if `brandAppName` is not set.
  - **Migration:**
  ```python
  # Before (Superset 5.x)
  APP_NAME = "My Custom App"

  # After (Superset 6.x) - Option 1: Use theme system (recommended)
  THEME_DEFAULT = {
    "token": {
      "brandAppName": "My Custom App",  # Window titles
      "brandLogoAlt": "My Custom App",  # Logo alt text
      "brandLogoUrl": "/static/assets/images/custom_logo.png"
    }
  }

  # After (Superset 6.x) - Option 2: Temporary fallback
  # Keep APP_NAME for now (will be used as fallback for brandAppName)
  APP_NAME = "My Custom App"
  # But you should migrate to THEME_DEFAULT.token.brandAppName
  ```
  - **Note:** For dark mode, set the same tokens in `THEME_DARK` configuration.

- [36317](https://github.com/apache/superset/pull/36317): The `CUSTOM_FONT_URLS` configuration option has been removed. Use the new per-theme `fontUrls` token in `THEME_DEFAULT` or database-managed themes instead.
  - **Before:**
  ```python
  CUSTOM_FONT_URLS = [
    "https://fonts.example.com/myfont.css",
  ]
  ```
  - **After:**
  ```python
  THEME_DEFAULT = {
    "token": {
      "fontUrls": [
        "https://fonts.example.com/myfont.css",
        ],
        # ... other tokens
    }
  }
  ```

### Composite primary keys on many-to-many association tables

Eight M:N association tables move from a synthetic `id INTEGER PRIMARY KEY` to a composite `PRIMARY KEY (fk1, fk2)` on their two foreign-key columns. The surrogate `id` is dropped, and the redundant `UNIQUE (fk1, fk2)` on the two tables that carried one is removed (now subsumed by the PK).

| Table | Composite PK |
|---|---|
| `dashboard_roles` | `(dashboard_id, role_id)` |
| `dashboard_slices` | `(dashboard_id, slice_id)` |
| `dashboard_user` | `(user_id, dashboard_id)` |
| `report_schedule_user` | `(user_id, report_schedule_id)` |
| `rls_filter_roles` | `(role_id, rls_filter_id)` |
| `rls_filter_tables` | `(table_id, rls_filter_id)` |
| `slice_user` | `(user_id, slice_id)` |
| `sqlatable_user` | `(user_id, table_id)` |

**Before upgrading:**

- The migration **deletes** two classes of pre-existing rows the composite PK cannot accommodate: duplicate `(fk1, fk2)` pairs (it keeps the lowest `id` and removes the rest) and rows with `NULL` in either FK column. Both are meaningless for `secondary=` association tables, but export the affected rows first if you need an audit record.
- External tooling (BI tools, backup scripts) that references the surrogate `id` on these tables will break; no application code references it.
- Downgrade restores the `id` column (and the original `UNIQUE` on the two tables that had it) but leaves the FK columns `NOT NULL` (intentional — a `NULL` FK in a junction row is meaningless).

For large `dashboard_slices` / `report_schedule_user` tables, see the operator runbook in [#39859](https://github.com/apache/superset/pull/39859) — pre-flight inventory queries, per-dialect lock-window sizing, and the duplicate / NULL-FK roll-up — to plan the maintenance window.

## 6.0.0
- [33055](https://github.com/apache/superset/pull/33055): Upgrades Flask-AppBuilder to 5.0.0. The AUTH_OID authentication type has been deprecated and is no longer available as an option in Flask-AppBuilder. OpenID (OID) is considered a deprecated authentication protocol - if you are using AUTH_OID, you will need to migrate to an alternative authentication method such as OAuth, LDAP, or database authentication before upgrading.
- [34871](https://github.com/apache/superset/pull/34871): Fixed Jest test hanging issue from Ant Design v5 upgrade. MessageChannel is now mocked in test environment to prevent rc-overflow from causing Jest to hang. Test environment only - no production impact.
- [34782](https://github.com/apache/superset/pull/34782): Dataset exports now include the dataset ID in their file name (similar to charts and dashboards). If managing assets as code, make sure to rename existing dataset YAMLs to include the ID (and avoid duplicated files).
- [34536](https://github.com/apache/superset/pull/34536): The `ENVIRONMENT_TAG_CONFIG` color values have changed to support only Ant Design semantic colors. Update your `superset_config.py`:
  - Change `"error.base"` to just `"error"` after this PR
  - Change any hex color values to one of: `"success"`, `"processing"`, `"error"`, `"warning"`, `"default"`
  - Custom colors are no longer supported to maintain consistency with Ant Design components
- [34561](https://github.com/apache/superset/pull/34561) Added tiled screenshot functionality for Playwright-based reports to handle large dashboards more efficiently. When enabled (default: `SCREENSHOT_TILED_ENABLED = True`), dashboards with 20+ charts or height exceeding 5000px will be captured using multiple viewport-sized tiles and combined into a single image. This improves report generation performance and reliability for large dashboards.
Note: Pillow is now a required dependency (previously optional) to support image processing for tiled screenshots.
`thumbnails` optional dependency is now deprecated and will be removed in the next major release (7.0).
- [33084](https://github.com/apache/superset/pull/33084) The DISALLOWED_SQL_FUNCTIONS configuration now includes additional potentially sensitive database functions across PostgreSQL, MySQL, SQLite, MS SQL Server, and ClickHouse. Existing queries using these functions may now be blocked. Review your SQL Lab queries and dashboards if you encounter "disallowed function" errors after upgrading
- [34235](https://github.com/apache/superset/pull/34235) CSV exports now use `utf-8-sig` encoding by default to include a UTF-8 BOM, improving compatibility with Excel.
- [34258](https://github.com/apache/superset/pull/34258) changing the default in Dockerfile to INCLUDE_CHROMIUM="false" (from "true") in the past. This ensures the `lean` layer is lean by default, and people can opt-in to the `chromium` layer by setting the build arg `INCLUDE_CHROMIUM=true`. This is a breaking change for anyone using the `lean` layer, as it will no longer include Chromium by default.
- [34204](https://github.com/apache/superset/pull/33603) OpenStreetView has been promoted as the new default for Deck.gl visualization since it can be enabled by default without requiring an API key. If you have Mapbox set up and want to disable OpenStreeView in your environment, please follow the steps documented here [https://superset.apache.org/docs/configuration/map-tiles].
- [33116](https://github.com/apache/superset/pull/33116) In Echarts Series charts (e.g. Line, Area, Bar, etc.) charts, the `x_axis_sort_series` and `x_axis_sort_series_ascending` form data items have been renamed with `x_axis_sort` and `x_axis_sort_asc`.
  There's a migration added that can potentially affect a significant number of existing charts.
- [32317](https://github.com/apache/superset/pull/32317) The horizontal filter bar feature is now out of testing/beta development and its feature flag `HORIZONTAL_FILTER_BAR` has been removed.
- [31590](https://github.com/apache/superset/pull/31590) Marks the beginning of intricate work around supporting dynamic Theming, and breaks support for [THEME_OVERRIDES](https://github.com/apache/superset/blob/732de4ac7fae88e29b7f123b6cbb2d7cd411b0e4/superset/config.py#L671) in favor of a new theming system based on AntD V5. Likely this will be in disrepair until settling over the 5.x lifecycle.
- [32432](https://github.com/apache/superset/pull/32432) Moves the List Roles FAB view to the frontend and requires `FAB_ADD_SECURITY_API` to be enabled in the configuration and `superset init` to be executed.
- [34319](https://github.com/apache/superset/pull/34319) Drill to Detail and Drill By is now supported in Embedded mode, and also with the `DASHBOARD_RBAC` FF. If you don't want to expose these features in Embedded / `DASHBOARD_RBAC`, make sure the roles used for Embedded / `DASHBOARD_RBAC`don't have the required permissions to perform D2D actions.

## 5.0.0

- [31976](https://github.com/apache/superset/pull/31976) Removed the `DISABLE_LEGACY_DATASOURCE_EDITOR` feature flag. The previous value of the feature flag was `True` and now the feature is permanently removed.
- [32000](https://github.com/apache/superset/pull/32000) Removes CSV_UPLOAD_MAX_SIZE config, use your web server to control file upload size.
- [31959](https://github.com/apache/superset/pull/31959) Removes the following endpoints from data uploads: `/api/v1/database/<id>/<file type>_upload` and `/api/v1/database/<file type>_metadata`, in favour of new one (Details on the PR). And simplifies permissions.
- [31844](https://github.com/apache/superset/pull/31844) The `ALERT_REPORTS_EXECUTE_AS` and `THUMBNAILS_EXECUTE_AS` config parameters have been renamed to `ALERT_REPORTS_EXECUTORS` and `THUMBNAILS_EXECUTORS` respectively. A new config flag `CACHE_WARMUP_EXECUTORS` has also been introduced to be able to control which user is used to execute cache warmup tasks. Finally, the config flag `THUMBNAILS_SELENIUM_USER` has been removed. To use a fixed executor for async tasks, use the new `FixedExecutor` class. See the config and docs for more info on setting up different executor profiles.
- [31894](https://github.com/apache/superset/pull/31894) Domain sharding is deprecated in favor of HTTP2. The `SUPERSET_WEBSERVER_DOMAINS` configuration will be removed in the next major version (6.0)
- [31794](https://github.com/apache/superset/pull/31794) Removed the previously deprecated `DASHBOARD_CROSS_FILTERS` feature flag
- [31774](https://github.com/apache/superset/pull/31774): Fixes the spelling of the `USE-ANALAGOUS-COLORS` feature flag. Please update any scripts/configuration item to use the new/corrected `USE-ANALOGOUS-COLORS` flag spelling.
- [31582](https://github.com/apache/superset/pull/31582) Removed the legacy Area, Bar, Event Flow, Heatmap, Histogram, Line, Sankey, and Sankey Loop charts. They were all automatically migrated to their ECharts counterparts with the exception of the Event Flow and Sankey Loop charts which were removed as they were not actively maintained and not widely used. If you were using the Event Flow or Sankey Loop charts, you will need to find an alternative solution.
- [31198](https://github.com/apache/superset/pull/31198) Disallows by default the use of the following ClickHouse functions: "version", "currentDatabase", "hostName".
- [29798](https://github.com/apache/superset/pull/29798) Since 3.1.0, the initial schedule for an alert or report was mistakenly offset by the specified timezone's relation to UTC. The initial schedule should now begin at the correct time.
- [30021](https://github.com/apache/superset/pull/30021) The `dev` layer in our Dockerfile no long includes firefox binaries, only Chromium to reduce bloat/docker-build-time.
- [30099](https://github.com/apache/superset/pull/30099) Translations are no longer included in the default docker image builds. If your environment requires translations, you'll want to set the docker build arg `BUILD_TRANSLATIONS=true`.
- [31262](https://github.com/apache/superset/pull/31262) NOTE: deprecated `pylint` in favor of `ruff` as our only python linter. Only affect development workflows positively (not the release itself). It should cover most important rules, be much faster, but some things linting rules that were enforced before may not be enforce in the exact same way as before.
- [31173](https://github.com/apache/superset/pull/31173) Modified `fetch_csrf_token` to align with HTTP standards, particularly regarding how cookies are handled. If you encounter any issues related to CSRF functionality, please report them as a new issue and reference this PR for context.
- [31413](https://github.com/apache/superset/pull/31413) Enable the DATE_FORMAT_IN_EMAIL_SUBJECT feature flag to allow users to specify a date format for the email subject, which will then be replaced with the actual date.
- [31385](https://github.com/apache/superset/pull/31385) Significant docker refactor, reducing access levels for the `superset` user, streamlining layer building, ...
- [31503](https://github.com/apache/superset/pull/31503) Deprecating python 3.9.x support, 3.11 is now the recommended version and 3.10 is still supported over the Superset 5.0 lifecycle.
- [29121](https://github.com/apache/superset/pull/29121) Removed the `css`, `position_json`, and `json_metadata` from the payload of the dashboard list endpoint (`GET api/v1/dashboard`) for performance reasons.
- [29163](https://github.com/apache/superset/pull/29163) Removed the `SHARE_QUERIES_VIA_KV_STORE` and `KV_STORE` feature flags and changed the way Superset shares SQL Lab queries to use permalinks. The legacy `/kv` API was removed but we still support legacy links in 5.0. In 6.0, only permalinks will be supported.
- [25166](https://github.com/apache/superset/pull/25166) Changed the default configuration of `UPLOAD_FOLDER` from `/app/static/uploads/` to `/static/uploads/`. It also removed the unused `IMG_UPLOAD_FOLDER` and `IMG_UPLOAD_URL` configuration options.
- [30284](https://github.com/apache/superset/pull/30284) Deprecated GLOBAL_ASYNC_QUERIES_REDIS_CONFIG in favor of the new GLOBAL_ASYNC_QUERIES_CACHE_BACKEND configuration. To leverage Redis Sentinel, set CACHE_TYPE to RedisSentinelCache, or use RedisCache for standalone Redis
- [31961](https://github.com/apache/superset/pull/31961) Upgraded React from version 16.13.1 to 17.0.2. If you are using custom frontend extensions or plugins, you may need to update them to be compatible with React 17.
- [31260](https://github.com/apache/superset/pull/31260) Docker images now use `uv pip install` instead of `pip install` to manage the python environment. Most docker-based deployments will be affected, whether you derive one of the published images, or have custom bootstrap script that install python libraries (drivers)

### Potential Downtime

## 4.1.2

- [31198](https://github.com/apache/superset/pull/31198) Disallows by default the use of the following ClickHouse functions: "version", "currentDatabase", "hostName".
- [31173](https://github.com/apache/superset/pull/31173) Modified `fetch_csrf_token` to align with HTTP standards, particularly regarding how cookies are handled. If you encounter any issues related to CSRF functionality, please report them as a new issue and reference this PR for context.

## 4.1.0

- [29274](https://github.com/apache/superset/pull/29274): We made it easier to trigger CI on your
  forks, whether they are public or private. Simply push to a branch that fits `[0-9].[0-9]*` and
  should run on your fork, giving you flexibility on naming your release branches and triggering
  CI
- [27505](https://github.com/apache/superset/pull/27505): We simplified the files under
  `requirements/` folder. If you use these files for your builds you may want to double
  check that your builds are not affected. `base.txt` should be the same as before, though
  `development.txt` becomes a bigger set, incorporating the now defunct local,testing,integration, and docker
- [27434](https://github.com/apache/superset/pull/27434/files): DO NOT USE our docker compose.\*
  files for production use cases! While we never really supported
  or should have tried to support docker compose for production use cases, we now actively
  have taken a stance against supporting it. See the PR for details.
- [24112](https://github.com/apache/superset/pull/24112): Python 3.10 is now the recommended python version to use, 3.9 still
  supported but getting deprecated in the nearish future. CI/CD runs on py310 so you probably want to align. If you
  use official dockers, upgrade should happen automatically.
- [27697](https://github.com/apache/superset/pull/27697) [minor] flask-session bump leads to them
  deprecating `SESSION_USE_SIGNER`, check your configs as this flag won't do anything moving
  forward.
- [27849](https://github.com/apache/superset/pull/27849/) More of an FYI, but we have a
  new config `SLACK_ENABLE_AVATARS` (False by default) that works in conjunction with
  set `SLACK_API_TOKEN` to fetch and serve Slack avatar links
- [28134](https://github.com/apache/superset/pull/28134/) The default logging level was changed
  from DEBUG to INFO - which is the normal/sane default logging level for most software.
- [27777](https://github.com/apache/superset/pull/27777) Moves debug logging logic to config.py.
  See `LOG_LEVEL` in `superset/config.py` for the recommended default.
- [28205](https://github.com/apache/superset/pull/28205) The permission `all_database_access` now
  more clearly provides access to all databases, as specified in its name. Before it only allowed
  listing all databases in CRUD-view and dropdown and didn't provide access to data as it
  seemed the name would imply.
- [28483](https://github.com/apache/superset/pull/28483) Starting with this version we bundle
  translations inside the python package. This includes the .mo files needed by pybabel on the
  backend, as well as the .json files used by the frontend. If you were doing anything before
  as part of your bundling to expose translation packages, it's probably not needed anymore.
- [29264](https://github.com/apache/superset/pull/29264) Slack has updated its file upload api, and we are now supporting this new api in Superset, although the Slack api is not backward compatible. The original Slack integration is deprecated and we will require a new Slack scope `channels:read` to be added to Slack workspaces in order to use this new api. In an upcoming release, we will make this new Slack scope mandatory and remove the old Slack functionality.
- [30274](https://github.com/apache/superset/pull/30274) Moved SLACK_ENABLE_AVATAR from config.py to the feature flag framework, please adapt your configs.

### Potential Downtime

- [27392](https://github.com/apache/superset/pull/27392): Adds an index to `query.sql_editor_id` to improve performance. This may cause downtime on large deployments.

## 4.0.0

- [27119](https://github.com/apache/superset/pull/27119): Updates various database columns to use the `MediumText` type, potentially requiring a table lock on MySQL dbs or taking some time to complete on large deployments.

- [26450](https://github.com/apache/superset/pull/26450): Deprecates the `KV_STORE` feature flag and its related assets such as the API endpoint and `keyvalue` table. The main dependency of this feature is the `SHARE_QUERIES_VIA_KV_STORE` feature flag which allows sharing SQL Lab queries without the necessity of saving the query. Our intention is to use the permalink feature to implement this use case before 5.0 and that's why we are deprecating the feature flag now.

### Breaking Changes

- [27130](https://github.com/apache/superset/pull/27130): Fixes the DELETE `/database/{id}/ssh_tunnel/` endpoint to now correctly accept a database ID as a parameter, rather than an SSH tunnel ID.
- [27117](https://github.com/apache/superset/pull/27117): Removes the following deprecated endpoints: `/superset/sqllab`, `/superset/sqllab/history`, `/sqllab/my_queries` use `/sqllab`, `/sqllab/history`, `/savedqueryview/list/?_flt_0_user={get_user_id()}` instead.
- [26347](https://github.com/apache/superset/issues/26347): Removes the deprecated `VERSIONED_EXPORT` feature flag. The previous value of the feature flag was `True` and now the feature is permanently enabled.
- [26328](https://github.com/apache/superset/issues/26328): Removes the deprecated Filter Box code and it's associated dependencies `react-select` and `array-move`. It also removes the `DeprecatedSelect` and `AsyncSelect` components that were exclusively used by filter boxes. Existing filter boxes will be automatically migrated to native filters.
- [26330](https://github.com/apache/superset/issues/26330): Removes the deprecated `DASHBOARD_FILTERS_EXPERIMENTAL` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26344](https://github.com/apache/superset/issues/26344): Removes the deprecated `ENABLE_EXPLORE_JSON_CSRF_PROTECTION` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26345](https://github.com/apache/superset/issues/26345): Removes the deprecated `ENABLE_TEMPLATE_REMOVE_FILTERS` feature flag. The previous value of the feature flag was `True` and now the feature is permanently enabled.
- [26346](https://github.com/apache/superset/issues/26346): Removes the deprecated `REMOVE_SLICE_LEVEL_LABEL_COLORS` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26348](https://github.com/apache/superset/issues/26348): Removes the deprecated `CLIENT_CACHE` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26349](https://github.com/apache/superset/issues/26349): Removes the deprecated `DASHBOARD_CACHE` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26369](https://github.com/apache/superset/issues/26369): Removes the Filter Sets feature including the deprecated `DASHBOARD_NATIVE_FILTERS_SET` feature flag and all related API endpoints. The feature is permanently removed as it was not being actively maintained, it was not widely used, and it was full of bugs. We also considered that if we were to provide a similar feature, it would be better to re-implement it from scratch given the amount of technical debt that the current implementation has. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26343](https://github.com/apache/superset/issues/26343): Removes the deprecated `ENABLE_EXPLORE_DRAG_AND_DROP` feature flag. The previous value of the feature flag was `True` and now the feature is permanently enabled.
- [26331](https://github.com/apache/superset/issues/26331): Removes the deprecated `DISABLE_DATASET_SOURCE_EDIT` feature flag. The previous value of the feature flag was `False` and now the feature is permanently removed.
- [26636](https://github.com/apache/superset/issues/26636): Sets the `DASHBOARD_VIRTUALIZATION` feature flag to `True` by default. This feature was introduced by [21438](https://github.com/apache/superset/pull/21438) and will enable virtualization when rendering a dashboard's charts in an attempt to reduce the number of elements (DOM nodes) rendered at once. This is especially useful for large dashboards.
- [26637](https://github.com/apache/superset/issues/26637): Sets the `DRILL_BY` feature flag to `True` by default given that the feature has been tested for a while and reached a stable state.
- [26462](https://github.com/apache/superset/issues/26462): Removes the Profile feature given that it's not actively maintained and not widely used.
- [26377](https://github.com/apache/superset/pull/26377): Removes the deprecated Redirect API that supported short URLs used before the permalink feature.
- [26329](https://github.com/apache/superset/issues/26329): Removes the deprecated `DASHBOARD_NATIVE_FILTERS` feature flag. The previous value of the feature flag was `True` and now the feature is permanently enabled.
- [25510](https://github.com/apache/superset/pull/25510): Reinforces that any newly defined Python data format (other than epoch) must adhere to the ISO 8601 standard (enforced by way of validation at the API and database level) after a previous relaxation to include slashes in addition to dashes. From now on when specifying new columns, dataset owners will need to use a SQL expression instead to convert their string columns of the form %Y/%m/%d etc. to a `DATE`, `DATETIME`, etc. type.
- [26372](https://github.com/apache/superset/issues/26372): Removes the deprecated `GENERIC_CHART_AXES` feature flag. The previous value of the feature flag was `True` and now the feature is permanently enabled.

### Potential Downtime

- [26416](https://github.com/apache/superset/pull/26416): Adds two database indexes to the `report_execution_log` table and one database index to the `report_recipient` to improve performance. Scheduled downtime may be required for large deployments.
- [28482](https://github.com/apache/superset/pull/28482): Potentially augments the `query.executed_sql` and `query.select_sql` columns for MySQL from `MEDIUMTEXT` to `LONGTEXT`. Potential downtime may be required for large deployments which previously ran [27119](https://github.com/apache/superset/pull/27119).

## 3.1.0

- [24657](https://github.com/apache/superset/pull/24657): Bumps the cryptography package to augment the OpenSSL security vulnerability.

### Other

- [24982](https://github.com/apache/superset/pull/24982): By default, physical datasets on Oracle-like dialects like Snowflake will now use denormalized column names. However, existing datasets won't be affected. To change this behavior, the "Advanced" section on the dataset modal has a "Normalize column names" flag which can be changed to change this behavior.

## 3.0.3

- [26034](https://github.com/apache/superset/issues/26034): Fixes a problem where numeric x-axes were being treated as categorical values. As a consequence of that, the way labels are displayed might change given that ECharts has a different treatment for numerical and categorical values. To revert to the old behavior, users need to manually convert numerical columns to text so that they are treated as categories. Check https://github.com/apache/superset/issues/26159 for more details.

## 3.0.0

- [25053](https://github.com/apache/superset/pull/25053): Extends the `ab_user.email` column from 64 to 320 characters which has an associated unique key constraint. This will be problematic for MySQL metadata databases which use the InnoDB storage engine with the `innodb_large_prefix` parameter disabled as the key prefix limit is 767 bytes. Enabling said parameter and ensuring that the table uses either the `DYNAMIC` or `COMPRESSED` row format should remedy the problem. See [here](https://dev.mysql.com/doc/refman/5.7/en/innodb-limits.html) for more details.
- [24911](https://github.com/apache/superset/pull/24911): Changes the column type from `TEXT` to `MediumText` in table `logs`, potentially requiring a table lock on MySQL dbs or taking some time to complete on large deployments.
- [24939](https://github.com/apache/superset/pull/24939): Augments the foreign key constraints for the `embedded_dashboards` table to include an explicit CASCADE ON DELETE to ensure the relevant records are deleted when a dashboard is deleted. Scheduled downtime may be advised.
- [24938](https://github.com/apache/superset/pull/24938): Augments the foreign key constraints for the `dashboard_slices` table to include an explicit CASCADE ON DELETE to ensure the relevant records are deleted when a dashboard or slice is deleted. Scheduled downtime may be advised.
- [24628](https://github.com/apache/superset/pull/24628): Augments the foreign key constraints for the `dashboard_owner`, `report_schedule_owner`, and `slice_owner` tables to include an explicit CASCADE ON DELETE to ensure the relevant ownership records are deleted when a dataset is deleted. Scheduled downtime may be advised.
- [24488](https://github.com/apache/superset/pull/24488): Augments the foreign key constraints for the `sql_metrics`, `sqlatable_user`, and `table_columns` tables which reference the `tables` table to include an explicit CASCADE ON DELETE to ensure the relevant records are deleted when a dataset is deleted. Scheduled downtime may be advised.
- [24232](https://github.com/apache/superset/pull/24232): Enables ENABLE_TEMPLATE_REMOVE_FILTERS, DRILL_TO_DETAIL, DASHBOARD_CROSS_FILTERS by default, marks VERSIONED_EXPORT and ENABLE_TEMPLATE_REMOVE_FILTERS as deprecated.
- [23652](https://github.com/apache/superset/pull/23652): Enables GENERIC_CHART_AXES feature flag by default.
- [23226](https://github.com/apache/superset/pull/23226): Migrated endpoint `/estimate_query_cost/<int:database_id>` to `/api/v1/sqllab/estimate/`. Corresponding permissions are can estimate query cost on SQLLab. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [23890](https://github.com/apache/superset/pull/23890): Removes Python 3.8 support.
- [24404](https://github.com/apache/superset/pull/24404): FLASK_ENV is getting
  deprecated, we recommend using SUPERSET_ENV and reviewing your
  config for ENVIRONMENT_TAG_CONFIG, which enables adding a tag in the navbar to
  make it more clear which environment your are in.
  `SUPERSET_ENV=production` and `SUPERSET_ENV=development` are the two
  supported switches based on the default config.
- [19242](https://github.com/apache/superset/pull/19242): Adhoc subqueries are now disabled by default for security reasons. To enable them, set the feature flag `ALLOW_ADHOC_SUBQUERY` to `True`.

### Breaking Changes

- [24686](https://github.com/apache/superset/pull/24686): All dataset's custom explore_url are handled as relative URLs on the frontend, behaviour controlled by PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET.
- [24262](https://github.com/apache/superset/pull/24262): Enabled `TALISMAN_ENABLED` flag by default and provided stricter default Content Security Policy
- [24415](https://github.com/apache/superset/pull/24415): Removed the obsolete Druid NoSQL REGEX operator.
- [24423](https://github.com/apache/superset/pull/24423): Removed deprecated APIs `/superset/slice_json/...`, `/superset/annotation_json/...`
- [24400](https://github.com/apache/superset/pull/24400): Removed deprecated APIs `/superset/recent_activity/...`, `/superset/fave_dashboards_by_username/...`, `/superset/fave_dashboards/...`, `/superset/created_dashboards/...`, `/superset/user_slices/`, `/superset/created_slices/...`, `/superset/fave_slices/...`, `/superset/favstar/...`,
- [24401](https://github.com/apache/superset/pull/24401): Removes the deprecated `metrics` column (which was blossomed in [20732](https://github.com/apache/superset/pull/20732)) from the `/api/v1/dataset/` API.
- [24375](https://github.com/apache/superset/pull/24375): Removed deprecated API `/superset/get_or_create_table/...`, `/superset/sqllab_viz`
- [24360](https://github.com/apache/superset/pull/24360): Removed deprecated APIs `/superset/stop_query/...`, `/superset/queries/...`, `/superset/search_queries`
- [24353](https://github.com/apache/superset/pull/24353): Removed deprecated APIs `/copy_dash/int:dashboard_id/`, `/save_dash/int:dashboard_id/`, `/add_slices/int:dashboard_id/`.
- [24198](https://github.com/apache/superset/pull/24198) The FAB views `User Registrations` and `User's Statistics` have been changed to Admin only. To re-enable them for non-admin users, please add the following perms to your custom role: `menu access on User's Statistics` and `menu access on User Registrations`.
- [24354](https://github.com/apache/superset/pull/24354): Removed deprecated APIs `/superset/testconn`, `/superset/validate_sql_json/`, `/superset/schemas_access_for_file_upload`, `/superset/extra_table_metadata`
- [24381](https://github.com/apache/superset/pull/24381): Removed deprecated API `/superset/available_domains/`
- [24359](https://github.com/apache/superset/pull/24359): Removed deprecated APIs `/superset/estimate_query_cost/..`, `/superset/results/..`, `/superset/sql_json/..`, `/superset/csv/..`
- [24345](https://github.com/apache/superset/pull/24345) Converts `ENABLE_BROAD_ACTIVITY_ACCESS` and `MENU_HIDE_USER_INFO` into feature flags and changes the value of `ENABLE_BROAD_ACTIVITY_ACCESS` to `False` as it's more secure.
- [24342](https://github.com/apache/superset/pull/24342): Removed deprecated API `/superset/tables/<int:db_id>/<schema>/...`
- [24335](https://github.com/apache/superset/pull/24335): Removed deprecated API `/superset/filter/<datasource_type>/<int:datasource_id>/<column>/`
- [24333](https://github.com/apache/superset/pull/24333): Removed deprecated API `/superset/datasources`
- [24266](https://github.com/apache/superset/pull/24266) Remove the `ENABLE_ACCESS_REQUEST` config parameter and the associated request/approval workflows.
- [24330](https://github.com/apache/superset/pull/24330) Removes `getUiOverrideRegistry` from `ExtensionsRegistry`.
- [23933](https://github.com/apache/superset/pull/23933) Removes the deprecated Multiple Line Charts.
- [23741](https://github.com/apache/superset/pull/23741) Migrates the TreeMap chart and removes the legacy Treemap code.
- [23712](https://github.com/apache/superset/pull/23712) Migrates the Pivot Table v1 chart to v2 and removes v1 code.
- [24029](https://github.com/apache/superset/pull/24029) Removes the `user` and `username` arguments for the `QUERY_LOGGER` and `SQL_QUERY_MUTATOR` methods respectively. If the username for the current user is required, the `superset.utils.core.get_username` method should be used.
- [24128](https://github.com/apache/superset/pull/24128) The `RLS_BASE_RELATED_FIELD_FILTERS` config parameter has been removed. Now the Tables dropdown will feature the same tables that the user is able to see elsewhere in the application using the standard `DatasourceFilter`, and the Roles dropdown will be filtered using the filter defined in `EXTRA_RELATED_QUERY_FILTERS["role"]`.
- [23785](https://github.com/apache/superset/pull/23785) Deprecated the following feature flags: `CLIENT_CACHE`, `DASHBOARD_CACHE`, `DASHBOARD_FILTERS_EXPERIMENTAL`, `DASHBOARD_NATIVE_FILTERS`, `DASHBOARD_NATIVE_FILTERS_SET`, `DISABLE_DATASET_SOURCE_EDIT`, `ENABLE_EXPLORE_JSON_CSRF_PROTECTION`, `REMOVE_SLICE_LEVEL_LABEL_COLORS`. It also removed `DASHBOARD_EDIT_CHART_IN_NEW_TAB` as the feature is supported without the need for a feature flag.
- [22801](https://github.com/apache/superset/pull/22801): The Thumbnails feature has been changed to execute as the currently logged in user by default, falling back to the selenium user for anonymous users. To continue always using the selenium user, please add the following to your `superset_config.py`: `THUMBNAILS_EXECUTE_AS = ["selenium"]`
- [22799](https://github.com/apache/superset/pull/22799): Alerts & Reports has been changed to execute as the owner of the alert/report by default, giving priority to the last modifier and then the creator if either is contained within the list of owners, otherwise the first owner will be used. To continue using the selenium user, please add the following to your `superset_config.py`: `ALERT_REPORTS_EXECUTE_AS = ["selenium"]`
- [23651](https://github.com/apache/superset/pull/23651): Removes UX_BETA feature flag.
- [23663](https://github.com/apache/superset/pull/23663): Removes deprecated feature flags `ALLOW_DASHBOARD_DOMAIN_SHARDING`, `DISPLAY_MARKDOWN_HTML`, and `FORCE_DATABASE_CONNECTIONS_SSL`.
- [22325](https://github.com/apache/superset/pull/22325): "RLS_FORM_QUERY_REL_FIELDS" is replaced by "RLS_BASE_RELATED_FIELD_FILTERS" feature flag. Its value format stays same.

## 2.1.1

- [24185](https://github.com/apache/superset/pull/24185): `/api/v1/database/test_connection` and `api/v1/database/validate_parameters` permissions changed from `can_read` to `can_write`. Only Admin user's have access.

### Other

- [23888](https://github.com/apache/superset/pull/23888): Database Migration for json serialization instead of pickle should upgrade/downgrade correctly when bumping to/from this patch version

## 2.1.0

- [22809](https://github.com/apache/superset/pull/22809): Migrated endpoint `/superset/sql_json` and `/superset/results/` to `/api/v1/sqllab/execute/` and `/api/v1/sqllab/results/` respectively. Corresponding permissions are `can sql_json on Superset` to `can execute on SQLLab`, `can results on Superset` to `can results on SQLLab`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22931](https://github.com/apache/superset/pull/22931): Migrated endpoint `/superset/get_or_create_table/` to `/api/v1/dataset/get_or_create/`. Corresponding permissions are `can get or create table on Superset` to `can get or create dataset on Dataset`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22882](https://github.com/apache/superset/pull/22882): Migrated endpoint `/superset/filter/<datasource_type>/<int:datasource_id>/<column>/` to `/api/v1/datasource/<datasource_type>/<datasource_id>/column/<column_name>/values/`. Corresponding permissions are `can filter on Superset` to `can get column values on Datasource`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22789](https://github.com/apache/superset/pull/22789): Migrated endpoint `/superset/recent_activity/<user_id>/` to `/api/v1/log/recent_activity/<user_id>/`. Corresponding permissions are `can recent activity on Superset` to `can recent activity on Log`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22913](https://github.com/apache/superset/pull/22913): Migrated endpoint `/superset/csv` to `/api/v1/sqllab/export/`. Corresponding permissions are `can csv on Superset` to `can export csv on SQLLab`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22496](https://github.com/apache/superset/pull/22496): Migrated endpoint `/superset/slice_json/<int:layer_id>` to `/api/v1/chart/<int:id>/data/`. Corresponding permissions are `can slice json on Superset` to `can read on Chart`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22624](https://github.com/apache/superset/pull/22624): Migrated endpoint `/superset/stop_query/` to `/api/v1/query/stop`. Corresponding permissions are `can stop query on Superset` to `can read on Query`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22579](https://github.com/apache/superset/pull/22579): Migrated endpoint `/superset/search_queries/` to `/api/v1/query/`. Corresponding permissions are `can search queries on Superset` to `can read on Query`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22501](https://github.com/apache/superset/pull/22501): Migrated endpoint `/superset/tables/<int:db_id>/<schema>/` to `/api/v1/database/<int:id>/tables/`. Corresponding permissions are `can tables on Superset` to `can read on Database`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [22611](https://github.com/apache/superset/pull/22611): Migrated endpoint `/superset/queries/` to `api/v1/query/updated_since`. Corresponding permissions are `can queries on Superset` to `can read on Query`. Make sure you add/replace the necessary permissions on any custom roles you may have.
- [23186](https://github.com/apache/superset/pull/23186): Superset will refuse to start if a default `SECRET_KEY` is detected on a non Flask debug setting.
- [22022](https://github.com/apache/superset/pull/22022): HTTP API endpoints `/superset/approve` and `/superset/request_access` have been deprecated and their HTTP methods were changed from GET to POST
- [20606](https://github.com/apache/superset/pull/20606): When user clicks on chart title or "Edit chart" button in Dashboard page, Explore opens in the same tab. Clicking while holding cmd/ctrl opens Explore in a new tab. To bring back the old behaviour (always opening Explore in a new tab), flip feature flag `DASHBOARD_EDIT_CHART_IN_NEW_TAB` to `True`.
- [20799](https://github.com/apache/superset/pull/20799): Presto and Trino engine will now display tracking URL for running queries in SQL Lab. If for some reason you don't want to show the tracking URL (for example, when your data warehouse hasn't enabled access for to Presto or Trino UI), update `TRACKING_URL_TRANSFORMER` in `config.py` to return `None`.
- [21002](https://github.com/apache/superset/pull/21002): Support Python 3.10 and bump pandas 1.4 and pyarrow 6.
- [21163](https://github.com/apache/superset/pull/21163): The time grain will be decoupled from the time filter column and the time grain control will move below the X-Axis control when `GENERIC_CHART_AXES` feature flags set to `True`. The time grain will be applied on the time column in the column-like controls(x axis, dimensions) instead of the time column in the time section.
- [21284](https://github.com/apache/superset/pull/21284): The non-functional `MAX_TABLE_NAMES` config key has been removed.
- [21794](https://github.com/apache/superset/pull/21794): Deprecates the undocumented `PRESTO_SPLIT_VIEWS_FROM_TABLES` feature flag. Now for Presto, like other engines, only physical tables are treated as tables.
- [22798](https://github.com/apache/superset/pull/22798): To make the welcome page more relevant in production environments, the last tab on the welcome page has been changed from to feature all charts/dashboards the user has access to (previously only examples were shown). To keep current behavior unchanged, add the following to your `superset_config.py`: `WELCOME_PAGE_LAST_TAB = "examples"`
- [22328](https://github.com/apache/superset/pull/22328): For deployments that have enabled the "THUMBNAILS" feature flag, the function that calculates dashboard digests has been updated to consider additional properties to more accurately identify changes in the dashboard metadata. This change will invalidate all currently cached dashboard thumbnails.
- [21765](https://github.com/apache/superset/pull/21765): For deployments that have enabled the "ALERT_REPORTS" feature flag, Gamma users will no longer have read and write access to Alerts & Reports by default. To give Gamma users the ability to schedule reports from the Dashboard and Explore view like before, create an additional role with "can read on ReportSchedule" and "can write on ReportSchedule" permissions. To further give Gamma users access to the "Alerts & Reports" menu and CRUD view, add "menu access on Manage" and "menu access on Alerts & Report" permissions to the role.

### Potential Downtime

- [21284](https://github.com/apache/superset/pull/21284): A change which drops the unused `dbs.allow_multi_schema_metadata_fetch` column via a (potentially locking) DDL operation.

### Other

- [23118](https://github.com/apache/superset/pull/23118): Previously the "database access on <database>" permission granted access to all datasets on the underlying database, but they didn't show up on the list views. Now all dashboards, charts and datasets that are accessible via this permission will also show up on their respective list views.

## 2.0.1

- [21895](https://github.com/apache/superset/pull/21895): Markdown components had their security increased by adhering to the same sanitization process enforced by GitHub. This means that some HTML elements found in markdowns are not allowed anymore due to the security risks they impose. If you're deploying Superset in a trusted environment and wish to use some of the blocked elements, then you can use the HTML_SANITIZATION_SCHEMA_EXTENSIONS configuration to extend the default sanitization schema. There's also the option to disable HTML sanitization using the HTML_SANITIZATION configuration but we do not recommend this approach because of the security risks. Given the provided configurations, we don't view the improved sanitization as a breaking change but as a security patch.

## Breaking Changes

## Potential Downtime

## Other

## 2.0.0

- [19046](https://github.com/apache/superset/pull/19046): Enables the drag and drop interface in Explore control panel by default. Flips `ENABLE_EXPLORE_DRAG_AND_DROP` and `ENABLE_DND_WITH_CLICK_UX` feature flags to `True`.
- [18936](https://github.com/apache/superset/pull/18936): Removes legacy SIP-15 interim logic/flags—specifically the `SIP_15_ENABLED`, `SIP_15_GRACE_PERIOD_END`, `SIP_15_DEFAULT_TIME_RANGE_ENDPOINTS`, and `SIP_15_TOAST_MESSAGE` flags. Time range endpoints are no longer configurable and strictly adhere to the `[start, end)` paradigm, i.e., inclusive of the start and exclusive of the end. Additionally this change removes the now obsolete `time_range_endpoints` from the form-data and resulting in the cache being busted.
- [19570](https://github.com/apache/superset/pull/19570): makes [sqloxide](https://pypi.org/project/sqloxide/) optional so the SIP-68 migration can be run on aarch64. If the migration is taking too long installing sqloxide manually should improve the performance.
- [20170](https://github.com/apache/superset/pull/20170): Introduced a new endpoint for getting datasets samples.

### Breaking Changes

- [19981](https://github.com/apache/superset/pull/19981): Per [SIP-81](https://github.com/apache/superset/issues/19953) the /explore/form_data api now requires a `datasource_type` in addition to a `datasource_id` for POST and PUT requests
- [19770](https://github.com/apache/superset/pull/19770): Per [SIP-11](https://github.com/apache/superset/issues/6032) and [SIP-68](https://github.com/apache/superset/issues/14909), the native NoSQL Druid connector is deprecated and has been removed. Druid is still supported through SQLAlchemy via pydruid. The config keys `DRUID_IS_ACTIVE` and `DRUID_METADATA_LINKS_ENABLED` have also been removed.
- [19274](https://github.com/apache/superset/pull/19274): The `PUBLIC_ROLE_LIKE_GAMMA` config key has been removed, set `PUBLIC_ROLE_LIKE = "Gamma"` to have the same functionality.
- [19273](https://github.com/apache/superset/pull/19273): The `SUPERSET_CELERY_WORKERS` and `SUPERSET_WORKERS` config keys has been removed. Configure Celery directly using `CELERY_CONFIG` on Superset.
- [19231](https://github.com/apache/superset/pull/19231): The `ENABLE_REACT_CRUD_VIEWS` feature flag has been removed (permanently enabled). Any deployments which had set this flag to false will need to verify that the React views support their use case.
- [19230](https://github.com/apache/superset/pull/19230): The `ROW_LEVEL_SECURITY` feature flag has been removed (permanently enabled). Any deployments which had set this flag to false will need to verify that the presence of the Row Level Security feature does not interfere with their use case.
- [19168](https://github.com/apache/superset/pull/19168): Celery upgrade to 5.X resulted in breaking changes to its command line invocation.
  html#step-1-adjust-your-command-line-invocation) instructions for adjustments. Also consider migrating you Celery config per [here](https://docs.celeryq.dev/en/stable/userguide/configuration.html#conf-old-settings-map).
- [19142](https://github.com/apache/superset/pull/19142): The `VERSIONED_EXPORT` config key is now `True` by default.
- [19113](https://github.com/apache/superset/pull/19113): The `ENABLE_JAVASCRIPT_CONTROLS` config key has moved from an app config to a feature flag. Any deployments who overrode this setting will now need to override the feature flag from here onward.
- [19107](https://github.com/apache/superset/pull/19107): The `SQLLAB_BACKEND_PERSISTENCE` feature flag is now `True` by default, which enables persisting SQL Lab tabs in the backend instead of the browser's `localStorage`.
- [19083](https://github.com/apache/superset/pull/19083): Updates the mutator function in the config file to take a SQL argument and a list of kwargs. Any `SQL_QUERY_MUTATOR` config function overrides will need to be updated to match the new set of params. It is advised regardless of the dictionary args that you list in your function arguments, to keep `**kwargs` as the last argument to allow for any new kwargs to be passed in.
- [19049](https://github.com/apache/superset/pull/19049): The `APP_ICON_WIDTH` config key has been removed. Superset should now be able to handle different logo sizes without having to explicitly set an `APP_ICON_WIDTH`. This might affect the size of existing custom logos as the UI will now resize them according to the specified space of maximum 148px and not according to the value of `APP_ICON_WIDTH`.
- [19017](https://github.com/apache/superset/pull/19017): Removes Python 3.7 support.
- [18970](https://github.com/apache/superset/pull/18970): The `DISABLE_LEGACY_DATASOURCE_EDITOR` feature flag is now `True` by default which disables the legacy datasource editor from being shown in the client.

## 1.5.3

### Other

- [22022](https://github.com/apache/superset/pull/22022): HTTP API endpoints `/superset/approve` and `/superset/request_access` have been deprecated and their HTTP methods were changed from GET to POST
- [21895](https://github.com/apache/superset/pull/21895): Markdown components had their security increased by adhering to the same sanitization process enforced by GitHub. This means that some HTML elements found in markdowns are not allowed anymore due to the security risks they impose. If you're deploying Superset in a trusted environment and wish to use some of the blocked elements, then you can use the HTML_SANITIZATION_SCHEMA_EXTENSIONS configuration to extend the default sanitization schema. There's also the option to disable HTML sanitization using the HTML_SANITIZATION configuration but we do not recommend this approach because of the security risks. Given the provided configurations, we don't view the improved sanitization as a breaking change but as a security patch.

## 1.5.2

### Other

- [19570](https://github.com/apache/superset/pull/19570): makes [sqloxide](https://pypi.org/project/sqloxide/) optional so the SIP-68 migration can be run on aarch64. If the migration is taking too long installing sqloxide manually should improve the performance.

## 1.5.0

### Breaking Changes

- [18976](https://github.com/apache/superset/pull/18976): When running the app in debug mode, the app will default to use `SimpleCache` for `FILTER_STATE_CACHE_CONFIG` and `EXPLORE_FORM_DATA_CACHE_CONFIG`. When running in non-debug mode, a cache backend will need to be defined, otherwise the application will fail to start. For installations using Redis or other caching backends, it is recommended to use the same backend for both cache configs.
- [17881](https://github.com/apache/superset/pull/17881): Previously simple adhoc filter values on string columns were stripped of enclosing single and double quotes. To fully support literal quotes in filters, both single and double quotes will no longer be removed from filter values.
- [17556](https://github.com/apache/superset/pull/17556): Bumps `mysqlclient` from v1 to v2.
- [17539](https://github.com/apache/superset/pull/17539): All Superset CLI commands, e.g. `init`, `load_examples`, etc. require setting the `FLASK_APP` environment variable (which is set by default when `.flaskenv` is loaded).
- [15254](https://github.com/apache/superset/pull/15254): The `QUERY_COST_FORMATTERS_BY_ENGINE`, `SQL_VALIDATORS_BY_ENGINE` and `SCHEDULED_QUERIES` feature flags are now defined as config keys given that feature flags are reserved for boolean only values.

### Potential Downtime

- [16756](https://github.com/apache/incubator-superset/pull/16756): a change which renames the `dbs.allow_csv_upload` column to `dbs.allow_file_upload` via a (potentially locking) DDL operation.
- [17539](https://github.com/apache/superset/pull/17539): all Superset CLI commands
  (init, load_examples and etc) require setting the FLASK_APP environment variable
  (which is set by default when .flaskenv is loaded)
- [17360](https://github.com/apache/superset/pull/17360): changes the column type from `VARCHAR(32)` to `TEXT` in table `table_columns`, potentially requiring a table lock on MySQL dbs or taking some time to complete on large deployments.
- [17543](https://github.com/apache/superset/pull/17543): introduces new models from SIP-68. The database migration migrates the old models (`SqlaTable`, `TableColumn`, `SqlMetric`) to the new models (`Column`, `Table`, `Dataset`), and the PR introduces logic to keep the old models in sync with the new ones until they are fully removed. The migration might take considerable time depending on the number of datasets.

### Deprecations

- [18960](https://github.com/apache/superset/pull/18960): Persisting URL params in chart metadata is no longer supported. To set a default value for URL params in Jinja code, use the optional second argument: `url_param("my-param", "my-default-value")`.

### Other

- [17589](https://github.com/apache/superset/pull/17589): It is now possible to limit access to users' recent activity data by setting the `ENABLE_BROAD_ACTIVITY_ACCESS` config flag to false, or customizing the `raise_for_user_activity_access` method in the security manager.
- [17536](https://github.com/apache/superset/pull/17536): introduced a key-value endpoint to store dashboard filter state. This endpoint is backed by Flask-Caching and the default configuration assumes that the values will be stored in the file system. If you are already using another cache backend like Redis or Memcached, you'll probably want to change this setting in `superset_config.py`. The key is `FILTER_STATE_CACHE_CONFIG` and the available settings can be found in Flask-Caching [docs](https://flask-caching.readthedocs.io/en/latest/).
- [17882](https://github.com/apache/superset/pull/17882): introduced a key-value endpoint to store Explore form data. This endpoint is backed by Flask-Caching and the default configuration assumes that the values will be stored in the file system. If you are already using another cache backend like Redis or Memcached, you'll probably want to change this setting in `superset_config.py`. The key is `EXPLORE_FORM_DATA_CACHE_CONFIG` and the available settings can be found in Flask-Caching [docs](https://flask-caching.readthedocs.io/en/latest/).

## 1.4.1

### Breaking Changes

- [17984](https://github.com/apache/superset/pull/17984): Default Flask SECRET_KEY has changed for security reasons. You should always override with your own secret. Set `PREVIOUS_SECRET_KEY` (ex: PREVIOUS_SECRET_KEY = "\2\1thisismyscretkey\1\2\\e\\y\\y\\h") with your previous key and use `superset re-encrypt-secrets` to rotate you current secrets

### Potential Downtime

### Deprecations

### Other

## 1.4.0

### Breaking Changes

- [16660](https://github.com/apache/superset/pull/16660): The `columns` Jinja parameter has been renamed `table_columns` to make the `columns` query object parameter available in the Jinja context.
- [16711](https://github.com/apache/superset/pull/16711): The `url_param` Jinja function will now by default escape the result. For instance, the value `O'Brien` will now be changed to `O''Brien`. To disable this behavior, call `url_param` with `escape_result` set to `False`: `url_param("my_key", "my default", escape_result=False)`.

### Potential Downtime

### Deprecations

### Other

- [16809](https://github.com/apache/superset/pull/16809): When building the superset frontend assets manually, you should now use Node 16 (previously Node 14 was required/recommended). Node 14 will most likely still work for at least some time, but is no longer actively tested for on CI.

## 1.3.0

### Breaking Changes

- [15909](https://github.com/apache/superset/pull/15909): a change which
  drops a uniqueness criterion (which may or may not have existed) to the tables table. This constraint was obsolete as it is handled by the ORM due to differences in how MySQL, PostgreSQL, etc. handle uniqueness for NULL values.

### Potential Downtime

- [14234](https://github.com/apache/superset/pull/14234): Adds the `limiting_factor` column to the `query` table. Give the migration includes a DDL operation on a heavily trafficked table, potential service downtime may be required.
- [16454](https://github.com/apache/superset/pull/16454): Adds the `extra` column to the `table_columns` table. Users using MySQL will either need to schedule downtime or use the percona toolkit (or similar) to perform the migration.

## 1.2.0

### Deprecations

- [13440](https://github.com/apache/superset/pull/13440): Dashboard/Charts reports and old Alerts is deprecated. The following config keys are deprecated:
  - ENABLE_ALERTS
  - SCHEDULED_EMAIL_DEBUG_MODE
  - EMAIL_REPORTS_CRON_RESOLUTION
  - EMAIL_ASYNC_TIME_LIMIT_SEC
  - EMAIL_REPORT_BCC_ADDRESS
  - EMAIL_REPORTS_USER

### Other

- [13772](https://github.com/apache/superset/pull/13772): Row level security (RLS) is now enabled by default. To activate the feature, please run `superset init` to expose the RLS menus to Admin users.
- [13980](https://github.com/apache/superset/pull/13980): Data health checks no longer use the metadata database as an interim cache. Though non-breaking, deployments which implement complex logic should likely memoize the callback function. Refer to documentation in the config.py file for more detail.
- [14255](https://github.com/apache/superset/pull/14255): The default `CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC` callable logic has been updated to leverage the specified database and schema to ensure the upload S3 key prefix is unique. Previously tables generated via upload from CSV with the same name but differ schema and/or cluster would use the same S3 key prefix. Note this change does not impact previously imported tables.

## 1.1.0

### Breaking Changes

- This is the first release since we adopted semantic versioning ([SIP-57](https://github.com/apache/superset/issues/12566)). There are no breaking changes in 1.1.0 since this is a minor release.

### Potential Downtime

- [13111](https://github.com/apache/superset/pull/13111) has a database migration that replaces `directed_force` charts with newer `graph_chart` charts based on Apache ECharts.
- [13216](https://github.com/apache/superset/pull/13216) adds a UUID column to models that are missing it. The original migration script that added the column would incorrectly complete when the column couldn't be added, resulting in a broken schema. The script is optimized for MySQL and Postgres, so depending on the database and the number of objects this migration might take considerable time.
- [12960](https://github.com/apache/superset/pull/12960) populates the granularity parameter in existing charts. Depending on the number of charts without a `granularity` or `granularity_sqla param` this might take considerable time.
- [13052](https://github.com/apache/superset/pull/13052) updates the label in existing pie charts, setting `label_type` from `pie_label_type`. Depending on the number of pie charts this might take considerable time.
- [12680](https://github.com/apache/superset/pull/12680) creates a new table, `dashboard_roles`, for role based dashboard level access.
- [12552](https://github.com/apache/superset/pull/12552) updates charts that have the time range defined using "until" and "since". Depending on the number of charts this might take considerable time.

### Deprecations

- [12552](https://github.com/apache/superset/pull/12552) removes the use of unclear time offsets, eg, "30 days". An error message is displayed if the user doesn't specify "ago" or "later", instructing the user of the correct format.
- [12627](https://github.com/apache/superset/pull/12627) deprecates the legacy alerts module.

### Other

- [shillelagh](https://github.com/betodealmeida/shillelagh/) is now the recommended module to connect Superset to Google Spreadsheets since it's more robust and has extensive test coverage. You should uninstall the `gsheetsdb` module and install the `shillelagh` module in its place. Shillelagh is a drop-in replacement, so no modifications are needed to be done on existing queries, datasets, or charts.

## 1.0.0

### Breaking Changes

- [11509](https://github.com/apache/superset/pull/12491): Dataset metadata updates check user ownership, only owners or an Admin are allowed.
- Security simplification (SIP-19), the following permission domains were simplified:

  - [12072](https://github.com/apache/superset/pull/12072): `Query` with `can_read`, `can_write`
  - [12036](https://github.com/apache/superset/pull/12036): `Database` with `can_read`, `can_write`.
  - [12012](https://github.com/apache/superset/pull/12036): `Dashboard` with `can_read`, `can_write`.
  - [12061](https://github.com/apache/superset/pull/12061): `Log` with `can_read`, `can_write`.
  - [12000](https://github.com/apache/superset/pull/12000): `Dataset` with `can_read`, `can_write`.
  - [12014](https://github.com/apache/superset/pull/12014): `Annotation` with `can_read`, `can_write`.
  - [11981](https://github.com/apache/superset/pull/11981): `Chart` with `can_read`, `can_write`.
  - [11853](https://github.com/apache/superset/pull/11853): `ReportSchedule` with `can_read`, `can_write`.
  - [11856](https://github.com/apache/superset/pull/11856): `CssTemplate` with `can_read`, `can_write`.
  - [11764](https://github.com/apache/superset/pull/11764): `SavedQuery` with `can_read`, `can_write`.
    Old permissions will be automatically migrated to these new permissions and applied to all existing security Roles.

- [11499](https://github.com/apache/superset/pull/11499): Breaking change: `STORE_CACHE_KEYS_IN_METADATA_DB` config flag added (default=`False`) to write `CacheKey` records to the metadata DB. `CacheKey` recording was enabled by default previously.

- [11704](https://github.com/apache/superset/pull/11704) Breaking change: Jinja templating for SQL queries has been updated, removing default modules such as `datetime` and `random` and enforcing static template values. To restore or extend functionality, use `JINJA_CONTEXT_ADDONS` and `CUSTOM_TEMPLATE_PROCESSORS` in `superset_config.py`.

- [11509](https://github.com/apache/superset/pull/11509): Config value `TABLE_NAMES_CACHE_CONFIG` has been renamed to `DATA_CACHE_CONFIG`, which will now also hold query results cache from connected datasources (previously held in `CACHE_CONFIG`), in addition to the table names. If you will set `DATA_CACHE_CONFIG` to a new cache backend different than your previous `CACHE_CONFIG`, plan for additional cache warmup to avoid degrading charting performance for the end users.

- [11575](https://github.com/apache/superset/pull/11575) The Row Level Security (RLS) config flag has been moved to a feature flag. To migrate, add `ROW_LEVEL_SECURITY: True` to the `FEATURE_FLAGS` dict in `superset_config.py`.

- [11259](https://github.com/apache/superset/pull/11259): config flag ENABLE_REACT_CRUD_VIEWS has been set to `True` by default, set to `False` if you prefer to the vintage look and feel. However, we may discontinue support on the vintage list view in the future.

- [11244](https://github.com/apache/superset/pull/11244): The `REDUCE_DASHBOARD_BOOTSTRAP_PAYLOAD` feature flag has been removed after being set to True for multiple months.

- [11172](https://github.com/apache/superset/pull/11172): Turning
  off language selectors by default as i18n is incomplete in most languages
  and requires more work. You can easily turn on the languages you want
  to expose in your environment in superset_config.py

- [11172](https://github.com/apache/superset/pull/11172): Breaking change: SQL templating is turned off by default. To turn it on set `ENABLE_TEMPLATE_PROCESSING` to True on `FEATURE_FLAGS`

### Potential Downtime

- [11920](https://github.com/apache/superset/pull/11920): Undoes the DB migration from [11714](https://github.com/apache/superset/pull/11714) to prevent adding new columns to the logs table. Deploying a sha between these two PRs may result in locking your DB.

- [11714](https://github.com/apache/superset/pull/11714): Logs
  significantly more analytics events (roughly double?), and when
  using DBEventLogger (default) could result in stressing the metadata
  database more.

- [11098](https://github.com/apache/superset/pull/11098): includes a database migration that adds a `uuid` column to most models, and updates `Dashboard.position_json` to include chart UUIDs. Depending on number of objects, the migration may take up to 5 minutes, requiring planning for downtime.

### Deprecations

- [11155](https://github.com/apache/superset/pull/11155): The `FAB_UPDATE_PERMS` config parameter is no longer required as the Superset application correctly informs FAB under which context permissions should be updated.

## 0.38.0

- [10887](https://github.com/apache/superset/pull/10887): Breaking change: The custom cache backend changed in order to support the Flask-Caching factory method approach and thus must be registered as a custom type. See [here](https://flask-caching.readthedocs.io/en/latest/#custom-cache-backends) for specifics.

- [10674](https://github.com/apache/superset/pull/10674): Breaking change: PUBLIC_ROLE_LIKE_GAMMA was removed is favour of the new PUBLIC_ROLE_LIKE so it can be set to whatever role you want.

- [10590](https://github.com/apache/superset/pull/10590): Breaking change: this PR will convert iframe chart into dashboard markdown component, and remove all `iframe`, `separator`, and `markup` slices (and support) from Superset. If you have important data in those slices, please backup manually.

- [10562](https://github.com/apache/superset/pull/10562): EMAIL_REPORTS_WEBDRIVER is deprecated use WEBDRIVER_TYPE instead.

- [10567](https://github.com/apache/superset/pull/10567): Default WEBDRIVER_OPTION_ARGS are Chrome-specific. If you're using FF, should be `--headless` only

- [10241](https://github.com/apache/superset/pull/10241): change on Alpha role, users started to have access to "Annotation Layers", "Css Templates" and "Import Dashboards".

- [10324](https://github.com/apache/superset/pull/10324): Facebook Prophet has been introduced as an optional dependency to add support for timeseries forecasting in the chart data API. To enable this feature, install Superset with the optional dependency `prophet` or directly `pip install fbprophet`.

- [10320](https://github.com/apache/superset/pull/10320): References to blacklist/whitelist language have been replaced with more appropriate alternatives. All configs referencing containing `WHITE`/`BLACK` have been replaced with `ALLOW`/`DENY`. Affected config variables that need to be updated: `TIME_GRAIN_BLACKLIST`, `VIZ_TYPE_BLACKLIST`, `DRUID_DATA_SOURCE_BLACKLIST`.

## 0.37.1

- [10794](https://github.com/apache/superset/pull/10794): Breaking change: `uuid` python package is not supported on Jinja2 anymore, only uuid functions are exposed eg: `uuid1`, `uuid3`, `uuid4`, `uuid5`.

## 0.37.0

- [9964](https://github.com/apache/superset/pull/9964): Breaking change on Flask-AppBuilder 3. If you're using OAuth, find out what needs to be changed [here](https://github.com/dpgaspar/Flask-AppBuilder/blob/master/README.rst#change-log).

- [10233](https://github.com/apache/superset/pull/10233): a change which deprecates the `ENABLE_FLASK_COMPRESS` config option in favor of the Flask-Compress `COMPRESS_REGISTER` config option which serves the same purpose.

- [10222](https://github.com/apache/superset/pull/10222): a change which changes how payloads are cached. Previous cached objects cannot be decoded and thus will be reloaded from source.

- [10130](https://github.com/apache/superset/pull/10130): a change which deprecates the `dbs.perm` column in favor of SQLAlchemy [hybrid attributes](https://docs.sqlalchemy.org/en/13/orm/extensions/hybrid.html).

- [10034](https://github.com/apache/superset/pull/10034): a change which deprecates the public security manager `assert_datasource_permission`, `assert_query_context_permission`, `assert_viz_permission`, and `rejected_tables` methods with the `raise_for_access` method which also handles assertion logic for SQL tables.

- [10031](https://github.com/apache/superset/pull/10030): a change which renames the following public security manager methods: `can_access_datasource` to `can_access_table`, `all_datasource_access` to `can_access_all_datasources`, `all_database_access` to `can_access_all_databases`, `database_access` to `can_access_database`, `schema_access` to `can_access_schema`, and
  `datasource_access` to `can_access_datasource`. Regrettably it is not viable to provide aliases for the deprecated methods as this would result in a name clash. Finally the `can_access_table` (previously `can_access_database`) method signature has changed, i.e., the optional `schema` argument no longer exists.

- [10030](https://github.com/apache/superset/pull/10030): a change which renames the public security manager `schemas_accessible_by_user` method to `get_schemas_accessible_by_user`.

- [9786](https://github.com/apache/superset/pull/9786): with the upgrade of `werkzeug` from version `0.16.0` to `1.0.1`, the `werkzeug.contrib.cache` module has been moved to a standalone package [cachelib](https://pypi.org/project/cachelib/). For example, to import the `RedisCache` class, please use the following import: `from cachelib.redis import RedisCache`.

- [9794](https://github.com/apache/superset/pull/9794): introduces `create view as` functionality in the sqllab. This change will require the `query` table migration and potential service downtime as that table has quite some traffic.

- [9572](https://github.com/apache/superset/pull/9572): a change which by default means that the Jinja `current_user_id`, `current_username`, and `url_param` context calls no longer need to be wrapped via `cache_key_wrapper` in order to be included in the cache key. The `cache_key_wrapper` function should only be required for Jinja add-ons.

## 0.36.0

- [8867](https://github.com/apache/superset/pull/8867): a change which adds the `tmp_schema_name` column to the `query` table which requires locking the table. Given the `query` table is heavily used performance may be degraded during the migration. Scheduled downtime may be advised.

- [9238](https://github.com/apache/superset/pull/9238): the config option `TIME_GRAIN_FUNCTIONS` has been renamed to `TIME_GRAIN_EXPRESSIONS` to better reflect the content of the dictionary.

- [9218](https://github.com/apache/superset/pull/9218): SQLite connections have been disabled by default
  for analytics databases. You can optionally enable SQLite by setting `PREVENT_UNSAFE_DB_CONNECTIONS` to `False`.
  It is not recommended to change this setting, as arbitrary SQLite connections can lead to security vulnerabilities.

- [9133](https://github.com/apache/superset/pull/9133): Security list of permissions and list views has been
  disable by default. You can optionally enable them back again by setting the following config keys:
  `FAB_ADD_SECURITY_PERMISSION_VIEW`, `FAB_ADD_SECURITY_VIEW_MENU_VIEW`, `FAB_ADD_SECURITY_PERMISSION_VIEWS_VIEW` to `True`.

- [9173](https://github.com/apache/superset/pull/9173): Changes the encoding of the query source from an int to an enum.

- [9120](https://github.com/apache/superset/pull/9120): Changes the default behavior of ad-hoc sharing of
  queries in SQLLab to one that links to the saved query rather than one that copies the query data into the KVStore
  model and links to the record there. This is a security-related change that makes SQLLab query
  sharing respect the existing role-based access controls. Should you wish to retain the existing behavior, set two feature flags:
  `"KV_STORE": True` will re-enable the `/kv/` and `/kv/store/` endpoints, and `"SHARE_QUERIES_VIA_KV_STORE": True`
  will tell the front-end to utilize them for query sharing.

- [9109](https://github.com/apache/superset/pull/9109): Expire `filter_immune_slices` and
  `filter_immune_filter_fields` to favor dashboard scoped filter metadata `filter_scopes`.

- [9046](https://github.com/apache/superset/pull/9046): Replaces `can_only_access_owned_queries` by
  `all_query_access` favoring a white list approach. Since a new permission is introduced use `superset init`
  to create and associate it by default to the `Admin` role. Note that, by default, all non `Admin` users will
  not be able to access queries they do not own.

- [8901](https://github.com/apache/superset/pull/8901): The datasource's update
  timestamp has been added to the query object's cache key to ensure updates to
  datasources are always reflected in associated query results. As a consequence all
  previously cached results will be invalidated when updating to the next version.

- [8699](https://github.com/apache/superset/pull/8699): A `row_level_security_filters`
  table has been added, which is many-to-many with `tables` and `ab_roles`. The applicable filters
  are added to the sqla query, and the RLS ids are added to the query cache keys. If RLS is enabled in config.py (`ENABLE_ROW_LEVEL_SECURITY = True`; by default, it is disabled), they can be
  accessed through the `Security` menu, or when editing a table.

- [8732](https://github.com/apache/superset/pull/8732): Swagger user interface is now enabled by default.
  A new permission `show on SwaggerView` is created by `superset init` and given to the `Admin` Role. To disable the UI,
  set `FAB_API_SWAGGER_UI = False` on config.

- [8721](https://github.com/apache/superset/pull/8721): When using the cache
  warmup Celery task you should now specify the `SUPERSET_WEBSERVER_PROTOCOL` variable
  in your configuration (probably either "http" or "https"). This defaults to "http".

- [8512](https://github.com/apache/superset/pull/8512): `DRUID_IS_ACTIVE` now
  defaults to False. To enable Druid-API-based functionality, override the
  `DRUID_IS_ACTIVE` configuration variable by setting it to `True` for your deployment.

- [8450](https://github.com/apache/superset/pull/8450): The time range picker
  now uses UTC for the tooltips and default placeholder timestamps (sans timezone).

- [8418](https://github.com/apache/superset/pull/8418): FLASK_APP / Worker App
  have changed. FLASK_APP should be updated to `superset.app:create_app()` and Celery Workers
  should be started with `--app=superset.tasks.celery_app:app`

- [9017](https://github.com/apache/superset/pull/9017): `SIP_15_ENABLED` now
  defaults to True which ensures that for all new SQL charts the time filter will behave
  like [start, end). Existing deployments should either disable this feature to keep the
  status quo or inform their users of this change prior to enabling the flag. The
  `SIP_15_GRACE_PERIOD_END` option provides a mechanism for specifying how long chart
  owners have to migrate their charts (the default is indefinite).

## 0.35.0

- [8370](https://github.com/apache/superset/pull/8370): Deprecates
  the `HTTP_HEADERS` variable in favor of `DEFAULT_HTTP_HEADERS` and
  `OVERRIDE_HTTP_HEADERS`. To retain the same behavior you should use
  `OVERRIDE_HTTP_HEADERS` instead of `HTTP_HEADERS`. `HTTP_HEADERS` will still
  work but may be removed in a future update.

- We're deprecating the concept of "restricted metric", this feature
  was not fully working anyhow.
- [8117](https://github.com/apache/superset/pull/8117): If you are
  using `ENABLE_PROXY_FIX = True`, review the newly-introduced variable,
  `PROXY_FIX_CONFIG`, which changes the proxy behavior in accordance with
  Werkzeug.

- [8069](https://github.com/apache/superset/pull/8069): introduces
  [MessagePack](https://github.com/msgpack/msgpack-python) and
  [PyArrow](https://arrow.apache.org/docs/python/) for async query results
  backend serialization. To disable set `RESULTS_BACKEND_USE_MSGPACK = False`
  in your configuration.

- [8371](https://github.com/apache/superset/pull/8371): makes
  `tables.table_name`, `dbs.database_name`, `datasources.cluster_name`, and `clusters.cluster_name` non-nullable.
  Depending on the integrity of the data, manual intervention may be required.

## 0.34.0

- [7848](https://github.com/apache/superset/pull/7848): If you are
  running redis with celery, celery bump to 4.3.0 requires redis-py upgrade to
  3.2.0 or later.

- [7667](https://github.com/apache/superset/pull/7667): a change to
  make all Unix timestamp (which by definition are in UTC) comparisons refer
  to a timestamp in UTC as opposed to local time.

- [7653](https://github.com/apache/superset/pull/7653): a change
  which deprecates the table_columns.database_expression column. Expressions
  should be handled by the DB engine spec conversion, Python date format, or
  custom column expression/type.

- The repo no longer contains translation binaries (`.mo`) files. If you
  want translations in your build, you now have to run the command
  `babel-compile --target superset/translations` as part of your builds
- [5451](https://github.com/apache/superset/pull/5451): a change
  which adds missing non-nullable fields to the `datasources` table. Depending on
  the integrity of the data, manual intervention may be required.

- [5452](https://github.com/apache/superset/pull/5452): a change
  which adds missing non-nullable fields and uniqueness constraints (which may be
  case insensitive depending on your database configuration) to the `columns`and
  `table_columns` tables. Depending on the integrity of the data, manual
  intervention may be required.
- `fabmanager` command line is deprecated since Flask-AppBuilder 2.0.0, use
  the new `flask fab <command>` integrated with _Flask cli_.
- `SUPERSET_UPDATE_PERMS` environment variable was replaced by
  `FAB_UPDATE_PERMS` config boolean key. To disable automatic
  creation of permissions set `FAB_UPDATE_PERMS = False` on config.
- [5453](https://github.com/apache/superset/pull/5453): a change
  which adds missing non-nullable fields and uniqueness constraints (which may be
  case insensitive depending on your database configuration) to the metrics
  and sql_metrics tables. Depending on the integrity of the data, manual
  intervention may be required.
- [7616](https://github.com/apache/superset/pull/7616): this bug fix
  changes time_compare deltas to correctly evaluate to the number of days prior
  instead of number of days in the future. It will change the data for advanced
  analytics time_compare so `1 year` from 5/1/2019 will be calculated as 365 days
  instead of 366 days.

## Superset 0.32.0

- `npm run backend-sync` is deprecated and no longer needed, will fail if called
- [5445](https://github.com/apache/superset/pull/5445): a change
  which prevents encoding of empty string from form data in the database.
  This involves a non-schema changing migration which does potentially impact
  a large number of records. Scheduled downtime may be advised.

## Superset 0.31.0

- If you use `Hive` or `Presto`, we've moved some dependencies that were
  in the main package as optional now. To get these packages,
  run `pip install superset[presto]` and/or `pip install superset[hive]` as
  required.

- Similarly, if you use Celery's `flower`, `gsheetsdb`, `thrift` or
  `thrift-sasl`, those dependencies have now been made optional in our
  package, meaning you may have to install them in your environment post
  0.31.0

- boto3 / botocore was removed from the dependency list. If you use s3
  as a place to store your SQL Lab result set or Hive uploads, you may
  have to rely on an alternate requirements.txt file to install those
  dependencies.
- From 0.31.0 onwards, we recommend not using the npm package `yarn` in
  favor of good old `npm install`. While yarn should still work just fine,
  you should probably align to guarantee builds similar to the ones we
  use in testing and across the community in general.

## Superset 0.30.0

- 0.30.0 includes a db_migration that removes allow_run_sync. This may
  require downtime because during the migration if the db is migrated first,
  superset will get 500 errors when the code can't find the field (until
  the deploy finishes).

## Superset 0.29.0

- India was removed from the "Country Map" visualization as the geojson
  file included in the package was very large

- [5933](https://github.com/apache/superset/pull/5933)/[6078](https://github.com/apache/superset/pull/6078): changes which add schema and table metadata cache timeout logic at the database level. If left undefined caching of metadata is disabled.

## Superset 0.28.0

- Support for Python 2 is deprecated, we only support >=3.6 from
  `0.28.0` onwards

- Superset 0.28 deprecates the previous dashboard layout. While 0.27
  offered a migration workflow to users and allowed them to validate and
  publish their migrated dashboards individually, 0.28 forces
  the migration of all
  dashboards through an automated db migration script. We
  do recommend that you take a backup prior to this migration.

- Superset 0.28 deprecates the `median` cluster label aggregator for mapbox visualizations. This particular aggregation is not supported on mapbox visualizations going forward.

- Superset 0.28 upgrades `flask-login` to `>=0.3`, which includes a
  backwards-incompatible change: `g.user.is_authenticated`,
  `g.user.is_anonymous`, and `g.user.is_active` are now properties
  instead of methods.

## Superset 0.27.0

- Superset 0.27 start to use nested layout for dashboard builder, which is not
  backward-compatible with earlier dashboard grid data. We provide migration script
  to automatically convert dashboard grid to nested layout data. To be safe, please
  take a database backup prior to this upgrade. It's the only way people could go
  back to a previous state.

## Superset 0.26.0

- Superset 0.26.0 deprecates the `superset worker` CLI, which is a simple
  wrapper around the `celery worker` command, forcing you into crafting
  your own native `celery worker` command. Your command should look something
  like `celery worker --app=superset.sql_lab:celery_app --pool=gevent -Ofair`

## Superset 0.25.0

Superset 0.25.0 contains a backwards incompatible changes.
If you run a production system you should schedule downtime for this
upgrade.

The PRs below have more information around the breaking changes:

- [9825](https://github.com/apache/superset/pull/9825): Support for Excel sheet upload added. To enable support, install Superset with the optional dependency `excel`

- [4587](https://github.com/apache/superset/pull/4587) : a backward
  incompatible database migration that requires downtime. Once the
  db migration succeeds, the web server needs to be restarted with the
  new version. The previous version will fail
- [4565](https://github.com/apache/superset/pull/4565) : we've
  changed the security model a bit where in the past you would have to
  define your authentication scheme by inheriting from Flask
  App Builder's
  `from flask_appbuilder.security.sqla.manager import SecurityManager`,
  you now have to derive Superset's
  own derivative `superset.security.SupersetSecurityManager`. This
  can provide you with more hooks to define your own logic and/or defer
  permissions to another system as needed. For all implementation, you
  simply have to import and derive `SupersetSecurityManager` in place
  of the `SecurityManager`
- [4835](https://github.com/apache/superset/pull/4835) :
  our `setup.py` now only pins versions where required, giving you
  more latitude in using versions of libraries as needed. We do now
  provide a `requirements.txt` with pinned versions if you want to run
  the suggested versions that `Superset` builds and runs tests against.
  Simply `pip install -r requirements.txt` in your build pipeline, likely
  prior to `pip install superset==0.25.0`
