---
title: Extension Metadata
sidebar_position: 4
---

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

# Extension Metadata

The `extension.json` file contains all metadata necessary for the host application to understand and manage the extension:

``` json
{
  "name": "dataset_references",
  "version": "1.0.0",
  "frontend": {
    "contributions": {
      "views": {
        "sqllab.panels": [
          {
            "id": "dataset_references.main",
            "name": "Dataset references"
          }
        ]
      }
    },
    "moduleFederation": {
      "exposes": ["./index"]
    }
  },
  "backend": {
    "entryPoints": ["dataset_references.entrypoint"],
    "files": ["backend/src/dataset_references/**/*.py"]
  },
}
```

The `contributions` section declares how the extension extends Superset's functionality through views, commands, menus, and other contribution types. The `backend` section specifies entry points and files to include in the bundle.
