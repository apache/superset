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

- [32317](https://github.com/apache/superset/pull/32317) The horizontal filter bar feature is now out of testing/beta development and its feature flag `HORIZONTAL_FILTER_BAR` has been removed.
- [31976](https://github.com/apache/superset/pull/31976) Removed the `DISABLE_LEGACY_DATASOURCE_EDITOR` feature flag. The previous value of the feature flag was `True` and now the feature is permanently removed.
- [31959](https://github.com/apache/superset/pull/32000) Removes CSV_UPLOAD_MAX_SIZE config, use your web server to control file upload size.
- [31959](https://github.com/apache/superset/pull/31959) Removes the following endpoints from data uploads: `/api/v1/database/<id>/<file type>_upload` and `/api/v1/database/<file type>_metadata`, in favour of new one (Details on the PR). And simplifies permissions.
- [31844](https://github.com/apache/superset/pull/31844) The `ALERT_REPORTS_EXECUTE_AS` and `THUMBNAILS_EXECUTE_AS` config parameters have been renamed to `ALERT_REPORTS_EXECUTORS` and `THUMBNAILS_EXECUTORS` respectively. A new config flag `CACHE_WARMUP_EXECUTORS` has also been introduced to be able to control which user is used to execute cache warmup tasks. Finally, the config flag `THUMBNAILS_SELENIUM_USER` has been removed. To use a fixed executor for async tasks, use the new `FixedExecutor` class. See the config and docs for more info on setting up different executor profiles.
- [31894](https://github.com/apache/superset/pull/31894) Domain sharding is deprecated in favor of HTTP2. The `SUPERSET_WEBSERVER_DOMAINS` configuration will be removed in the next major version (6.0)
- [31794](https://github.com/apache/superset/pull/31794) Removed the previously deprecated `DASHBOARD_CROSS_FILTERS` feature flag
- [31774](https://github.com/apache/superset/pull/31774): Fixes the spelling of the `USE-ANALAGOUS-COLORS` feature flag. Please update any scripts/configuration item to use the new/corrected `USE-ANALOGOUS-COLORS` flag spelling.
- [31582](https://github.com/apache/superset/pull/31582) Removed the legacy Area, Bar, Event Flow, Heatmap, Histogram, Line, Sankey, and Sankey Loop charts. They were all automatically migrated to their ECharts counterparts with the exception of the Event Flow and Sankey Loop charts which were removed as they were not actively maintained and not widely used. If you were using the Event Flow or Sankey Loop charts, you will need to find an alternative solution.
- [31198](https://github.com/apache/superset/pull/31198) Disallows by default the use of the following ClickHouse functions: "version", "currentDatabase", "hostName".
- [29798](https://github.com/apache/superset/pull/29798) Since 3.1.0, the intial schedule for an alert or report was mistakenly offset by the specified timezone's relation to UTC. The initial schedule should now begin at the correct time.
- [30021](https://github.com/apache/superset/pull/30021) The `dev` layer in our Dockerfile no long includes firefox binaries, only Chromium to reduce bloat/docker-build-time.
- [30099](https://github.com/apache/superset/pull/30099) Translations are no longer included in the default docker image builds. If your environment requires translations, you'll want to set the docker build arg `BUILD_TRANSACTION=true`.
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
- [31260](https://github.com/apache/superset/pull/31260) Docker images now use `uv pip install` instead of `pip install` to manage the python envrionment. Most docker-based deployments will be affected, whether you derive one of the published images, or have custom bootstrap script that install python libraries (drivers)

### Potential Downtime

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
- [25510](https://github.com/apache/superset/pull/25510): Reenforces that any newly defined Python data format (other than epoch) must adhere to the ISO 8601 standard (enforced by way of validation at the API and database level) after a previous relaxation to include slashes in addition to dashes. From now on when specifying new columns, dataset owners will need to use a SQL expression instead to convert their string columns of the form %Y/%m/%d etc. to a `DATE`, `DATETIME`, etc. type.
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
