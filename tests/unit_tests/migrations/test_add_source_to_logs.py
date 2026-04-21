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
from importlib import import_module

migration = import_module(
    "superset.migrations.versions.2026-04-19_00-00_f3a8b2c91d4e_add_source_to_logs",
)


def test_revision_is_non_empty_string() -> None:
    assert isinstance(migration.revision, str)
    assert len(migration.revision) > 0


def test_down_revision_is_non_empty_string() -> None:
    assert isinstance(migration.down_revision, str)
    assert len(migration.down_revision) > 0


def test_revision_format() -> None:
    assert migration.revision == "f3a8b2c91d4e"
    assert migration.down_revision == "ce6bd21901ab"
