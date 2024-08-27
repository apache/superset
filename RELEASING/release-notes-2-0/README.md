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

# Release Notes for Superset 2.0

Superset 2.0 is a big step forward. This release cleans up many legacy code paths and feature flags, and deprecates lots of legacy behaviors in Superset.

- [**Developer Experience**](#developer-experience)
- [**Features**](#features)
- [**Config and Feature flags**](#config-and-feature-flags)
- [**Breaking Changes**](#breaking-changes)

## Developer Experience

- Addition of a statsd gauge metric for Slack and email notifications for increased visibility into errors around alerts / reports ([#20158](https://github.com/apache/superset/pull/20158))

- Helm chart now supports resource limits and requests for each component ([#20052](https://github.com/apache/superset/pull/20052))

- New GitHub workflow to test Storybook Netlify instance nightly ([#19852](https://github.com/apache/superset/pull/19852))

- Minimum requirement for Superset is now Python 3.8 ([#19017](https://github.com/apache/superset/pull/19017))

## Features

**Charting and Dashboard Experience**

Support for horizontal bar chart added ([#19918](https://github.com/apache/superset/pull/19918))

![horizontal](https://user-images.githubusercontent.com/11830681/166248149-4946388a-5051-4d13-a516-50a81e9b5be3.png)

Time Series Charts now support stacking of both negative and positive values ([#20408](https://github.com/apache/superset/pull/20408))

![negative](https://user-images.githubusercontent.com/15073128/174057996-52255bfe-60c3-4727-be99-e328c124e439.png)

- Pie charts now defaults to a row limit of 100 to prevent crashes when a high-cardinality column is chosen as the dimension ([#20392](https://github.com/apache/superset/pull/20392))

- World map chart now supports coloring either by metric or by the country column ([#19881](https://github.com/apache/superset/pull/19881))

- Table visualization now supports drag and drop for columns ([#19381](https://github.com/apache/superset/pull/19381))

- Mixed chart now supports Advanced Analytics ([#19851](https://github.com/apache/superset/pull/19851))

- Add support for generic x-axis (non-time-series) in the Mixed Chart ([#20097](https://github.com/apache/superset/pull/20097))

![Image](https://user-images.githubusercontent.com/33317356/168807749-b021c04c-8902-4b4f-a7a4-f21544fb678e.png)

- Charts can now be created in Edit Dashboard mode ([#20126](https://github.com/apache/superset/pull/20126))

![Image](https://user-images.githubusercontent.com/15073128/169251205-2c0f36bb-17e0-4549-aa84-66a58a377603.png)

- Add aggregate total for Pie charts ([#19622](https://github.com/apache/superset/pull/19622))

- Legend is now enabled by default for relevant charts ([#19927](https://github.com/apache/superset/pull/19927))

**View Results Experience**

- Explore and Dashboard views now support displaying of multiple results ([#20277](https://github.com/apache/superset/pull/20277))

- Results pane in Dashboard view now more closely mirrors rich functionality from Results pane in Explore ([#20144](https://github.com/apache/superset/pull/20144))


**Quality of Life**

- Edit Dataset modal now doesn't close when you click away ([#20278](https://github.com/apache/superset/pull/20278))

- When editing the label in the Metrics popover, pressing Enter now saves what you typed ([#19898](https://github.com/apache/superset/pull/19898))

- When adding new chart from the dashboard view, the dashboard name will now pre-fill ([#20129](https://github.com/apache/superset/pull/20129))

- Annotations now have an improved empty state ([#20160](https://github.com/apache/superset/pull/20160))

- Confirmational modal is now shown if user exits Explore without saving changes ([#19993](https://github.com/apache/superset/pull/19993))

- Explore popovers now close when the Escape key is pressed ([#19902](https://github.com/apache/superset/pull/19902))

- Run and Save buttons are redesigned for improved usability ([#19558](https://github.com/apache/superset/pull/19558))

**Databases**

- Native database driver for Databricks ([#20320](https://github.com/apache/superset/pull/20320))

- Time grains for SQLite are now simplified ([#19745](https://github.com/apache/superset/pull/19745))

- Multiple upgrades to the Trino database engine ([#20152](https://github.com/apache/superset/pull/20152))

- Switch from sqlalchemy-trino to trino-python-client ([#19957](https://github.com/apache/superset/pull/19957))

- Apache Pinot now supports more time grains in Superset ([#19724](https://github.com/apache/superset/pull/19724))

**Jinja**

- New Jinja macro enables querying / referencing both physical and virtual datasets in SQL Lab ([#15241](https://github.com/apache/superset/pull/15241))

- New Jinja macro added to improve experience of including multiple items ([#19574](https://github.com/apache/superset/pull/19574))

**Other**

- Datasets can now be filtered by their certification status ([#20136](https://github.com/apache/superset/pull/20136))


## Config and Feature Flags

- Initial implementation of advanced types ([#18794](https://github.com/apache/superset/pull/18794))
	- Flag: `ENABLE_ADVANCED_DATA_TYPES`

- Caching can now be enabled in database setups when user impersonation is enabled ([#20114](https://github.com/apache/superset/pull/20114))
	- Flag: `CACHE_IMPERSONATION`

- Control behavior for how color palettes are chosen ([#19987](https://github.com/apache/superset/pull/19987))
	- Flag: `USE_ANALAGOUS_COLORS`

- Enabling non-time-series x-axis in some charts ([#20097](https://github.com/apache/superset/pull/20097))
	- Flag: `GENERIC_CHART_AXES`

- As part of the 2.0 cleanup efforts, the following feature flags were removed (which means the behavior is now permanently enabled):
	- `ROW_LEVEL_SECURITY`
	- `ENABLE_REACT_CRUD_VIEWS`
	- `PUBLIC_ROLE_LIKE_GAMMA`

- The following feature flags are now True by default, but can be turned back to False:
	- `ENABLE_EXPLORE_DRAG_AND_DROP`
	- `ENABLE_DND_WITH_CLICK_UX`
	- `DISABLE_LEGACY_DATASOURCE_EDITOR`
	- `SQLLAB_BACKEND_PERSISTENCE`
	- `VERSIONED_EXPORT`

- The following config flags were removed:
	- `APP_ICON_WIDTH`

- A number of legacy interim flags were removed around SIP-15 ([#18936](https://github.com/apache/superset/pull/18936))

- The `ENABLE_JAVASCRIPT_CONTROLS` flag was moved from an app config to a feature flag

## Breaking Changes

To learn more about the breaking changes in 2.0, please read [UPDATING.MD](https://github.com/apache/superset/blob/master/UPDATING.md)
