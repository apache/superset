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
import uuid
from collections import defaultdict, deque
from typing import Any, Callable

import sqlalchemy as sqla
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.security.sqla.models import User
from markupsafe import escape, Markup
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import relationship, subqueryload
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.sql.elements import BinaryExpression

from superset import app, db, is_feature_enabled, security_manager
from superset.connectors.sqla.models import BaseDatasource, SqlaTable
from superset.daos.datasource import DatasourceDAO
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.slice import Slice
from superset.models.user_attributes import UserAttribute
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.tasks.utils import get_current_user
from superset.thumbnails.digest import get_dashboard_digest
from superset.utils import core as utils, json

metadata = Model.metadata  # pylint: disable=no-member
config = app.config
logger = logging.getLogger(__name__)


def copy_dashboard(_mapper: Mapper, _connection: Connection, target: Dashboard) -> None:
    dashboard_id = config["DASHBOARD_TEMPLATE_ID"]
    if dashboard_id is None:
        return

    session = sqla.inspect(target).session  # pylint: disable=disallowed-name
    new_user = session.query(User).filter_by(id=target.id).first()

    # copy template dashboard to user
    template = session.query(Dashboard).filter_by(id=int(dashboard_id)).first()
    dashboard = Dashboard(
        dashboard_title=template.dashboard_title,
        position_json=template.position_json,
        description=template.description,
        css=template.css,
        json_metadata=template.json_metadata,
        slices=template.slices,
        owners=[new_user],
    )
    session.add(dashboard)

    # set dashboard as the welcome dashboard
    extra_attributes = UserAttribute(
        user_id=target.id, welcome_dashboard_id=dashboard.id
    )
    session.add(extra_attributes)
    session.commit()  # pylint: disable=consider-using-transaction


sqla.event.listen(User, "after_insert", copy_dashboard)


dashboard_slices = Table(
    "dashboard_slices",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id", ondelete="CASCADE")),
    Column("slice_id", Integer, ForeignKey("slices.id", ondelete="CASCADE")),
    UniqueConstraint("dashboard_id", "slice_id"),
)


dashboard_user = Table(
    "dashboard_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id", ondelete="CASCADE")),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id", ondelete="CASCADE")),
)


DashboardRoles = Table(
    "dashboard_roles",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "dashboard_id",
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column(
        "role_id",
        Integer,
        ForeignKey("ab_role.id", ondelete="CASCADE"),
        nullable=False,
    ),
)


