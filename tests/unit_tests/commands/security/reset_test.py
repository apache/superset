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

"""Factory-reset behavior for the retained Alerts & Reports configuration."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from superset import security_manager
from superset.commands.security.reset import _clear_preserved_config_audit_fields
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource


def test_preserved_config_does_not_block_deleting_its_author(session: Session) -> None:
    """The retained KV row must not reference a user removed by factory reset."""
    engine = session.get_bind()
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
    KeyValueEntry.metadata.create_all(engine)  # pylint: disable=no-member

    author = security_manager.user_model(
        username="former_admin",
        first_name="Former",
        last_name="Admin",
        email="former@example.com",
    )
    session.add(author)
    session.flush()
    entry = KeyValueEntry(
        resource=KeyValueResource.ALERT_REPORT_CONFIG.value,
        uuid=FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
        value=b'{"version": 1, "settings": {}}',
        created_by_fk=author.id,
        changed_by_fk=author.id,
    )
    session.add(entry)
    session.flush()

    _clear_preserved_config_audit_fields()
    session.expire(entry)
    assert entry.created_by_fk is None
    assert entry.changed_by_fk is None

    session.execute(text("DELETE FROM ab_user WHERE id = :id"), {"id": author.id})
    session.flush()
    assert session.get(KeyValueEntry, entry.id) is not None
