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
import json
import logging
from functools import partial
from typing import Any, Callable, Dict, List, Set, Union

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
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import relationship, sessionmaker, subqueryload
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.orm.session import object_session
from sqlalchemy.sql import join, select

from superset import app, ConnectorRegistry, db, is_feature_enabled, security_manager
from superset.connectors.base.models import BaseDatasource
from superset.connectors.druid.models import DruidColumn, DruidMetric
from superset.connectors.sqla.models import SqlMetric, TableColumn
from superset.extensions import cache_manager
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.slice import Slice
from superset.models.tags import DashboardUpdater
from superset.models.user_attributes import UserAttribute
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.utils import core as utils
from superset.utils.decorators import debounce
from superset.utils.urls import get_url_path

metadata = Model.metadata  # pylint: disable=no-member
config = app.config
logger = logging.getLogger(__name__)


def copy_dashboard(
    _mapper: Mapper, connection: Connection, target: "Dashboard"
) -> None:
    dashboard_id = config["DASHBOARD_TEMPLATE_ID"]
    if dashboard_id is None:
        return

    session_class = sessionmaker(autoflush=False)
    session = session_class(bind=connection)
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
    session.commit()

    # set dashboard as the welcome dashboard
    extra_attributes = UserAttribute(
        user_id=target.id, welcome_dashboard_id=dashboard.id
    )
    session.add(extra_attributes)
    session.commit()


sqla.event.listen(User, "after_insert", copy_dashboard)


dashboard_slices = Table(
    "dashboard_slices",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
    UniqueConstraint("dashboard_id", "slice_id"),
)


dashboard_user = Table(
    "dashboard_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
)


