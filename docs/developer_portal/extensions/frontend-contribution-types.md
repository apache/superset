---
title: Frontend Contribution Types
sidebar_position: 5
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

# Frontend Contribution Types

To facilitate the development of extensions, we will define a set of well-defined contribution types that extensions can implement. These contribution types will serve as the building blocks for extensions, allowing them to interact with the host application and provide new functionality. The initial set of contribution types will include:

## Views

Extensions can add new views or panels to the host application, such as custom SQL Lab panels, dashboards, or other UI components. Each view is registered with a unique ID and can be activated or deactivated as needed. Contribution areas are uniquely identified (e.g., `sqllab.panels` for SQL Lab panels), enabling seamless integration into specific parts of the application.

``` json
"views": {
  "sqllab.panels": [
    {
      "id": "dataset_references.main",
      "name": "Table references"
    }
  ]
},
```

## Commands

Extensions can define custom commands that can be executed within the host application, such as context-aware actions or menu options. Each command can specify properties like a unique command identifier, an icon, a title, and a description. These commands can be invoked by users through menus, keyboard shortcuts, or other UI elements, enabling extensions to add rich, interactive functionality to Superset.

``` json
"commands": [
  {
    "command": "extension1.copy_query",
    "icon": "CopyOutlined",
    "title": "Copy Query",
    "description": "Copy the current query to clipboard"
  },
]
```

## Menus

Extensions can contribute new menu items or context menus to the host application, providing users with additional actions and options. Each menu item can specify properties such as the target view, the command to execute, its placement (primary, secondary, or context), and conditions for when it should be displayed. Menu contribution areas are uniquely identified (e.g., `sqllab.editor` for the SQL Lab editor), allowing extensions to seamlessly integrate their functionality into specific menus and workflows within Superset.

``` json
"menus": {
  "sqllab.editor": {
    "primary": [
      {
        "view": "builtin.editor",
        "command": "extension1.copy_query"
      }
    ],
    "secondary": [
      {
        "view": "builtin.editor",
        "command": "extension1.prettify"
      }
    ],
    "context": [
      {
        "view": "builtin.editor",
        "command": "extension1.clear"
      },
      {
        "view": "builtin.editor",
     "command": "extension1.refresh"
      }
    ]
  },
}
```
