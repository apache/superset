---
title: High-level Architecture
sidebar_position: 2
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

# High-level Architecture

It is important to note that this SIP is not intended to address every aspect of the architecture in a single document. Rather, it should be seen as a chapter in an ongoing book: it establishes foundational concepts and direction, while recognizing that many important topics remain to be explored. Many topics not covered here are expected to be addressed in subsequent SIPs as the architecture and community needs evolve.

The following diagram illustrates the overall architecture, emphasizing the relationships between the host application, extensions, and the supporting packages that will be developed to enable this ecosystem.

<img width="955" height="586" alt="Image" src="https://github.com/user-attachments/assets/cc2a41df-55a4-48c8-b056-35f7a1e567c6" />

On the frontend side, as a result of discussions in [[SIP-169] Proposal for Extracting and Publishing Superset Core UI Components](https://github.com/apache/superset/issues/33441), the `@apache-superset/core` package will be created to provide all the essential building blocks for both the host application and extensions, including shared UI components, utility functions, APIs, and type definitions. By centralizing these resources, extensions and built-in features can use the same APIs and components, ensuring consistency, type safety, and a seamless user experience across the Superset ecosystem. This package will be versioned to support safe evolution of the platform while maintaining compatibility for both internal and external features.

On the backend side, the `apache-superset-core` package will expose key classes and APIs needed by extensions that provide backend functionality such as extending Superset's API, providing database connectors, or customizing the security manager. It will contain dependencies on critical libraries like FAB, SQLAlchemy, etc and like `@apache-superset/core`, it will be versioned to ensure compatibility and stability.

The `apache-superset-extensions-cli` package will provide a comprehensive set of CLI commands for extension development, including tools for code generation, building, and packaging extensions. These commands streamline the development workflow, making it easier for developers to scaffold new projects, build and bundle their code, and distribute extensions efficiently. By standardizing these processes, the CLI helps ensure that extensions are built in a consistent manner, remain compatible with evolving versions of Superset, and adhere to best practices across the ecosystem.

Extension projects might have references to all packages, depending on their specific needs. For example, an extension that provides a custom SQL editor might depend on the `apache-superset-core` package for backend functionality, while also using the `@apache-superset/core` package for UI components and type definitions. This modular approach allows extension authors to choose the dependencies that best suit their needs, while also promoting consistency and reusability across the ecosystem.

The host application (Superset) will depend on core packages and is responsible for providing the implementation of the APIs defined in them. It will expose a new endpoint (`/api/v1/extensions`) for extension registration and management, and a dedicated UI for managing extensions. Registered extensions will be stored in the metadata database in a table called `extensions`, which will contain information such as the extension's name, version, author, contributed features, exposed modules, relevant metadata and the built frontend and/or backend code.
