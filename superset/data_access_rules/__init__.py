# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Data Access Rules module.

This module provides a new approach to data access control in Superset,
supporting:
- Table-level access control (allow/deny patterns)
- Row-level security (RLS) with predicates
- Column-level security (CLS) with masking/hiding options

Unlike the FAB-based permission system, rules are stored as JSON documents
and can reference tables directly without requiring a priori permission creation.
"""
