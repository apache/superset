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

import logging
from datetime import datetime
from typing import Any

from flask import g
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset import is_feature_enabled, security_manager
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardForbiddenError,
    DashboardNotFoundError,
)
from superset.daos.base import BaseDAO
from superset.dashboards.filters import DashboardAccessFilter, is_uuid
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.core import FavStar, FavStarClassName
from superset.models.dashboard import Dashboard, id_or_slug_filter
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.dashboard_filter_scopes_converter import copy_filter_scopes

logger = logging.getLogger(__name__)


class DashboardDAO(BaseDAO[Dashboard]):
    base_filter = DashboardAccessFilter

    @classmethod
    def get_by_id_or_slug(cls, id_or_slug: int | str) -> Dashboard:
        if is_uuid(id_or_slug):
            # just get dashboard if it's uuid
            dashboard = Dashboard.get(id_or_slug)
        else:
            query = (
                db.session.query(Dashboard)
                .filter(id_or_slug_filter(id_or_slug))
                .outerjoin(Dashboard.owners)
                .outerjoin(Dashboard.roles)
            )
            # Apply dashboard base filters
            query = cls.base_filter("id", SQLAInterface(Dashboard, db.session)).apply(
                query, None
            )
            dashboard = query.one_or_none()
        if not dashboard:
            raise DashboardNotFoundError()

        # make sure we still have basic access check from security manager
        try:
            dashboard.raise_for_access()
        except SupersetSecurityException as ex:
            raise DashboardAccessDeniedError() from ex

        return dashboard

    @staticmethod
    def get_datasets_for_dashboard(id_or_slug: str) -> list[Any]:
        dashboard = DashboardDAO.get_by_id_or_slug(id_or_slug)
        return dashboard.datasets_trimmed_for_slices()

    @staticmethod
    def get_tabs_for_dashboard(id_or_slug: str) -> dict[str, Any]:
        dashboard = DashboardDAO.get_by_id_or_slug(id_or_slug)
        return dashboard.tabs

    @staticmethod
    def get_charts_for_dashboard(id_or_slug: str) -> list[Slice]:
        return DashboardDAO.get_by_id_or_slug(id_or_slug).slices

    @staticmethod
    def get_dashboard_changed_on(id_or_slug_or_dashboard: str | Dashboard) -> datetime:
        """
        Get latest changed datetime for a dashboard.

        :param id_or_slug_or_dashboard: A dashboard or the ID or slug of the dashboard.
        :returns: The datetime the dashboard was last changed.
        """

        dashboard: Dashboard = (
            DashboardDAO.get_by_id_or_slug(id_or_slug_or_dashboard)
            if isinstance(id_or_slug_or_dashboard, str)
            else id_or_slug_or_dashboard
        )
        # drop microseconds in datetime to match with last_modified header
        return dashboard.changed_on.replace(microsecond=0)

    @staticmethod
    def get_dashboard_and_slices_changed_on(  # pylint: disable=invalid-name
        id_or_slug_or_dashboard: str | Dashboard,
    ) -> datetime:
        """
        Get latest changed datetime for a dashboard. The change could be a dashboard
        metadata change, or a change to one of its dependent slices.

        :param id_or_slug_or_dashboard: A dashboard or the ID or slug of the dashboard.
        :returns: The datetime the dashboard was last changed.
        """

        dashboard = (
            DashboardDAO.get_by_id_or_slug(id_or_slug_or_dashboard)
            if isinstance(id_or_slug_or_dashboard, str)
            else id_or_slug_or_dashboard
        )
        dashboard_changed_on = DashboardDAO.get_dashboard_changed_on(dashboard)
        slices = dashboard.slices
        slices_changed_on = max(
            [slc.changed_on for slc in slices]
            + ([datetime.fromtimestamp(0)] if len(slices) == 0 else [])
        )
        # drop microseconds in datetime to match with last_modified header
        return max(dashboard_changed_on, slices_changed_on).replace(microsecond=0)

    @staticmethod
    def get_dashboard_and_datasets_changed_on(  # pylint: disable=invalid-name
        id_or_slug_or_dashboard: str | Dashboard,
    ) -> datetime:
        """
        Get latest changed datetime for a dashboard. The change could be a dashboard
        metadata change, a change to one of its dependent datasets.

        :param id_or_slug_or_dashboard: A dashboard or the ID or slug of the dashboard.
        :returns: The datetime the dashboard was last changed.
        """

        dashboard = (
            DashboardDAO.get_by_id_or_slug(id_or_slug_or_dashboard)
            if isinstance(id_or_slug_or_dashboard, str)
            else id_or_slug_or_dashboard
        )
        dashboard_changed_on = DashboardDAO.get_dashboard_changed_on(dashboard)
        datasources = dashboard.datasources
        datasources_changed_on = max(
            [datasource.changed_on for datasource in datasources]
            + ([datetime.fromtimestamp(0)] if len(datasources) == 0 else [])
        )
        # drop microseconds in datetime to match with last_modified header
        return max(dashboard_changed_on, datasources_changed_on).replace(microsecond=0)

    @staticmethod
    def validate_slug_uniqueness(slug: str) -> bool:
        if not slug:
            return True
        dashboard_query = db.session.query(Dashboard).filter(Dashboard.slug == slug)
        return not db.session.query(dashboard_query.exists()).scalar()

    @staticmethod
    def validate_update_slug_uniqueness(dashboard_id: int, slug: str | None) -> bool:
        if slug is not None:
            dashboard_query = db.session.query(Dashboard).filter(
                Dashboard.slug == slug, Dashboard.id != dashboard_id
            )
            return not db.session.query(dashboard_query.exists()).scalar()
        return True

    @staticmethod
    def set_dash_metadata(
        dashboard: Dashboard,
        data: dict[Any, Any],
        old_to_new_slice_ids: dict[int, int] | None = None,
    ) -> None:
        new_filter_scopes = {}
        md = dashboard.params_dict

        if (positions := data.get("positions")) is not None:
            # find slices in the position data
            slice_ids = [
                value.get("meta", {}).get("chartId")
                for value in positions.values()
                if isinstance(value, dict)
            ]

            current_slices = (
                db.session.query(Slice).filter(Slice.id.in_(slice_ids)).all()
            )

            dashboard.slices = current_slices

            # add UUID to positions
            uuid_map = {slice.id: str(slice.uuid) for slice in current_slices}
            for obj in positions.values():
                if (
                    isinstance(obj, dict)
                    and obj["type"] == "CHART"
                    and obj["meta"]["chartId"]
                ):
                    chart_id = obj["meta"]["chartId"]
                    obj["meta"]["uuid"] = uuid_map.get(chart_id)

            # remove leading and trailing white spaces in the dumped json
            dashboard.position_json = json.dumps(
                positions, indent=None, separators=(",", ":"), sort_keys=True
            )

            if "filter_scopes" in data:
                # replace filter_id and immune ids from old slice id to new slice id:
                # and remove slice ids that are not in dash anymore
                slc_id_dict: dict[int, int] = {}
                if old_to_new_slice_ids:
                    slc_id_dict = {
                        old: new
                        for old, new in old_to_new_slice_ids.items()
                        if new in slice_ids
                    }
                else:
                    slc_id_dict = {sid: sid for sid in slice_ids}
                new_filter_scopes = copy_filter_scopes(
                    old_to_new_slc_id_dict=slc_id_dict,
                    old_filter_scopes=json.loads(data["filter_scopes"] or "{}")
                    if isinstance(data["filter_scopes"], str)
                    else data["filter_scopes"],
                )

            default_filters_data = json.loads(data.get("default_filters", "{}"))
            applicable_filters = {
                key: v
                for key, v in default_filters_data.items()
                if int(key) in slice_ids
            }
            md["default_filters"] = json.dumps(applicable_filters)

            # positions have its own column, no need to store it in metadata
            md.pop("positions", None)

        if new_filter_scopes:
            md["filter_scopes"] = new_filter_scopes
        else:
            md.pop("filter_scopes", None)

        md.setdefault("timed_refresh_immune_slices", [])

        if data.get("color_namespace") is None:
            md.pop("color_namespace", None)
        else:
            md["color_namespace"] = data.get("color_namespace")

        md["expanded_slices"] = data.get("expanded_slices", {})
        md["refresh_frequency"] = data.get("refresh_frequency", 0)
        md["color_scheme"] = data.get("color_scheme", "")
        md["label_colors"] = data.get("label_colors", {})
        md["shared_label_colors"] = data.get("shared_label_colors", [])
        md["map_label_colors"] = data.get("map_label_colors", {})
        md["color_scheme_domain"] = data.get("color_scheme_domain", [])
        md["cross_filters_enabled"] = data.get("cross_filters_enabled", True)
        dashboard.json_metadata = json.dumps(md)

    @staticmethod
    def favorited_ids(dashboards: list[Dashboard]) -> list[FavStar]:
        ids = [dash.id for dash in dashboards]
        return [
            star.obj_id
            for star in db.session.query(FavStar.obj_id)
            .filter(
                FavStar.class_name == FavStarClassName.DASHBOARD,
                FavStar.obj_id.in_(ids),
                FavStar.user_id == get_user_id(),
            )
            .all()
        ]

    @classmethod
    def copy_dashboard(
        cls, original_dash: Dashboard, data: dict[str, Any]
    ) -> Dashboard:
        if is_feature_enabled("DASHBOARD_RBAC") and not security_manager.is_owner(
            original_dash
        ):
            raise DashboardForbiddenError()

        dash = Dashboard()
        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data["dashboard_title"]
        dash.css = data.get("css")

        metadata = json.loads(data["json_metadata"])
        old_to_new_slice_ids: dict[int, int] = {}
        if data.get("duplicate_slices"):
            # Duplicating slices as well, mapping old ids to new ones
            for slc in original_dash.slices:
                new_slice = slc.clone()
                new_slice.owners = [g.user] if g.user else []
                db.session.add(new_slice)
                db.session.flush()
                new_slice.dashboards.append(dash)
                old_to_new_slice_ids[slc.id] = new_slice.id

            # update chartId of layout entities
            for value in metadata["positions"].values():
                if isinstance(value, dict) and value.get("meta", {}).get("chartId"):
                    old_id = value["meta"]["chartId"]
                    new_id = old_to_new_slice_ids.get(old_id)
                    value["meta"]["chartId"] = new_id
        else:
            dash.slices = original_dash.slices

        dash.params = original_dash.params
        cls.set_dash_metadata(dash, metadata, old_to_new_slice_ids)
        db.session.add(dash)
        return dash

    @staticmethod
    def add_favorite(dashboard: Dashboard) -> None:
        ids = DashboardDAO.favorited_ids([dashboard])
        if dashboard.id not in ids:
            db.session.add(
                FavStar(
                    class_name=FavStarClassName.DASHBOARD,
                    obj_id=dashboard.id,
                    user_id=get_user_id(),
                    dttm=datetime.now(),
                )
            )

    @staticmethod
    def remove_favorite(dashboard: Dashboard) -> None:
        fav = (
            db.session.query(FavStar)
            .filter(
                FavStar.class_name == FavStarClassName.DASHBOARD,
                FavStar.obj_id == dashboard.id,
                FavStar.user_id == get_user_id(),
            )
            .one_or_none()
        )
        if fav:
            db.session.delete(fav)


class EmbeddedDashboardDAO(BaseDAO[EmbeddedDashboard]):
    # There isn't really a regular scenario where we would rather get Embedded by id
    id_column_name = "uuid"

    @staticmethod
    def upsert(dashboard: Dashboard, allowed_domains: list[str]) -> EmbeddedDashboard:
        """
        Sets up a dashboard to be embeddable.
        Upsert is used to preserve the embedded_dashboard uuid across updates.
        """
        embedded: EmbeddedDashboard = (
            dashboard.embedded[0] if dashboard.embedded else EmbeddedDashboard()
        )
        embedded.allow_domain_list = ",".join(allowed_domains)
        dashboard.embedded = [embedded]
        return embedded

    @classmethod
    def create(
        cls,
        item: EmbeddedDashboardDAO | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> Any:
        """
        Use EmbeddedDashboardDAO.upsert() instead.
        At least, until we are ok with more than one embedded item per dashboard.
        """
        raise NotImplementedError("Use EmbeddedDashboardDAO.upsert() instead.")
