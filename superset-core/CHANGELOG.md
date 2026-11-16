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

## Change Log

### Unreleased

- Breaking semantic-layer contract: catalog `Dimension` objects declare a set of
  supported `grains`, native permission and separate omission defaults. Query,
  filter, order, group-limit, value and compatibility operands use immutable
  `DimensionSelection(dimension, grain)` objects. Providers must revalidate
  request selections against current contextual capabilities. Upgrade the host
  and every provider together; old catalog variants are not supported.
- `SemanticLayer.prepare_view_configuration` normalizes explicit new-view
  submissions before validation and persistence. The default preserves the
  supplied configuration. Stored-view reads and import/export do not call it.
