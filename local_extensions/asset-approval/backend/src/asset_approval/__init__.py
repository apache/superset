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
"""Maker-checker review for governed assets.

A change to a governed dashboard, chart or dataset does not reach viewers
until a second eligible editor approves it. The author's write is captured
as a :class:`ChangeRequest` holding the *raw request payload*; the write
itself never lands. On approval the stored payload is replayed through the
same shipped command the author originally invoked, so the applied result
is whatever Superset itself would have produced -- this module never
reimplements an asset update.

Gated behind the ``CHANGE_MANAGEMENT`` feature flag, off by default.
"""
