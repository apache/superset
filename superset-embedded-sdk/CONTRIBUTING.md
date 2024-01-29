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

# Contributing to the Superset Embedded SDK

The superset-embedded-sdk directory is a self contained sub-project in the Superset codebase.

This is because the SDK has different requirements from other parts of the Superset codebase:
Namely, we need to export a lightweight frontend library that can be used in as many environments as possible.
Having separate configs allows for better separation of concerns and allows the SDK code to remain simple.

## Testing

The functions used in the sdk so far are very closely tied to browser behavior,
and therefore are not easily unit-testable. We have instead opted to test the sdk behavior using end-to-end tests.
This way, the tests can assert that the sdk actually mounts the iframe and communicates with it correctly.

At time of writing, these tests are not written yet, because we haven't yet put together the demo app that they will leverage.
### Things to e2e test once we have a demo app:

**happy path:**

fetch valid guest token and pass it to the sdk, verify that the dashboard shows up

**security:**

it should fail if you pass a fake guest token
it should fail if your guest token doesn't have permission to access this resource
it should apply rls filters correctly
it should not apply rls filters to a dataset that isn't included

**edge cases:**

what happens if superset is offline
what happens if the superset domain is invalid or incorrect
what happens if dashboard id doesn't exist

## Publishing

To publish a new version, first determine whether it will be a major/minor/patch version according to [semver rules](https://semver.org/).
Run `npm version [major|minor|patch]`, and include the resulting version change in your PR.

Building the package and publishing to npm will be handled by github actions automatically on merge to master,
provided that the currently specified package version isn't already published.

## Building

Builds are handled by CI, so there is no need to run the build yourself unless you are curious about it.

The library is built in two modes: one for consumption by package managers
and subsequent build systems, and one for consumption directly by a web browser.

Babel is used to build the sdk into a relatively modern js package in the `lib` directory.
This is used by consumers who install the embedded sdk via npm, yarn, or other package manager.

Webpack is used to bundle the `bundle` directory,
for use directly in the browser with no build step e.g. when importing via unpkg.

Typescript outputs type definition files to the `dist` directory.

Which of these outputs is used by the library consumer is determined by our package.json's `main`, `module`, and `types` fields.
