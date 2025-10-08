---
title: What This Means for Superset's Built-in Features
sidebar_position: 13
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

# What This Means for Superset's Built-in Features

Transitioning to a well-defined, versioned API model has significant implications for Superset's built-in features. By exposing stable, public APIs for core functionality, we enable both extensions and internal modules to interact with the application in a consistent and predictable way. This approach brings several key benefits:

- **Unified API Surface**: All important features of Superset will be accessible through documented, versioned APIs. This not only empowers extension authors but also ensures that built-in features use the same mechanisms, validating the APIs through real-world usage and making it easier to replace or enhance individual features over time.
- **Dogfooding and Replaceability**: By building Superset's own features using the same APIs available to extensions, we ensure that these APIs are robust, flexible, and well-tested. This also means that any built-in feature can potentially be replaced or extended by a third-party extension, increasing modularity and adaptability.
- **Versioned and Stable Contracts**: Public APIs will be versioned and follow semantic versioning, providing stability for both internal and external consumers. This stability is critical for long-term maintainability, but it also means that extra care must be taken to avoid breaking changes and to provide clear migration paths when changes are necessary.
- **Improved Inter-Module Communication**: With clearly defined APIs and a command-based architecture, modules and extensions can communicate through explicit interfaces rather than relying on direct Redux store access or tightly coupled state management. This decouples modules, reduces the risk of unintended side effects, and makes the codebase easier to reason about and maintain.
- **Facilitated Refactoring and Evolution**: As the application evolves, having a stable API layer allows for internal refactoring and optimization without breaking consumers. This makes it easier to modernize or optimize internal implementations while preserving compatibility.
- **Clearer Documentation and Onboarding**: A public, versioned API surface makes it easier to document and onboard new contributors, both for core development and for extension authors.

Overall, this shift represents a move toward a more modular, maintainable, and extensible architecture, where both built-in features and extensions are first-class citizens, and where the boundaries between core and community-driven innovation are minimized.
