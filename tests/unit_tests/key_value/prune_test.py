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
# pylint: disable=import-outside-toplevel, unused-argument
from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import pytest
from flask.ctx import AppContext

from superset.extensions import db
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

RESOURCE = KeyValueResource.METASTORE_CACHE
CODEC = JsonKeyValueCodec()
VALUE = {"foo": "bar"}


@pytest.fixture
def clean_key_value_store(app_context: AppContext) -> Generator[None, None, None]:
    # The prune command commits, so a plain session rollback cannot undo its
    # effects. Explicitly empty the table around each test for isolation.
    from superset.key_value.models import KeyValueEntry

    db.session.query(KeyValueEntry).delete()
    db.session.commit()  # pylint: disable=consider-using-transaction
    yield
    db.session.query(KeyValueEntry).delete()
    db.session.commit()  # pylint: disable=consider-using-transaction


def _add_entry(expires_on: datetime | None) -> KeyValueEntry:
    from superset.key_value.models import KeyValueEntry

    entry = KeyValueEntry(
        resource=RESOURCE,
        value=CODEC.encode(VALUE),
        expires_on=expires_on,
    )
    db.session.add(entry)
    db.session.flush()
    return entry


def test_prune_deletes_expired_entries(
    clean_key_value_store: None,
) -> None:
    from superset.key_value.commands.prune import KeyValuePruneCommand
    from superset.key_value.models import KeyValueEntry

    expired_a = _add_entry(datetime.now() - timedelta(days=1))
    expired_b = _add_entry(datetime.now() - timedelta(seconds=5))
    expired_ids = {expired_a.id, expired_b.id}

    KeyValuePruneCommand().run()

    remaining_ids = {row.id for row in db.session.query(KeyValueEntry.id).all()}
    assert expired_ids.isdisjoint(remaining_ids)
    assert db.session.query(KeyValueEntry).count() == 0


def test_prune_retains_non_expired_and_no_expiry_entries(
    clean_key_value_store: None,
) -> None:
    from superset.key_value.commands.prune import KeyValuePruneCommand
    from superset.key_value.models import KeyValueEntry

    future = _add_entry(datetime.now() + timedelta(days=1))
    no_expiry = _add_entry(None)
    expired = _add_entry(datetime.now() - timedelta(days=1))

    KeyValuePruneCommand().run()

    remaining_ids = {row.id for row in db.session.query(KeyValueEntry.id).all()}
    assert future.id in remaining_ids
    assert no_expiry.id in remaining_ids
    assert expired.id not in remaining_ids
    assert db.session.query(KeyValueEntry).count() == 2


def test_prune_empty_store_is_noop(
    clean_key_value_store: None,
) -> None:
    from superset.key_value.commands.prune import KeyValuePruneCommand
    from superset.key_value.models import KeyValueEntry

    assert db.session.query(KeyValueEntry).count() == 0

    # Should not raise and should leave the store empty
    KeyValuePruneCommand().run()

    assert db.session.query(KeyValueEntry).count() == 0


def test_prune_respects_max_rows_per_run(
    clean_key_value_store: None,
) -> None:
    from superset.key_value.commands.prune import KeyValuePruneCommand
    from superset.key_value.models import KeyValueEntry

    for _ in range(3):
        _add_entry(datetime.now() - timedelta(days=1))

    KeyValuePruneCommand(max_rows_per_run=2).run()

    # Only the two oldest expired rows are removed in a single capped run
    assert db.session.query(KeyValueEntry).count() == 1