class Dashboard(  # pylint: disable=too-many-instance-attributes
    Model, AuditMixinNullable, ImportExportMixin
):

    """The dashboard object!"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(utils.MediumText())
    description = Column(Text)
    css = Column(Text)
    json_metadata = Column(Text)
    slug = Column(String(255), unique=True)
    slices = relationship(Slice, secondary=dashboard_slices, backref="dashboards")
    owners = relationship(security_manager.user_model, secondary=dashboard_user)
    published = Column(Boolean, default=False)

    export_fields = [
        "dashboard_title",
        "position_json",
        "json_metadata",
        "description",
        "css",
        "slug",
    ]

    def __repr__(self) -> str:
        return f"Dashboard<{self.id or self.slug}>"

    @property
    def table_names(self) -> str:
        # pylint: disable=no-member
        return ", ".join(str(s.datasource.full_name) for s in self.slices)

    @property
    def url(self) -> str:
        return f"/superset/dashboard/{self.slug or self.id}/"

    @property
    def datasources(self) -> Set[BaseDatasource]:
        return {slc.datasource for slc in self.slices}

    @property
    def charts(self) -> List[BaseDatasource]:
        return [slc.chart for slc in self.slices]

    @property
    def sqla_metadata(self) -> None:
        # pylint: disable=no-member
        meta = MetaData(bind=self.get_sqla_engine())
        meta.reflect()

    @renders("dashboard_title")
    def dashboard_link(self) -> Markup:
        title = escape(self.dashboard_title or "<empty>")
        return Markup(f'<a href="{self.url}">{title}</a>')

    @property
    def digest(self) -> str:
        """
        Returns a MD5 HEX digest that makes this dashboard unique
        """
        unique_string = f"{self.position_json}.{self.css}.{self.json_metadata}"
        return utils.md5_hex(unique_string)

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
    def changed_by_url(self) -> str:
        if not self.changed_by:
            return ""
        return f"/superset/profile/{self.changed_by.username}"

    @property
    def data(self) -> Dict[str, Any]:
        positions = self.position_json
        if positions:
            positions = json.loads(positions)
        return {
            "id": self.id,
            "metadata": self.params_dict,
            "css": self.css,
            "dashboard_title": self.dashboard_title,
            "published": self.published,
            "slug": self.slug,
            "slices": [slc.data for slc in self.slices],
            "position_json": positions,
            "last_modified_time": self.changed_on.replace(microsecond=0).timestamp(),
        }

    @cache_manager.cache.memoize(
        # manage cache version manually
        make_name=lambda fname: f"{fname}-v2.1",
        unless=lambda: not is_feature_enabled("DASHBOARD_CACHE"),
    )
    def full_data(self) -> Dict[str, Any]:
        """Bootstrap data for rendering the dashboard page."""
        slices = self.slices
        datasource_slices = utils.indexed(slices, "datasource")
        return {
            # dashboard metadata
            "dashboard": self.data,
            # slices metadata
            "slices": [slc.data for slc in slices],
            # datasource metadata
            "datasources": {
                # Filter out unneeded fields from the datasource payload
                datasource.uid: datasource.data_for_slices(slices)
                for datasource, slices in datasource_slices.items()
            },
        }

    @property  # type: ignore
    def params(self) -> str:  # type: ignore
        return self.json_metadata

    @params.setter
    def params(self, value: str) -> None:
        self.json_metadata = value

    @property
    def position(self) -> Dict[str, Any]:
        if self.position_json:
            return json.loads(self.position_json)
        return {}

    def update_thumbnail(self) -> None:
        url = get_url_path("Superset.dashboard", dashboard_id_or_slug=self.id)
        cache_dashboard_thumbnail.delay(url, self.digest, force=True)

    @debounce(0.1)
    def clear_cache(self) -> None:
        cache_manager.cache.delete_memoized(Dashboard.full_data, self)

    @classmethod
    @debounce(0.1)
    def clear_cache_for_slice(cls, slice_id: int) -> None:
        filter_query = select([dashboard_slices.c.dashboard_id], distinct=True).where(
            dashboard_slices.c.slice_id == slice_id
        )
        for (dashboard_id,) in db.engine.execute(filter_query):
            cls(id=dashboard_id).clear_cache()

    @classmethod
    @debounce(0.1)
    def clear_cache_for_datasource(cls, datasource_id: int) -> None:
        filter_query = select(
            [dashboard_slices.c.dashboard_id], distinct=True,
        ).select_from(
            join(
                dashboard_slices,
                Slice,
                (Slice.id == dashboard_slices.c.slice_id)
                & (Slice.datasource_id == datasource_id),
            )
        )
        for (dashboard_id,) in db.engine.execute(filter_query):
            cls(id=dashboard_id).clear_cache()

    @classmethod
    def export_dashboards(  # pylint: disable=too-many-locals
        cls, dashboard_ids: List[int]
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
            copied_dashboard.alter_params(remote_id=dashboard_id)
            copied_dashboards.append(copied_dashboard)

        eager_datasources = []
        for datasource_id, datasource_type in datasource_ids:
            eager_datasource = ConnectorRegistry.get_eager_datasource(
                db.session, datasource_type, datasource_id
            )
            copied_datasource = eager_datasource.copy()
            copied_datasource.alter_params(
                remote_id=eager_datasource.id,
                database_name=eager_datasource.database.name,
            )
            datasource_class = copied_datasource.__class__
            for field_name in datasource_class.export_children:
                field_val = getattr(eager_datasource, field_name).copy()
                # set children without creating ORM relations
                copied_datasource.__dict__[field_name] = field_val
            eager_datasources.append(copied_datasource)

        return json.dumps(
            {"dashboards": copied_dashboards, "datasources": eager_datasources},
            cls=utils.DashboardEncoder,
            indent=4,
        )


OnDashboardChange = Callable[[Mapper, Connection, Dashboard], Any]

# events for updating tags
if is_feature_enabled("TAGGING_SYSTEM"):
    sqla.event.listen(Dashboard, "after_insert", DashboardUpdater.after_insert)
    sqla.event.listen(Dashboard, "after_update", DashboardUpdater.after_update)
    sqla.event.listen(Dashboard, "after_delete", DashboardUpdater.after_delete)

if is_feature_enabled("THUMBNAILS_SQLA_LISTENERS"):
    update_thumbnail: OnDashboardChange = lambda _, __, dash: dash.update_thumbnail()
    sqla.event.listen(Dashboard, "after_insert", update_thumbnail)
    sqla.event.listen(Dashboard, "after_update", update_thumbnail)

if is_feature_enabled("DASHBOARD_CACHE"):

    def clear_dashboard_cache(
        _mapper: Mapper,
        _connection: Connection,
        obj: Union[Slice, BaseDatasource, Dashboard],
        check_modified: bool = True,
    ) -> None:
        if check_modified and not object_session(obj).is_modified(obj):
            # needed for avoiding excessive cache purging when duplicating a dashboard
            return
        if isinstance(obj, Dashboard):
            obj.clear_cache()
        elif isinstance(obj, Slice):
            Dashboard.clear_cache_for_slice(slice_id=obj.id)
        elif isinstance(obj, BaseDatasource):
            Dashboard.clear_cache_for_datasource(datasource_id=obj.id)
        elif isinstance(obj, (SqlMetric, TableColumn)):
            Dashboard.clear_cache_for_datasource(datasource_id=obj.table_id)
        elif isinstance(obj, (DruidMetric, DruidColumn)):
            Dashboard.clear_cache_for_datasource(datasource_id=obj.datasource_id)

    sqla.event.listen(Dashboard, "after_update", clear_dashboard_cache)
    sqla.event.listen(
        Dashboard, "after_delete", partial(clear_dashboard_cache, check_modified=False)
    )
    sqla.event.listen(Slice, "after_update", clear_dashboard_cache)
    sqla.event.listen(Slice, "after_delete", clear_dashboard_cache)
    sqla.event.listen(
        BaseDatasource, "after_update", clear_dashboard_cache, propagate=True
    )
    # also clear cache on column/metric updates since updates to these will not
    # trigger update events for BaseDatasource.
    sqla.event.listen(SqlMetric, "after_update", clear_dashboard_cache)
    sqla.event.listen(TableColumn, "after_update", clear_dashboard_cache)
    sqla.event.listen(DruidMetric, "after_update", clear_dashboard_cache)
    sqla.event.listen(DruidColumn, "after_update", clear_dashboard_cache)
