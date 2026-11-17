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

# Semantic layer configuration controls

Providers can opt top-level dynamic string fields into a free-entry dropdown:

```json
{
  "type": "string",
  "x-dynamic": true,
  "enum": ["AAA", "REPORTING"],
  "x-anyOption": {"label": "Any database", "description": "choose when adding views"},
  "x-allowCustomValue": true,
  "x-pairedFlag": "allow_changing_database"
}
```

The three keys are generic provider metadata; labels/help come from the provider,
like other field descriptions. This opt-in combination renders an empty-string
choice first, including when a named value is selected. `enum` values become
suggestions rather than validation constraints, so undiscovered names remain
valid input. Empty string is the sentinel; the label is never stored.

`x-pairedFlag` names a boolean property in the same top-level configuration
schema. That property stays in the schema and saved data but is hidden in the
form. Explicit selection or typing updates the value and flag in one JSON Forms
reducer action: empty means true, a name means false. An unchanged edit preserves
the stored pair, including a named value with a true flag. Schema refreshes do
not normalize existing values. New forms initialize absent opted-in fields to
empty/true. Clearing a field after a dependency changes also chooses empty/true.
Providers must retain server validation; this metadata does not change API
validation or persistence. Fields without this opt-in retain their renderers.
