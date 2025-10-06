---
title: Security Implications and Responsibilities
sidebar_position: 12
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

# Security Implications and Responsibilities

By default, extensions are disabled and must be explicitly enabled by setting the `ENABLE_EXTENSIONS` feature flag. Built-in extensions are included as part of the Superset codebase and are held to the same security standards and review processes as the rest of the application.

For external extensions, administrators are responsible for evaluating and verifying the security of any extensions they choose to install, just as they would when installing third-party NPM or PyPI packages. At this stage, all extensions run in the same context as the host application, without additional sandboxing. This means that external extensions can impact the security and performance of a Superset environment in the same way as any other installed dependency.

We plan to introduce an optional sandboxed execution model for extensions in the future (as part of an additional SIP). Until then, administrators should exercise caution and follow best practices when selecting and deploying third-party extensions. A directory of known Superset extensions may be maintained in a means similar to [this page](https://github.com/apache/superset/wiki/Superset-Third%E2%80%90Party-Plugins-Directory) on the wiki. We also discussed the possibility of introducing a shared registry for vetted extensions but decided to leave it out of the initial scope of the project. We might introduce a registry at a later stage depending on the evolution of extensions created by the community.

Any performance or security vulnerabilities introduced by external extensions should be reported directly to the extension author, not as Superset vulnerabilities. Any security concerns regarding built-in extensions (included in Superset's monorepo) should be reported to the Superset Security mailing list for triage and resolution by maintainers.
