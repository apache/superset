---
title: Overview
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

# Frontend Style Guidelines

This is a list of statements that describe how we do frontend development in Superset. While they might not be 100% true for all files in the repo, they represent the gold standard we strive towards for frontend quality and style.

- We develop using TypeScript.
  - See: [SIP-36](https://github.com/apache/superset/issues/9101)
- We use React for building components, and Redux to manage app/global state.
  - See: [Component Style Guidelines and Best Practices](./frontend/component-style-guidelines)
- We prefer functional components to class components and use hooks for local component state.
- We use [Ant Design](https://ant.design/) components from our component library whenever possible, only building our own custom components when it's required.
  - See: [SIP-48](https://github.com/apache/superset/issues/11283)
- We use [@emotion](https://emotion.sh/docs/introduction) to provide styling for our components, co-locating styling within component files.
  - See: [SIP-37](https://github.com/apache/superset/issues/9145)
  - See: [Emotion Styling Guidelines and Best Practices](./frontend/emotion-styling-guidelines)
- We use Jest for unit tests, React Testing Library for component tests, and Cypress for end-to-end tests.
  - See: [SIP-56](https://github.com/apache/superset/issues/11830)
  - See: [Testing Guidelines and Best Practices](../testing/testing-guidelines)
- We add tests for every new component or file added to the frontend.
- We organize our repo so similar files live near each other, and tests are co-located with the files they test.
  - See: [SIP-61](https://github.com/apache/superset/issues/12098)
- We prefer small, easily testable files and components.
- We use OXC (oxlint) and Prettier to automatically fix lint errors and format the code.
  - We do not debate code formatting style in PRs, instead relying on automated tooling to enforce it.
  - If there's not a linting rule, we don't have a rule!
  - See: [Linting How-Tos](../contributing/howtos#typescript--javascript)
- We use [React Storybook](https://storybook.js.org/) to help preview/test and stabilize our components
  - A public Storybook with components from the `master` branch is available [here](https://apache-superset.github.io/superset-ui/?path=/story/*)
