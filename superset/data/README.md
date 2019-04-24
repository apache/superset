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

Sample Data
===========

This directory contains scripts used for loading sample data into Superset.
When adding a new sample dataset, charts and/or dashboards, refer to e.g. `energy.py` 
as a template. All column names in Chart metadata should be handled with the 
`mlc()` function (shorthand for `db_engine_spec.make_label_compatible()`), which
ensures that column names conform to the limitations of each respective engine.
Note that metric names need not be mutated (Superset takes care of those at runtime).
