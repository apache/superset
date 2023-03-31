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

import json
import logging
import uuid
from collections import defaultdict
from functools import partial
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type, Union

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
from sqlalchemy.sql.elements import BinaryExpression

from superset import app, db, is_feature_enabled, security_manager
from superset.connectors.base.models import BaseDatasource
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.datasource.dao import DatasourceDAO
from superset.extensions import cache_manager
from superset.models.filter_set import FilterSet
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.slice import Slice
from superset.models.user_attributes import UserAttribute
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.tasks.utils import get_current_user
from superset.thumbnails.digest import get_dashboard_digest
from superset.utils import core as utils
from superset.utils.core import get_user_id
from superset.utils.decorators import debounce

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


DashboardRoles = Table(
    "dashboard_roles",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id"), nullable=False),
    Column("role_id", Integer, ForeignKey("ab_role.id"), nullable=False),
)


# pylint: disable=too-many-public-methods
class Dashboard(Model, AuditMixinNullable, ImportExportMixin):
    """The dashboard object!"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(utils.MediumText())
    description = Column(Text)
    css = Column(Text)
    certified_by = Column(Text)
    certification_details = Column(Text)
    json_metadata = Column(Text)
    slug = Column(String(255), unique=True)
    slices: List[Slice] = relationship(
        Slice, secondary=dashboard_slices, backref="dashboards"
    )
    owners = relationship(security_manager.user_model, secondary=dashboard_user)
    tags = relationship(
        "Tag",
        secondary="tagged_object",
        primaryjoin="and_(Dashboard.id == TaggedObject.object_id)",
        secondaryjoin="and_(TaggedObject.tag_id == Tag.id, "
        "TaggedObject.object_type == 'dashboard')",
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
    _filter_sets = relationship(
        "FilterSet", back_populates="dashboard", cascade="all, delete"
    )
    export_fields = [
        "dashboard_title",
        "position_json",
        "json_metadata",
        "description",
        "css",
        "slug",
    ]
    extra_import_fields = ["is_managed_externally", "external_url"]

    def __repr__(self) -> str:
        return f"Dashboard<{self.id or self.slug}>"

    @property
    def url(self) -> str:
        return f"/superset/dashboard/{self.slug or self.id}/"

    @staticmethod
    def get_url(id_: int, slug: Optional[str] = None) -> str:
        # To be able to generate URL's without instanciating a Dashboard object
        return f"/superset/dashboard/{slug or id_}/"

    @property
    def datasources(self) -> Set[BaseDatasource]:
        # Verbose but efficient database enumeration of dashboard datasources.
        datasources_by_cls_model: Dict[Type["BaseDatasource"], Set[int]] = defaultdict(
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
    def filter_sets(self) -> Dict[int, FilterSet]:
        return {fs.id: fs for fs in self._filter_sets}

    @property
    def filter_sets_lst(self) -> Dict[int, FilterSet]:
        if security_manager.is_admin():
            return self._filter_sets
        filter_sets_by_owner_type: Dict[str, List[Any]] = {"Dashboard": [], "User": []}
        for fs in self._filter_sets:
            filter_sets_by_owner_type[fs.owner_type].append(fs)
        user_filter_sets = list(
            filter(
                lambda filter_set: filter_set.owner_id == get_user_id(),
                filter_sets_by_owner_type["User"],
            )
        )
        return {
            fs.id: fs
            for fs in user_filter_sets + filter_sets_by_owner_type["Dashboard"]
        }

    @property
    def charts(self) -> List[str]:
        return [slc.chart for slc in self.slices]

    @property
    def sqla_metadata(self) -> None:
        # pylint: disable=no-member
        with self.get_sqla_engine_with_context() as engine:
            meta = MetaData(bind=engine)
            meta.reflect()

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

    @cache_manager.cache.memoize(
        # manage cache version manually
        make_name=lambda fname: f"{fname}-v1.0",
        unless=lambda: not is_feature_enabled("DASHBOARD_CACHE"),
    )
    def datasets_trimmed_for_slices(self) -> List[Dict[str, Any]]:
        # Verbose but efficient database enumeration of dashboard datasources.
        slices_by_datasource: Dict[
            Tuple[Type["BaseDatasource"], int], Set[Slice]
        ] = defaultdict(set)

        for slc in self.slices:
            slices_by_datasource[(slc.cls_model, slc.datasource_id)].add(slc)

        result: List[Dict[str, Any]] = []

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
    def position(self) -> Dict[str, Any]:
        if self.position_json:
            return json.loads(self.position_json)
        return {}

    def update_thumbnail(self) -> None:
        cache_dashboard_thumbnail.delay(
            current_user=get_current_user(),
            dashboard_id=self.id,
            force=True,
        )

    @debounce(0.1)
    def clear_cache(self) -> None:
        cache_manager.cache.delete_memoized(Dashboard.datasets_trimmed_for_slices, self)

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
            [dashboard_slices.c.dashboard_id],
            distinct=True,
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

            json_metadata = json.loads(dashboard.json_metadata)
            native_filter_configuration: List[Dict[str, Any]] = json_metadata.get(
                "native_filter_configuration", []
            )
            for native_filter in native_filter_configuration:
                session = db.session()
                for target in native_filter.get("targets", []):
                    id_ = target.get("datasetId")
                    if id_ is None:
                        continue
                    datasource = DatasourceDAO.get_datasource(
                        session, utils.DatasourceType.TABLE, id_
                    )
                    datasource_ids.add((datasource.id, datasource.type))

            copied_dashboard.alter_params(remote_id=dashboard_id)
            copied_dashboards.append(copied_dashboard)

        eager_datasources = []
        for datasource_id, _ in datasource_ids:
            eager_datasource = SqlaTable.get_eager_sqlatable_datasource(
                db.session, datasource_id
            )
            copied_datasource = eager_datasource.copy()
            copied_datasource.alter_params(
                remote_id=eager_datasource.id,
                database_name=eager_datasource.database.name,
            )
            eager_datasources.append(copied_datasource)

        return json.dumps(
            {"dashboards": copied_dashboards, "datasources": eager_datasources},
            cls=utils.DashboardEncoder,
            indent=4,
        )

    @classmethod
    def get(cls, id_or_slug: Union[str, int]) -> Dashboard:
        qry = db.session.query(Dashboard).filter(id_or_slug_filter(id_or_slug))
        return qry.one_or_none()


def is_uuid(value: Union[str, int]) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def is_int(value: Union[str, int]) -> bool:
    try:
        int(value)
        return True
    except ValueError:
        return False


def id_or_slug_filter(id_or_slug: Union[int, str]) -> BinaryExpression:
    if is_int(id_or_slug):
        return Dashboard.id == int(id_or_slug)
    if is_uuid(id_or_slug):
        return Dashboard.uuid == uuid.UUID(str(id_or_slug))
    return Dashboard.slug == id_or_slug


OnDashboardChange = Callable[[Mapper, Connection, Dashboard], Any]

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
