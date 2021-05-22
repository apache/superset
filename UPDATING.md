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
- [13772](https://github.com/apache/superset/pull/13772): Row level security (RLS) is now enabled by default. To activate the feature, please run `superset init` to expose the RLS menus to Admin users.

- [13980](https://github.com/apache/superset/pull/13980): Data health checks no longer use the metadata database as an interim cache. Though non-breaking, deployments which implement complex logic should likely memoize the callback function. Refer to documentation in the confg.py file for more detail.

- [14255](https://github.com/apache/superset/pull/14255): The default `CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC` callable logic has been updated to leverage the specified database and schema to ensure the upload S3 key prefix is unique. Previously tables generated via upload from CSV with the same name but differ schema and/or cluster would use the same S3 key prefix. Note this change does not impact previously imported tables.

### Breaking Changes
### Potential Downtime
- [14234](https://github.com/apache/superset/pull/14234): Adds the `limiting_factor` column to the `query` table. Give the migration includes a DDL operation on a heavily trafficed table, potential service downtime may be required.

### Deprecations
- [13440](https://github.com/apache/superset/pull/13440): Dashboard/Charts reports and old Alerts is deprecated. The following config keys are deprecated:
    - ENABLE_ALERTS
    - SCHEDULED_EMAIL_DEBUG_MODE
    - EMAIL_REPORTS_CRON_RESOLUTION
    - EMAIL_ASYNC_TIME_LIMIT_SEC
    - EMAIL_REPORT_BCC_ADDRESS
    - EMAIL_REPORTS_USER
### Other

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

- [11259](https://github.com/apache/superset/pull/11259): config flag ENABLE_REACT_CRUD_VIEWS has been set to `True` by default, set to `False` if you prefer to the vintage look and feel. However, we may discontine support on the vintage list view in the future.

- [11244](https://github.com/apache/superset/pull/11244): The `REDUCE_DASHBOARD_BOOTSTRAP_PAYLOAD` feature flag has been removed after being set to True for multiple months.

- [11172](https://github.com/apache/superset/pull/11172): Turning
off language selectors by default as i18n is incomplete in most languages
and requires more work. You can easily turn on the languages you want
to expose in your environment in superset_config.py

- [11172](https://github.com/apache/superset/pull/11172): Breaking change: SQL templating is turned off by default. To turn it on set `ENABLE_TEMPLATE_PROCESSING` to True on `FEATURE_FLAGS`

### Potential Downtime
- [11920](https://github.com/apache/superset/pull/11920): Undos the DB migration from [11714](https://github.com/apache/superset/pull/11714) to prevent adding new columns to the logs table. Deploying a sha between these two PRs may result in locking your DB.

- [11714](https://github.com/apache/superset/pull/11714): Logs
significantly more analytics events (roughly double?), and when
using DBEventLogger (default) could result in stressing the metadata
database more.

- [11098](https://github.com/apache/superset/pull/11098): includes a database migration that adds a `uuid` column to most models, and updates `Dashboard.position_json` to include chart UUIDs. Depending on number of objects, the migration may take up to 5 minutes, requiring planning for downtime.

### Deprecations
- [11155](https://github.com/apache/superset/pull/11155): The `FAB_UPDATE_PERMS` config parameter is no longer required as the Superset application correctly informs FAB under which context permissions should be updated.

## 0.38.0

* [10887](https://github.com/apache/superset/pull/10887): Breaking change: The custom cache backend changed in order to support the Flask-Caching factory method approach and thus must be registered as a custom type. See [here](https://flask-caching.readthedocs.io/en/latest/#custom-cache-backends) for specifics.

* [10674](https://github.com/apache/superset/pull/10674): Breaking change: PUBLIC_ROLE_LIKE_GAMMA was removed is favour of the new PUBLIC_ROLE_LIKE so it can be set to whatever role you want.

* [10590](https://github.com/apache/superset/pull/10590): Breaking change: this PR will convert iframe chart into dashboard markdown component, and remove all `iframe`, `separator`, and `markup` slices (and support) from Superset. If you have important data in those slices, please backup manually.

* [10562](https://github.com/apache/superset/pull/10562): EMAIL_REPORTS_WEBDRIVER is deprecated use WEBDRIVER_TYPE instead.

* [10567](https://github.com/apache/superset/pull/10567): Default WEBDRIVER_OPTION_ARGS are Chrome-specific. If you're using FF, should be `--headless` only

* [10241](https://github.com/apache/superset/pull/10241): change on Alpha role, users started to have access to "Annotation Layers", "Css Templates" and "Import Dashboards".

* [10324](https://github.com/apache/superset/pull/10324): Facebook Prophet has been introduced as an optional dependency to add support for timeseries forecasting in the chart data API. To enable this feature, install Superset with the optional dependency `prophet` or directly `pip install fbprophet`.

* [10320](https://github.com/apache/superset/pull/10320): References to blacklst/whitelist language have been replaced with more appropriate alternatives. All configs refencing containing `WHITE`/`BLACK` have been replaced with `ALLOW`/`DENY`. Affected config variables that need to be updated: `TIME_GRAIN_BLACKLIST`, `VIZ_TYPE_BLACKLIST`, `DRUID_DATA_SOURCE_BLACKLIST`.

## 0.37.1

- [10794](https://github.com/apache/superset/pull/10794): Breaking change: `uuid` python package is not supported on Jinja2 anymore, only uuid functions are exposed eg: `uuid1`, `uuid3`, `uuid4`, `uuid5`.

## 0.37.0

- [9964](https://github.com/apache/superset/pull/9964): Breaking change on Flask-AppBuilder 3. If you're using OAuth, find out what needs to be changed [here](https://github.com/dpgaspar/Flask-AppBuilder/blob/master/README.rst#change-log).

- [10233](https://github.com/apache/superset/pull/10233): a change which deprecates the `ENABLE_FLASK_COMPRESS` config option in favor of the Flask-Compress `COMPRESS_REGISTER` config option which serves the same purpose.

- [10222](https://github.com/apache/superset/pull/10222): a change which changes how payloads are cached. Previous cached objects cannot be decoded and thus will be reloaded from source.

- [10130](https://github.com/apache/superset/pull/10130): a change which deprecates the `dbs.perm` column in favor of SQLAlchemy [hybird attributes](https://docs.sqlalchemy.org/en/13/orm/extensions/hybrid.html).

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
  accessed through the `Security` menu, or when editting a table.

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
  using `ENABLE_PROXY_FIX = True`, review the newly-introducted variable,
  `PROXY_FIX_CONFIG`, which changes the proxy behavior in accordance with
  [Werkzeug](https://werkzeug.palletsprojects.com/en/0.15.x/middleware/proxy_fix/)

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

The PRs bellow have more information around the breaking changes:

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
