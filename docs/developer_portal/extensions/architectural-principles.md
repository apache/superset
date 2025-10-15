---
title: Architectural Principles
sidebar_position: 1
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

# Architectural Principles

Realizing this vision requires a strong architectural foundation. To ensure the resulting system is robust, maintainable, and adaptable, we have defined a set of architectural principles that will guide the design and implementation of the changes. These principles serve as the basis for all technical decisions and help create an environment where extensions can be developed safely and predictably, while minimizing technical debt and fragmentation.

The architectural principles guiding this proposal include:

1. **Lean core**: Superset's core should remain as minimal as possible, with many features and capabilities delegated to extensions. Wherever possible, built-in features should be implemented using the same APIs and extension mechanisms available to external extension authors. This approach reduces maintenance burden and complexity in the core application, encourages modularity, and allows the community to innovate and iterate on features independently of the main codebase.
2. **Explicit contribution points**: All extension points must be clearly defined and documented, so extension authors know exactly where and how they can interact with the host system. Each extension must also declare its capabilities in a metadata file, enabling the host to manage the extension lifecycle and provide a consistent user experience.
3. **Versioned and stable APIs**: Public interfaces for extensions should be versioned and follow semantic versioning, allowing for safe evolution and backward compatibility.
4. **Lazy loading and activation**: Extensions should be loaded and activated only when needed, minimizing performance overhead and resource consumption.
5. **Composability and reuse**: The architecture should encourage the reuse of extension points and patterns across different modules, promoting consistency and reducing duplication.
6. **Community-driven evolution**: The system should be designed to evolve based on real-world feedback and contributions, allowing new extension points and capabilities to be added as needs emerge.
