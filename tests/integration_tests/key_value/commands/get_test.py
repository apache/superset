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
from __future__ import annotations

from typing import TYPE_CHECKING

from flask.ctx import AppContext

from tests.integration_tests.key_value.commands.fixtures import (
    ID_KEY,
    key_value_entry,
    RESOURCE,
    UUID_KEY,
    VALUE,
)

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry


def test_get_id_entry(app_context: AppContext, key_value_entry: KeyValueEntry) -> None:
    from superset.key_value.commands.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key=ID_KEY, key_type="id").run()
    assert value == VALUE


def test_get_uuid_entry(
    app_context: AppContext, key_value_entry: KeyValueEntry
) -> None:
    from superset.key_value.commands.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key=UUID_KEY, key_type="uuid").run()
    assert value == VALUE


def test_get_id_entry_missing(
    app_context: AppContext, key_value_entry: KeyValueEntry,
) -> None:
    from superset.key_value.commands.get import GetKeyValueCommand

    value = GetKeyValueCommand(resource=RESOURCE, key="456", key_type="id").run()
    assert value is None
