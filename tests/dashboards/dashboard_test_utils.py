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
import logging
from typing import List, Optional

from superset import appbuilder, is_feature_enabled, security_manager
from superset.constants import Security
from superset.models.dashboard import Dashboard, dashboard_slices, dashboard_user
from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def assert_permission_was_created(case, dashboard):
    view_menu = security_manager.find_view_menu(dashboard.view_name)
    case.assertIsNotNone(view_menu)
    case.assertEqual(len(security_manager.find_permissions_view_menu(view_menu)), 1)


def assert_permission_kept_and_changed(case, updated_dashboard, excepted_view_id):
    view_menu_after_title_changed = security_manager.find_view_menu(
        updated_dashboard.view_name
    )
    case.assertIsNotNone(view_menu_after_title_changed)
    case.assertEqual(view_menu_after_title_changed.id, excepted_view_id)


def assert_permissions_were_deleted(case, deleted_dashboard):
    view_menu = security_manager.find_view_menu(deleted_dashboard.view_name)
    case.assertIsNone(view_menu)


DASHBOARD_PERMISSION_ROLE = "dashboard_permission_role"

number_of_roles = 3


def assign_dashboard_permissions_to_multiple_roles(dashboard):
    permission_name, view_name = dashboard.permission_view_pairs[0]
    pv = security_manager.find_permission_view_menu(permission_name, view_name)

    if pv:
        logger.info(f"permission view is {pv.__repr__}")
        for i in range(number_of_roles):
            role = security_manager.add_role(dashboard_permission_role_pattern(i))
            logger.info(f"role {role.name} created")
            security_manager.add_permission_role(role, pv)
    else:
        logger.warning("permission view not found")


def clean_dashboard_matching_roles():
    for i in range(number_of_roles):
        security_manager.del_role(dashboard_permission_role_pattern(i))


def dashboard_permission_role_pattern(i):
    return "dashboard_permission_role" + str(i)


def is_dashboard_level_access_enabled():
    return is_feature_enabled(Security.DASHBOARD_LEVEL_ACCESS_FEATURE)


inserted_dashboards_ids = []


def insert_dashboard(
    dashboard_title: str,
    slug: Optional[str],
    owners: List[int],
    slices: Optional[List[Slice]] = None,
    position_json: str = "",
    css: str = "",
    json_metadata: str = "",
    published: bool = False,
) -> Dashboard:
    obj_owners = list()
    slices = slices or []
    for owner in owners:
        user = appbuilder.get_session.query(security_manager.user_model).get(owner)
        obj_owners.append(user)
    dashboard = Dashboard(
        dashboard_title=dashboard_title,
        slug=slug,
        owners=obj_owners,
        position_json=position_json,
        css=css,
        json_metadata=json_metadata,
        slices=slices,
        published=published,
    )
    appbuilder.get_session.add(dashboard)
    appbuilder.get_session.commit()

    appbuilder.get_session.refresh(dashboard)

    inserted_dashboards_ids.append(dashboard.id)

    if is_dashboard_level_access_enabled():
        dashboard.add_permissions_views()
    return dashboard


def delete_all_inserted_dashboards():
    try:
        session = appbuilder.get_session
        for dashboard_id in inserted_dashboards_ids:
            try:
                logger.info(f"deleting dashboard{dashboard_id}")
                dashboard = session.query(Dashboard).filter_by(id=dashboard_id).first()
                if dashboard:
                    if is_dashboard_level_access_enabled():
                        dashboard.del_permissions_views()
                    session.execute(
                        dashboard_user.delete().where(
                            dashboard_user.c.dashboard_id == dashboard.id
                        )
                    )
                    session.execute(
                        dashboard_slices.delete().where(
                            dashboard_slices.c.dashboard_id == dashboard.id
                        )
                    )
                    session.delete(dashboard)
            except Exception as ex:
                logger.error(f"failed to delete {dashboard_id}", exc_info=True)
                raise ex
        if len(inserted_dashboards_ids) > 0:
            session.commit()
            inserted_dashboards_ids.clear()
    except Exception as ex2:
        logger.error("delete_all_inserted_dashboards failed", exc_info=True)
        raise ex2
