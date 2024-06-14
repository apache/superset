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

# Release Notes for Superset 4.1.0
Superset 4.1.0 brings a range of new features and quality of life improvements.  This release is a minor version, meaning it doesn't include any breaking changes to ensure a seamless transition for our users. Here are some of the highlights of this release.

### Big Number With Time Period
https://github.com/apache/superset/pull/27524
https://github.com/apache/superset/pull/27193

### New ECharts Versions
Heatmap:
https://github.com/apache/superset/pull/25353
https://github.com/apache/superset/pull/27771

Histogram:
https://github.com/apache/superset/pull/28652
https://github.com/apache/superset/pull/28780

### Improved Upload Forms

We've made design changes to the [CSV](https://github.com/apache/superset/pull/27840), [Excel](https://github.com/apache/superset/pull/28105), and [Columnar](https://github.com/apache/superset/pull/28192
) upload modals to improve user experience and to be more performant. The new designs has the following goals:

- Improved error handling.
- Better backend parameter validation.
- More aligned with our other modal dialogs

#### CSV
<div>
    <img src="media/csv_modal_1.png" alt="Image" width="25%">
</div>


### OAuth2 For Databases

With the new [OAuth2 feature](https://github.com/apache/superset/pull/27631) we now allow users to log into their database with their own credentials instead of using service accounts. 

### Catalog Support For Databases
https://github.com/apache/superset/pull/28317
https://github.com/apache/superset/pull/28376
https://github.com/apache/superset/pull/28394
https://github.com/apache/superset/pull/28416