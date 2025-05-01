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

import pytest

from superset import db
from superset.migrations.shared.security_converge import (
    _find_pvm,
    Permission,
    PermissionView,
    ViewMenu,
)

migration_module = import_module(
    "superset.migrations.versions."
    "2024-02-07_17-13_87d38ad83218_migrate_can_view_and_drill_permission"
)

upgrade = migration_module.do_upgrade
downgrade = migration_module.do_downgrade


@pytest.mark.usefixtures("app_context")
def test_migration_upgrade():
    pre_perm = PermissionView(
        permission=Permission(name="can_view_and_drill"),
        view_menu=db.session.query(ViewMenu).filter_by(name="Dashboard").one(),
    )
    db.session.add(pre_perm)
    db.session.commit()

    assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is not None

    upgrade(db.session)

    assert _find_pvm(db.session, "Dashboard", "can_view_chart_as_table") is not None
    assert _find_pvm(db.session, "Dashboard", "can_view_query") is not None
    assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is None


@pytest.mark.usefixtures("app_context")
def test_migration_downgrade():
    downgrade(db.session)

    assert _find_pvm(db.session, "Dashboard", "can_view_chart_as_table") is None
    assert _find_pvm(db.session, "Dashboard", "can_view_query") is None
    assert _find_pvm(db.session, "Dashboard", "can_view_and_drill") is not None
