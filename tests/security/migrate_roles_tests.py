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
"""Unit tests for alerting in Superset"""
import json
import logging
from unittest.mock import patch

import pytest
from contextlib2 import contextmanager
from flask_appbuilder.security.sqla.models import Role

from superset.extensions import db, security_manager
from superset.migrations.shared.security_converge import (
    add_pvms,
    migrate_roles,
    PvmMigrationMapType,
)
from tests.test_app import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@contextmanager
def create_old_role(pvm_map: PvmMigrationMapType, external_pvms):
    with app.app_context():
        pvms = []
        for old_pvm, new_pvms in pvm_map.items():
            pvms.append(
                security_manager.add_permission_view_menu(old_pvm[1], old_pvm[0])
            )
        for external_pvm in external_pvms:
            pvms.append(
                security_manager.find_permission_view_menu(
                    external_pvm[1], external_pvm[0]
                )
            )

        new_role = Role(name="Dummy Role", permissions=pvms)
        db.session.add(new_role)
        db.session.commit()

        yield new_role

        for old_pvm, new_pvms in pvm_map.items():
            security_manager.del_permission_view_menu(old_pvm[1], old_pvm[0])
            for new_pvm in new_pvms:
                security_manager.del_permission_view_menu(new_pvm[1], new_pvm[0])

        db.session.delete(new_role)
        db.session.commit()


@pytest.mark.parametrize(
    "new_pvms, pvm_map, external_pvms, deleted_views, deleted_permissions",
    [
        (
            {"NewDummy": ("can_read",)},
            {
                ("DummyView", "can_list",): (("NewDummy", "can_read",),),
                ("DummyView", "can_show",): (("NewDummy", "can_read",),),
            },
            (),
            ("DummyView",),
            (),
        ),
        (
            {"NewDummy": ("can_read", "can_write",)},
            {
                ("DummyView", "can_list",): (("NewDummy", "can_read",),),
                ("DummyView", "can_show",): (("NewDummy", "can_read",),),
                ("DummyView", "can_add",): (("NewDummy", "can_write",),),
                ("DummyView", "can_delete",): (("NewDummy", "can_write",),),
            },
            (),
            ("DummyView",),
            (),
        ),
        (
            {"NewDummy": ("can_read", "can_write",)},
            {
                ("DummyView", "can_list",): (("NewDummy", "can_read",),),
                ("DummyView", "can_show",): (("NewDummy", "can_read",),),
                ("DummyView", "can_add",): (("NewDummy", "can_write",),),
                ("DummyView", "can_delete",): (("NewDummy", "can_write",),),
                ("DummySecondView", "can_list",): (("NewDummy", "can_read",),),
                ("DummySecondView", "can_show",): (("NewDummy", "can_read",),),
                ("DummySecondView", "can_add",): (("NewDummy", "can_write",),),
                ("DummySecondView", "can_delete",): (("NewDummy", "can_write",),),
            },
            (),
            ("DummyView", "DummySecondView"),
            (),
        ),
        (
            {"NewDummy": ("can_read", "can_write",)},
            {
                ("DummyView", "can_list",): (("NewDummy", "can_read",),),
                ("DummyView", "can_add",): (("NewDummy", "can_write",),),
            },
            (("UserDBModelView", "can_list"),),
            ("DummyView",),
            (),
        ),
        (
            {"NewDummy": ("can_read", "can_write",)},
            {
                ("DummyView", "can_list",): (("NewDummy", "can_read",),),
                ("DummyView", "can_add",): (("NewDummy", "can_write",),),
                ("DummySecondView", "can_list",): (("NewDummy", "can_read",),),
                ("DummySecondView", "can_add",): (("NewDummy", "can_write",),),
            },
            (("UserDBModelView", "can_list"), ("UserDBModelView", "can_add")),
            ("DummyView",),
            (),
        ),
        (
            {"NewDummy": ("can_read", "can_write",)},
            {
                ("DummyView", "can_new_perm",): (("NewDummy", "can_read",),),
                ("DummyView", "can_add",): (("NewDummy", "can_write",),),
            },
            (),
            ("DummyView",),
            ("can_new_perm",),
        ),
        (
            {"DummyView": ("can_list", "can_show", "can_add",)},
            {
                ("NewDummy", "can_read",): (
                    ("DummyView", "can_list",),
                    ("DummyView", "can_show",),
                ),
                ("NewDummy", "can_write",): (("DummyView", "can_add",),),
            },
            (),
            ("NewDummy",),
            (),
        ),
    ],
)
def test_migrate_role_simple(
    new_pvms, pvm_map, external_pvms, deleted_views, deleted_permissions
):
    """
    Permission migration: Simple base test
    """
    with create_old_role(pvm_map, external_pvms) as old_role:
        role_name = old_role.name
        session = db.session

        # Run migrations
        add_pvms(session, new_pvms)
        migrate_roles(session, pvm_map)

        role = db.session.query(Role).filter(Role.name == role_name).one_or_none()
        for old_pvm, new_pvms in pvm_map.items():
            old_pvm_model = security_manager.find_permission_view_menu(
                old_pvm[1], old_pvm[0]
            )
            assert old_pvm_model is None
            new_pvm_model = security_manager.find_permission_view_menu(
                new_pvms[0][1], new_pvms[0][0]
            )
            assert new_pvm_model is not None
            assert new_pvm_model in role.permissions
        # assert deleted view menus
        for deleted_view in deleted_views:
            assert security_manager.find_view_menu(deleted_view) is None
        # assert deleted permissions
        for deleted_permission in deleted_permissions:
            assert security_manager.find_permission(deleted_permission) is None
        # assert externals are still there
        for external_pvm in external_pvms:
            assert (
                security_manager.find_permission_view_menu(
                    external_pvm[1], external_pvm[0]
                )
                is not None
            )
