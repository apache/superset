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

# Reference: database-backed asset metadata translation

This is a **self-contained reference**, not part of Superset core. It shows one
concrete way to implement end-to-end authoring on top of the
`TRANSLATION_HOOK` read path documented at
[Asset Metadata Translation](https://superset.apache.org/docs/configuration/asset-metadata-translation).

Superset core intentionally ships only the read path (the hook + the Jinja
`i18n` macro). It does **not** provide storage or an authoring UI — those are
left to deployments so core stays minimal (per SIP-161 / the maintainer
direction). This example fills that gap for the common case: "I want editors to
enter translations and have them stored in the metadata database."

## What it provides

- `model.py` — a single `AssetTranslation` table keyed by
  `(model_name, field_name, default_text, language_code)`.
- `hook.py` — a `translation_hook(default_text, locale, **kwargs)` that reads
  that table, suitable for assigning to `TRANSLATION_HOOK`.
- `seed.py` — a small helper to populate translations programmatically (stand
  in for, or grow into, a real authoring UI / CSV import / Transifex sync).

## Why it lives outside core

A production-grade version of this would be a proper
[Superset extension](https://superset.apache.org/docs/contributing/development)
(its own migration, CRUD API, and React authoring surface). That is a separate
project. This example deliberately stays minimal so it reads as documentation:
enough to wire up and demonstrate, not a supported component.

## Usage sketch

```python
# superset_config.py
from asset_metadata_translation.hook import translation_hook

FEATURE_FLAGS = {"ENABLE_I18N_ASSET_TRANSLATIONS": True}
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "fr": {"flag": "fr", "name": "French"},
}
TRANSLATION_HOOK = translation_hook
```

Create the table once (this example uses Superset's metadata DB session), then
seed or author translations. See each module's docstring for details.
