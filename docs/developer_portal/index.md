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
---
title: Developer Portal
sidebar_position: 1
---

# Superset Developer Portal

Welcome to the Superset Developer Portal. Here you'll find step-by-step guides to help you get the most out of Superset.

## Getting Started

If you're new to Superset, start with our [Getting Started](/developer_portal/getting-started) guides.

## What's in this section?

This Developer Portal section is versioned independently from the main documentation and the component library. This means:

1. We can update developer guides for new Superset versions without affecting documentation for older versions
2. We can maintain guides for multiple Superset versions simultaneously
3. Users can easily find guides relevant to their specific Superset version

Use the version dropdown in the navbar to switch between different versions of the Developer Portal.

```mermaid
flowchart LR
    H1["Global State<br/>(Redux Store)"] <--> E1["Extension State<br/>(local + scoped access)"]
    H2["APIs<br/>(getData, getDatasets)"] --> E2["Data Access<br/>(fetch, typed client)"]
    H3["Extension Lifecycle<br/>(activate/deactivate)"] <--> E3["Lifecycle Hooks<br/>(activate, deactivate)"]
    H4["User/Role Info<br/>(permissions, context)"] --> E4["Context Info<br/>(user, permissions)"]
    H5["Message Bus<br/>(inter-extension comm)"] <--> E5["Communication<br/>(pub/sub messages)"]
    H6["Contribution Points<br/>(sqllab.panels, editor.menus)"] <--> E6["Contribution Points<br/>(provides & consumes)"]
    H7["Libraries/Dependencies<br/>(React, Antd, shared utils)"] <--> E7["Libraries/Dependencies<br/>(via module federation)"]
    E8["Dependencies<br/>(require other extensions)"] -.-> E8

    classDef hostStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef extensionStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000

    class H1,H2,H3,H4,H5,H6,H7 hostStyle
    class E1,E2,E3,E4,E5,E6,E7,E8 extensionStyle
```  
