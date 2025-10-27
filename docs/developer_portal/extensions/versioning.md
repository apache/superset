---
title: Versioning
sidebar_position: 11
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

# Versioning

All core packages published to NPM and PyPI—including `@apache-superset/core`, `apache-superset-core`, and `apache-superset-extensions-cli`—will follow semantic versioning ([semver](https://semver.org/)). This means that any breaking changes to public APIs, interfaces, or extension points will result in a major version bump, while new features and non-breaking changes will be released as minor or patch updates.

During the initial development phase, packages will remain under version 0.x, allowing for rapid iteration and the introduction of breaking changes as the architecture evolves based on real-world feedback. Once the APIs and extension points are considered stable, we will release version 1.0.0 and begin enforcing strict server practices.

To minimize disruption, breaking changes will be carefully planned and communicated in advance. We will provide clear migration guides and changelogs to help extension authors and core contributors adapt to new versions. Where possible, we will deprecate APIs before removing them, giving developers time to transition to newer interfaces.
