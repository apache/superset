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

## @superset-ui/core/time-comparison

This is a collection of methods used to support Time Comparison in charts.

#### Example usage

```js
import { getComparisonTimeRangeInfo } from '@superset-ui/core';
const { since, until } = getComparisonTimeRangeInfo(
  adhocFilters,
  extraFormData,
);
console.log(adhocFilters, extraFormData);
```

or

```js
import { ComparisonTimeRangeType } from '@superset-ui/core';
ComparisonTimeRangeType.Custom; // 'c'
ComparisonTimeRangeType.InheritRange; // 'r'
```

#### API

`fn(args)`

- Do something
