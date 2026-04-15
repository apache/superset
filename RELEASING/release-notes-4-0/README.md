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

# Release Notes for Superset 4.0.0

4.0.0 brings a plethora of exciting changes to Superset. We have introduced several breaking changes to improve the overall architecture and scalability of our codebase. These changes may require some code updates, but they are designed to enhance performance and maintainability in the long run. We have also upgraded various dependencies to their latest versions and deprecated certain features that are no longer aligned with our long-term roadmap. We encourage all developers to carefully review the `CHANGELOG.md` and `UPDATING.md` files and update their code accordingly. While our main focus was on code cleanup, this release also contains exciting new features and marks a significant milestone for the project.

Here are some of the highlights of this release.

### Alerts and Reports modal redesign

The Alerts and Reports modal has been [redesigned](https://github.com/apache/superset/discussions/25729) to improve the user experience and make it more intuitive. The new design has the following goals:

- Declutter the interface by providing a cleaner, more organized layout
- Create a linear setup process with the necessary options in a step-by-step manner to make alert/report setup more intuitive
- Prepare the interface for additional features that will be introduced in future releases, like the ability to pre-filter a dashboard being sent.

<div>
    <img src="media/alert-modal-1.png" alt="Image" width="33%">
    <img src="media/alert-modal-2.png" alt="Image" width="33%">
    <img src="media/alert-modal-3.png" alt="Image" width="33%">
</div>

### Tags

Tags are available using the `TAGGING_SYSTEM` feature flag. They address many of the [requests made by the community](https://github.com/apache/superset/discussions/19194) and aim to make it easier to organize and curate charts, dashboards, and saved queries, allowing for effortless data discovery and collaboration within an organization. Users can create flexible and customizable tags for each piece of content, enabling different ways of organizing assets. Programmatic access to tag-related operations are supported via the RESTful API.

<div>
    <img src="media/tags-1.png" alt="Image" width="100%">
    <img src="media/tags-2.png" alt="Image" width="100%">
</div>

### New CHANGELOG format

We changed the structure of the `CHANGELOG.md` file in [#26800](https://github.com/apache/superset/pull/26800) to better organize the contents of each release and also to deal with GitHub size limitations when displaying the file. Now every release will have its own file at `CHANGELOG/<version>.md`. The main `CHANGELOG.md` file is now an index with links to all releases.

### Improved drag and drop experience when editing a dashboard

When a component was being dragged towards the edge of the tab container or the row/column containers, multiple drop indicators were often displayed. This created confusion about the exact insertion point of the element. To fix this, we built in [#26699](https://github.com/apache/superset/pull/26699) and [#26313](https://github.com/apache/superset/pull/26313) a distinct, non-conflicting area for the drop zone, which is highlighted during the dragging process to clearly indicate where the element will be placed. We also improved the forbidden drop zones to prevent users from dropping elements in invalid locations.

<div>
    <img src="media/dashboard-dnd-1.png" alt="Image" width="100%">
    <img src="media/dashboard-dnd-2.png" alt="Image" width="100%">
</div>

### Improved drag and drop experience when editing a chart

Now, during dragging, all droppable zones are highlighted, with distinct colors indicating available and unavailable drop locations. This enhancement clarifies potential drop points and helps avoid inadvertent placements in invalid areas. The update also aligns the drag-over feedback with the dashboard's drag-and-drop modifications, ensuring a uniform and enhanced user experience.

![Drag and drop](media/explore-dnd.png)

### Dropping support for 3.0.X versions

In accordance with our [release process](https://github.com/apache/superset/wiki/Release-Process), we are dropping support for the 3.0.X versions. As a result, we will no longer be providing bug fixes for these versions. We strongly recommend that all users upgrade to the latest version to take advantage of the newest features and bug fixes. Moving forward, the supported versions will be 3.1.X and 4.0.X. Bug fixes will continue to be backported to 3.1.X until the next minor release. For more information, please refer to our [release schedule](https://github.com/apache/superset/wiki/Release-Process#schedule).

### Feature flag changes

Following our 4.0 proposals, the following feature flags were removed, i.e., the feature was permanently enabled or removed.

- `VERSIONED_EXPORT`
- `DASHBOARD_FILTERS_EXPERIMENTAL`
- `ENABLE_EXPLORE_JSON_CSRF_PROTECTION`
- `ENABLE_TEMPLATE_REMOVE_FILTERS`
- `REMOVE_SLICE_LEVEL_LABEL_COLORS`
- `CLIENT_CACHE`
- `DASHBOARD_CACHE`
- `DASHBOARD_NATIVE_FILTERS_SET`
- `ENABLE_EXPLORE_DRAG_AND_DROP`
- `DISABLE_DATASET_SOURCE_EDIT`
- `DASHBOARD_NATIVE_FILTERS`
- `GENERIC_CHART_AXES`

The following feature flags were deprecated:

- `DASHBOARD_CROSS_FILTERS`
- `ENABLE_JAVASCRIPT_CONTROLS`
- `KV_STORE`

The following feature flags were enabled by default:

- `DASHBOARD_VIRTUALIZATION`
- `DRILL_BY`

### Removed features

As part of the 4.0 approved initiatives, the following features were removed from Superset:

- Filter Box: [#26328](https://github.com/apache/superset/pull/26328) removed the Filter Box code and its associated dependencies `react-select` and `array-move`. It also removed the `DeprecatedSelect` and `AsyncSelect` components that were exclusively used by filter boxes. Existing filter boxes will be automatically migrated to native dashboard filters.

- Filter Sets: [#26369](https://github.com/apache/superset/pull/26369) removed the Filters Set feature including the deprecated `DASHBOARD_NATIVE_FILTERS_SET` feature flag and all related API endpoints. The feature is permanently removed as it was not being actively maintained, it was not widely used, and it was full of bugs. We also considered that if we were to provide a similar feature, it would be better to re-implement it from scratch given the amount of technical debt that the implementation had.

- Profile: [#26462](https://github.com/apache/superset/pull/26462) removed the Profile feature given that it was not actively maintained nor widely used.

- Redirect API: [#26377](https://github.com/apache/superset/pull/26377) removed the deprecated Redirect API that supported short URLs (`/r`) and the `url` metadata table used to store them that was used before the permalink feature. Users lost the ability to generate R links ~1.5 years ago which seems sufficient time to remove the API.

### Business logic improvements

As part of [[SIP-99] Proposal for correctly handling business logic](https://github.com/apache/superset/issues/25048) (specifically [SIP-99A](https://github.com/apache/superset/issues/25107) and [SIP-99B](https://github.com/apache/superset/issues/25108)), this release contains many improvements to the handling of business logic in Superset, specifically related to SQLAlchemy sessions and transactions. The goal of these efforts is to simplify the code, improve code quality, ensure a consistent "unit of work" approach, and provide clear guidance and examples of accepted code standards. These changes aim to improve developer experience by making the code simpler, improving testing, and ensuring a more streamlined and reliable system. We still have a long way to go to fully implement the SIP-99 proposal, but we are making progress and we are excited about the improvements that have been made so far.

### All country maps are now managed via Jupyter Notebook

In this release we made updates to the Jupyter Notebook to ensure reliable execution by removing deprecated methods, adding new countries, including missing maps, and fixing filename inconsistencies. This will make it easier to add more countries, dynamically add them to the country map plugin, and update map regions periodically. You can check [#26300](https://github.com/apache/superset/pull/26300) for more details.

### Sunburst chart migrated to ECharts

The ECharts version of the Sunburst chart was introduced by [#22833](https://github.com/apache/superset/pull/22833) as part of our efforts to complete [SIP-50](https://github.com/apache/superset/issues/10418). In 4.0, legacy Sunburst charts are [automatically migrated](https://github.com/apache/superset/pull/26350) to ECharts and the legacy version was removed.

![Sunburst](media/sunburst.png)

### Some cool stats

- ~15K lines of code were removed by PRs related to 4.0 proposals
- We reduced the number of NPM packages vulnerabilities by 72%
  - 3.1: 90 vulnerabilities (42 moderate, 34 high, 14 critical)
  - 4.0: 25 vulnerabilities (16 moderate, 8 high, 1 critical)
- 40+ dependency changes (upgrades, additions, and removals)

### How to upgrade

As with any Superset version upgrade, the process is simple in the broadest strokes, as outlined in the documentation. However, as with any upgrade, we expect to see numerous speed bumps along that path depending on your configuration, your infrastructure, your databases in use, and other customizations/configurations. To make a safe leap to this version, we'd suggest the following steps:

- Back up your databases
- Carefully read `CHANGELOG.md` for all the incremental changes in this version (and any prior versions between your current installation and 4.0.0).
- Similarly, review `UPDATING.md` to keep an eye out for all changes that have been explicitly marked as breaking changes.
- Adjust your feature flags and configurations to meet your feature requirements and preferences.
- Execute the migrations
- If you have third-party apps interacting with Superset, check for relevant dependency updates or API endpoint changes that may affect compatibility.

Your mileage may vary depending on:

- How you install and deploy Superset (e.g. docker vs. pip vs. helm)
- How you’ve configured Superset
- What integrations, databases, etc. you're using

Reach out in `#deploying-superset` on Slack in case you find any problems, and if you find a reproducible bug, please file a new issue on GitHub.
