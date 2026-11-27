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
Uncapped ("full data") exports of a chart's or a SQL Lab query's results.

A full export streams every row the underlying SQL returns into a CSV file in
``EXPORT_STORAGE`` from a Celery worker, and hands the requester an expiring
link to it. Neither ``ROW_LIMIT`` nor ``SQL_MAX_ROW`` is applied, which is the
whole point: it is the one export path that is not bounded by them.

Gated by the ``ALLOW_UNCAPPED_DATA_EXPORT`` feature flag, which is off by
default -- an uncapped export can run for a long time and produce an
arbitrarily large file, so it is a per-deployment decision.
"""
