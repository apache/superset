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
"""A setup failure in the sd_acl visibility test must not leak fixtures.

The fixtures used to be created before the try/finally, so a failure during
setup left them in the shared database past the cleanup -- and one leaked
sd_acl_slice was observed making 28 unrelated chart tests fail (their example
lookups take ``query(Slice).first()``). This runs the visibility test with a
failure injected at the permission grant -- the exact boundary that used to
sit outside the try -- and asserts nothing survives.
"""

from unittest.mock import patch

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.core import Database
from superset.models.slice import Slice
from tests.integration_tests.dashboards.soft_delete_tests import (  # noqa: E501
    TestDashboardSoftDelete as V,
)
from tests.integration_tests.test_app import app


def leaked() -> list[str]:
    # End any transaction the harness opened earlier: an already-open SQLite
    # read snapshot would hide rows the failed test committed, making the
    # probe pass whether or not the leak exists.
    db.session.close()
    rows = []
    q = db.session.query(Slice.slice_name).execution_options(
        **{SKIP_VISIBILITY_FILTER_CLASSES: {Slice}}
    )
    rows += [r[0] for r in q.filter(Slice.slice_name.like("sd_acl%"))]
    rows += [
        r[0]
        for r in db.session.query(SqlaTable.table_name).filter(
            SqlaTable.table_name.like("sd_acl%")
        )
    ]
    rows += [
        r[0]
        for r in db.session.query(Database.database_name).filter(
            Database.database_name.like("sd_acl%")
        )
    ]
    return rows


def test_setup_failure_leaks_nothing():
    import unittest

    case = V("test_deleted_state_list_hides_non_editor_from_read_access_user")
    result = unittest.TestResult()
    with patch.object(
        security_manager,
        "add_permission_view_menu",
        side_effect=RuntimeError("boom"),
    ):
        case.run(result)
    # The injected failure must actually have fired, or this proves nothing.
    assert result.errors or result.failures, "injected failure did not surface"
    with app.app_context():
        assert leaked() == [], f"fixtures leaked: {leaked()}"