class Dashboard(AuditMixinNullable, ImportExportMixin, Model):
    """The dashboard object!"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(utils.MediumText())
    description = Column(Text)
    css = Column(utils.MediumText())
    certified_by = Column(Text)
    certification_details = Column(Text)
    json_metadata = Column(utils.MediumText())
    slug = Column(String(255), unique=True)
    slices: list[Slice] = relationship(
        Slice, secondary=dashboard_slices, backref="dashboards"
    )
    owners = relationship(
        security_manager.user_model,
        secondary=dashboard_user,
        passive_deletes=True,
    )
    tags = relationship(
        "Tag",
        overlaps="objects,tag,tags",
        secondary="tagged_object",
        primaryjoin="and_(Dashboard.id == TaggedObject.object_id, "
        "TaggedObject.object_type == 'dashboard')",
        secondaryjoin="TaggedObject.tag_id == Tag.id",
        viewonly=True,  # cascading deletion already handled by superset.tags.models.ObjectUpdater.after_delete
    )
    published = Column(Boolean, default=False)
    is_managed_externally = Column(Boolean, nullable=False, default=False)
    external_url = Column(Text, nullable=True)
    roles = relationship(security_manager.role_model, secondary=DashboardRoles)
    embedded = relationship(
        "EmbeddedDashboard",
        back_populates="dashboard",
        cascade="all, delete-orphan",
    )
    export_fields = [
        "dashboard_title",
        "position_json",
        "json_metadata",
        "description",
        "css",
        "slug",
        "certified_by",
        "certification_details",
        "published",
    ]
    extra_import_fields = ["is_managed_externally", "external_url"]

    def __repr__(self) -> str:
        return f"Dashboard<{self.id or self.slug}>"

    @property
    def url(self) -> str:
        return f"/superset/dashboard/{self.slug or self.id}/"

    @staticmethod
    def get_url(id_: int, slug: str | None = None) -> str:
        # To be able to generate URL's without instantiating a Dashboard object
        return f"/superset/dashboard/{slug or id_}/"

    @property
    def datasources(self) -> set[BaseDatasource]:
        # Verbose but efficient database enumeration of dashboard datasources.
        datasources_by_cls_model: dict[type[BaseDatasource], set[int]] = defaultdict(
            set
        )

        for slc in self.slices:
            datasources_by_cls_model[slc.cls_model].add(slc.datasource_id)

        return {
            datasource
            for cls_model, datasource_ids in datasources_by_cls_model.items()
            for datasource in db.session.query(cls_model)
            .filter(cls_model.id.in_(datasource_ids))
            .all()
        }

    @property
    def charts(self) -> list[str]:
        return [slc.chart for slc in self.slices]

    @property
    def status(self) -> utils.DashboardStatus:
        if self.published:
            return utils.DashboardStatus.PUBLISHED
        return utils.DashboardStatus.DRAFT

    @renders("dashboard_title")
    def dashboard_link(self) -> Markup:
        title = escape(self.dashboard_title or "<empty>")
        return Markup(f'<a href="{self.url}">{title}</a>')

    @property
    def digest(self) -> str:
        return get_dashboard_digest(self)

    @property
    def thumbnail_url(self) -> str:
        """
        Returns a thumbnail URL with a HEX digest. We want to avoid browser cache
        if the dashboard has changed
        """
        return f"/api/v1/dashboard/{self.id}/thumbnail/{self.digest}/"

    @property
    def changed_by_name(self) -> str:
        if not self.changed_by:
            return ""
        return str(self.changed_by)

    @property
    def data(self) -> dict[str, Any]:
        positions = self.position_json
        if positions:
            positions = json.loads(positions)
        return {
            "id": self.id,
            "metadata": self.params_dict,
            "certified_by": self.certified_by,
            "certification_details": self.certification_details,
            "css": self.css,
            "dashboard_title": self.dashboard_title,
            "published": self.published,
            "slug": self.slug,
            "slices": [slc.data for slc in self.slices],
            "position_json": positions,
            "last_modified_time": self.changed_on.replace(microsecond=0).timestamp(),
            "is_managed_externally": self.is_managed_externally,
        }

    def datasets_trimmed_for_slices(self) -> list[dict[str, Any]]:
        # Verbose but efficient database enumeration of dashboard datasources.
        slices_by_datasource: dict[tuple[type[BaseDatasource], int], set[Slice]] = (
            defaultdict(set)
        )

        for slc in self.slices:
            slices_by_datasource[(slc.cls_model, slc.datasource_id)].add(slc)

        result: list[dict[str, Any]] = []

        for (cls_model, datasource_id), slices in slices_by_datasource.items():
            datasource = (
                db.session.query(cls_model).filter_by(id=datasource_id).one_or_none()
            )

            if datasource:
                # Filter out unneeded fields from the datasource payload
                result.append(datasource.data_for_slices(slices))

        return result

    @property
    def params(self) -> str:
        return self.json_metadata

    @params.setter
    def params(self, value: str) -> None:
        self.json_metadata = value

    @property
    def position(self) -> dict[str, Any]:
        if self.position_json:
            return json.loads(self.position_json)
        return {}

    @property
    def tabs(self) -> dict[str, Any]:
        if self.position == {}:
            return {}

        def get_node(node_id: str) -> dict[str, Any]:
            """
            Helper function for getting a node from the position_data
            """
            return self.position[node_id]

        def build_tab_tree(
            node: dict[str, Any], children: list[dict[str, Any]]
        ) -> None:
            """
            Function for building the tab tree structure and list of all tabs
            """

            new_children: list[dict[str, Any]] = []
            # new children to overwrite parent's children
            for child_id in node.get("children", []):
                child = get_node(child_id)
                if node["type"] == "TABS":
                    # if TABS add create a new list and append children to it
                    # new_children.append(child)
                    children.append(child)
                    queue.append((child, new_children))
                elif node["type"] in ["GRID", "ROOT"]:
                    queue.append((child, children))
                elif node["type"] == "TAB":
                    queue.append((child, new_children))
            if node["type"] == "TAB":
                node["children"] = new_children
                node["title"] = node["meta"]["text"]
                node["value"] = node["id"]
                all_tabs[node["id"]] = node["title"]

        root = get_node("ROOT_ID")
        tab_tree: list[dict[str, Any]] = []
        all_tabs: dict[str, str] = {}
        queue: deque[tuple[dict[str, Any], list[dict[str, Any]]]] = deque()
        queue.append((root, tab_tree))
        while queue:
            node, children = queue.popleft()
            build_tab_tree(node, children)

        return {"all_tabs": all_tabs, "tab_tree": tab_tree}

    def update_thumbnail(self) -> None:
        cache_dashboard_thumbnail.delay(
            current_user=get_current_user(),
            dashboard_id=self.id,
            force=True,
        )

    @classmethod
    def export_dashboards(  # pylint: disable=too-many-locals
        cls,
        dashboard_ids: set[int],
    ) -> str:
        copied_dashboards = []
        datasource_ids = set()
        for dashboard_id in dashboard_ids:
            # make sure that dashboard_id is an integer
            dashboard_id = int(dashboard_id)
            dashboard = (
                db.session.query(Dashboard)
                .options(subqueryload(Dashboard.slices))
                .filter_by(id=dashboard_id)
                .first()
            )
            # remove ids and relations (like owners, created by, slices, ...)
            copied_dashboard = dashboard.copy()
            for slc in dashboard.slices:
                datasource_ids.add((slc.datasource_id, slc.datasource_type))
                copied_slc = slc.copy()
                # save original id into json
                # we need it to update dashboard's json metadata on import
                copied_slc.id = slc.id
                # add extra params for the import
                copied_slc.alter_params(
                    remote_id=slc.id,
                    datasource_name=slc.datasource.datasource_name,
                    schema=slc.datasource.schema,
                    database_name=slc.datasource.database.name,
                )
                # set slices without creating ORM relations
                slices = copied_dashboard.__dict__.setdefault("slices", [])
                slices.append(copied_slc)

            json_metadata = json.loads(dashboard.json_metadata)
            native_filter_configuration: list[dict[str, Any]] = json_metadata.get(
                "native_filter_configuration", []
            )
            for native_filter in native_filter_configuration:
                for target in native_filter.get("targets", []):
                    id_ = target.get("datasetId")
                    if id_ is None:
                        continue
                    datasource = DatasourceDAO.get_datasource(
                        utils.DatasourceType.TABLE, id_
                    )
                    datasource_ids.add((datasource.id, datasource.type))

            copied_dashboard.alter_params(remote_id=dashboard_id)
            copied_dashboards.append(copied_dashboard)

        datasource_id_list = list(datasource_ids)
        datasource_id_list.sort()

        eager_datasources = []
        for datasource_id, _ in datasource_id_list:
            eager_datasource = SqlaTable.get_eager_sqlatable_datasource(datasource_id)
            copied_datasource = eager_datasource.copy()
            copied_datasource.alter_params(
                remote_id=eager_datasource.id,
                database_name=eager_datasource.database.name,
            )
            eager_datasources.append(copied_datasource)

        return json.dumps(
            {"dashboards": copied_dashboards, "datasources": eager_datasources},
            cls=json.DashboardEncoder,
            indent=4,
        )

    @classmethod
    def get(cls, id_or_slug: str | int) -> Dashboard:
        qry = db.session.query(Dashboard).filter(id_or_slug_filter(id_or_slug))
        return qry.one_or_none()

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """

        security_manager.raise_for_access(dashboard=self)


def is_uuid(value: str | int) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def is_int(value: str | int) -> bool:
    try:
        int(value)
        return True
    except ValueError:
        return False


def id_or_slug_filter(id_or_slug: int | str) -> BinaryExpression:
    if is_int(id_or_slug):
        return Dashboard.id == int(id_or_slug)
    if is_uuid(id_or_slug):
        return Dashboard.uuid == uuid.UUID(str(id_or_slug))
    return Dashboard.slug == id_or_slug


OnDashboardChange = Callable[[Mapper, Connection, Dashboard], Any]

if is_feature_enabled("THUMBNAILS_SQLA_LISTENERS"):
    update_thumbnail: OnDashboardChange = lambda _, __, dash: dash.update_thumbnail()  # noqa: E731
    sqla.event.listen(Dashboard, "after_insert", update_thumbnail)
    sqla.event.listen(Dashboard, "after_update", update_thumbnail)
