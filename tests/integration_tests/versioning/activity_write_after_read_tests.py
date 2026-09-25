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
"""sc-120955: an activity read must not poison the session for later
writes. ``fetch_change_records`` used to flip the session connection
into server-side-cursor mode in place; on PostgreSQL every subsequent
INSERT/SAVEPOINT on the request then failed with a syntax error
(``DECLARE ... CURSOR FOR INSERT``) — the DBEventLogger write after any
activity read being the production shape."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from flask_appbuilder.security.sqla.models import User
from sqlalchemy import event
from sqlalchemy.engine import Connection, ExecutionContext

from superset.extensions import db
from superset.models.slice import Slice
from superset.utils.core import override_user
from superset.versioning.activity.orchestrator import get_activity
from tests.integration_tests.base_tests import SupersetTestCase


def _admin_user() -> User:
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    return (
        db.session.query(security_manager.user_model)
        .filter_by(username="admin")
        .one_or_none()
    ) or security_manager.add_user(
        "admin",
        "admin",
        "user",
        "admin@fab.org",
        security_manager.find_role("Admin"),
        password="general",  # noqa: S106 — test-only fixture credential
    )


class TestActivityReadThenWrite(SupersetTestCase):
    def test_write_on_the_same_session_after_an_activity_read(self) -> None:
        """The DBEventLogger shape: read activity, then INSERT + commit on
        the SAME session. With the connection mutated into stream_results
        mode this failed on PostgreSQL before any assertion ran."""
        slc: Slice = Slice(
            slice_name="sc120955_read_then_write",
            datasource_type="table",
            datasource_id=1,
            params="{}",
        )
        db.session.add(slc)
        db.session.commit()
        try:
            # The read that used to poison the connection. The entity has
            # history (its own INSERT), so the streaming fetch executes.
            slc.slice_name = "sc120955_read_then_write_edited"
            db.session.commit()
            streamed_cursors: list[str | None] = []

            def observe_change_select(
                connection: Connection,
                cursor: Any,
                statement: str,
                parameters: Any,
                context: ExecutionContext,
                executemany: bool,
            ) -> None:
                """Observe the change SELECT even if streaming is removed."""
                if statement.lstrip().upper().startswith("SELECT") and (
                    "version_changes" in statement
                ):
                    streamed_cursors.append(getattr(cursor, "name", None))

            records: list[dict[str, Any]]
            event.listen(db.engine, "before_cursor_execute", observe_change_select)
            try:
                slc_uuid: UUID = slc.uuid
                assert slc_uuid is not None
                with override_user(_admin_user()):
                    records, _, _ = get_activity(Slice, slc_uuid, resolved_entity=slc)
            finally:
                event.remove(db.engine, "before_cursor_execute", observe_change_select)
            assert records is not None
            assert streamed_cursors, "The activity read must execute its change SELECT"
            if db.engine.dialect.name == "postgresql":
                assert all(streamed_cursors), "Activity SELECTs must use named cursors"
            assert (
                not db.session.connection()
                .get_execution_options()
                .get("stream_results", False)
            )
            assert any(
                record["kind"] != "__creation__"
                and record["entity_uuid"] == str(slc.uuid)
                and record["path"] == ["slice_name"]
                and record["to_value"] == "sc120955_read_then_write_edited"
                for record in records
            )

            # A write through the same session must still work — this is
            # what Continuum's transaction INSERT, SAVEPOINTs, and the
            # DBEventLogger all do after the endpoint's read.
            follower: Slice = Slice(
                slice_name="sc120955_follow_up_write",
                datasource_type="table",
                datasource_id=1,
                params="{}",
            )
            db.session.add(follower)
            db.session.commit()
            assert follower.id is not None
            db.session.delete(follower)
            db.session.commit()
        finally:
            db.session.delete(slc)
            db.session.commit()
