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
from typing import Any, Dict, Optional, Type, TYPE_CHECKING
from urllib import parse

import sqlalchemy as sqla
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from markupsafe import escape, Markup
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import relationship
from sqlalchemy.orm.mapper import Mapper

from superset import ConnectorRegistry, db, is_feature_enabled, security_manager
from superset.legacy import update_time_range
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.models.tags import ChartUpdater
from superset.tasks.thumbnails import cache_chart_thumbnail
from superset.utils import core as utils
from superset.utils.hashing import md5_sha_from_str
from superset.utils.memoized import memoized
from superset.utils.urls import get_url_path
from superset.viz import BaseViz, viz_types

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource

metadata = Model.metadata  # pylint: disable=no-member
slice_user = Table(
    "slice_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)
logger = logging.getLogger(__name__)


class Slice(  # pylint: disable=too-many-public-methods
    Model, AuditMixinNullable, ImportExportMixin
):
    """A slice is essentially a report or a view on data"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    datasource_id = Column(Integer)
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)
    description = Column(Text)
    cache_timeout = Column(Integer)
    perm = Column(String(1000))
    schema_perm = Column(String(1000))
    # the last time a user has saved the chart, changed_on is referencing
    # when the database row was last written
    last_saved_at = Column(DateTime, nullable=True)
    last_saved_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    last_saved_by = relationship(
        security_manager.user_model, foreign_keys=[last_saved_by_fk]
    )
    owners = relationship(security_manager.user_model, secondary=slice_user)
    table = relationship(
        "SqlaTable",
        foreign_keys=[datasource_id],
        primaryjoin="and_(Slice.datasource_id == SqlaTable.id, "
        "Slice.datasource_type == 'table')",
        remote_side="SqlaTable.id",
        lazy="subquery",
    )

    token = ""

    export_fields = [
        "slice_name",
        "datasource_type",
        "datasource_name",
        "viz_type",
        "params",
        "query_context",
        "cache_timeout",
    ]
    export_parent = "table"

    def __repr__(self) -> str:
        return self.slice_name or str(self.id)

    @property
    def cls_model(self) -> Type["BaseDatasource"]:
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def datasource(self) -> Optional["BaseDatasource"]:
        return self.get_datasource

    def clone(self) -> "Slice":
        return Slice(
            slice_name=self.slice_name,
            datasource_id=self.datasource_id,
            datasource_type=self.datasource_type,
            datasource_name=self.datasource_name,
            viz_type=self.viz_type,
            params=self.params,
            description=self.description,
            cache_timeout=self.cache_timeout,
        )

    # pylint: disable=using-constant-test
    @datasource.getter  # type: ignore
    @memoized
    def get_datasource(self) -> Optional["BaseDatasource"]:
        return db.session.query(self.cls_model).filter_by(id=self.datasource_id).first()

    @renders("datasource_name")
    def datasource_link(self) -> Optional[Markup]:
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.link if datasource else None

    @renders("datasource_url")
    def datasource_url(self) -> Optional[str]:
        # pylint: disable=no-member
        if self.table:
            return self.table.explore_url
        datasource = self.datasource
        return datasource.explore_url if datasource else None

    def datasource_name_text(self) -> Optional[str]:
        # pylint: disable=no-member
        if self.table:
            if self.table.schema:
                return f"{self.table.schema}.{self.table.table_name}"
            return self.table.table_name
        if self.datasource:
            if self.datasource.schema:
                return f"{self.datasource.schema}.{self.datasource.name}"
            return self.datasource.name
        return None

    @property
    def datasource_edit_url(self) -> Optional[str]:
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.url if datasource else None

    # pylint: enable=using-constant-test

    @property  # type: ignore
    @memoized
    def viz(self) -> Optional[BaseViz]:
        form_data = json.loads(self.params)
        viz_class = viz_types.get(self.viz_type)
        datasource = self.datasource
        if viz_class and datasource:
            return viz_class(datasource=datasource, form_data=form_data)
        return None

    @property
    def description_markeddown(self) -> str:
        return utils.markdown(self.description)

    @property
    def data(self) -> Dict[str, Any]:
        """Data used to render slice in templates"""
        data: Dict[str, Any] = {}
        self.token = ""
        try:
            viz = self.viz
            data = viz.data if viz else self.form_data
            self.token = utils.get_form_data_token(data)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            data["error"] = str(ex)
        return {
            "cache_timeout": self.cache_timeout,
            "changed_on": self.changed_on.isoformat(),
            "changed_on_humanized": self.changed_on_humanized,
            "datasource": self.datasource_name,
            "description": self.description,
            "description_markeddown": self.description_markeddown,
            "edit_url": self.edit_url,
            "form_data": self.form_data,
            "query_context": self.query_context,
            "modified": self.modified(),
            "owners": [owner.id for owner in self.owners],
            "slice_id": self.id,
            "slice_name": self.slice_name,
            "slice_url": self.slice_url,
        }

    @property
    def digest(self) -> str:
        """
        Returns a MD5 HEX digest that makes this dashboard unique
        """
        return md5_sha_from_str(self.params or "")

    @property
    def thumbnail_url(self) -> str:
        """
        Returns a thumbnail URL with a HEX digest. We want to avoid browser cache
        if the dashboard has changed
        """
        return f"/api/v1/chart/{self.id}/thumbnail/{self.digest}/"

    @property
    def json_data(self) -> str:
        return json.dumps(self.data)

    @property
    def form_data(self) -> Dict[str, Any]:
        form_data: Dict[str, Any] = {}
        try:
            form_data = json.loads(self.params)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Malformed json in slice's params", exc_info=True)
            logger.exception(ex)
        form_data.update(
            {
                "slice_id": self.id,
                "viz_type": self.viz_type,
                "datasource": "{}__{}".format(self.datasource_id, self.datasource_type),
            }
        )

        if self.cache_timeout:
            form_data["cache_timeout"] = self.cache_timeout
        update_time_range(form_data)
        return form_data

    def get_explore_url(
        self,
        base_url: str = "/superset/explore",
        overrides: Optional[Dict[str, Any]] = None,
    ) -> str:
        overrides = overrides or {}
        form_data = {"slice_id": self.id}
        form_data.update(overrides)
        params = parse.quote(json.dumps(form_data))
        return f"{base_url}/?form_data={params}"

    @property
    def slice_url(self) -> str:
        """Defines the url to access the slice"""
        return self.get_explore_url()

    @property
    def explore_json_url(self) -> str:
        """Defines the url to access the slice"""
        return self.get_explore_url("/superset/explore_json")

    @property
    def edit_url(self) -> str:
        return f"/chart/edit/{self.id}"

    @property
    def chart(self) -> str:
        return self.slice_name or "<empty>"

    @property
    def slice_link(self) -> Markup:
        name = escape(self.chart)
        return Markup(f'<a href="{self.url}">{name}</a>')

    @property
    def changed_by_url(self) -> str:
        return f"/superset/profile/{self.changed_by.username}"  # type: ignore

    @property
    def icons(self) -> str:
        return f"""
        <a
                href="{self.datasource_edit_url}"
                data-toggle="tooltip"
                title="{self.datasource}">
            <i class="fa fa-database"></i>
        </a>
        """

    @property
    def url(self) -> str:
        return f"/superset/explore/?form_data=%7B%22slice_id%22%3A%20{self.id}%7D"


def set_related_perm(_mapper: Mapper, _connection: Connection, target: Slice) -> None:
    src_class = target.cls_model
    id_ = target.datasource_id
    if id_:
        ds = db.session.query(src_class).filter_by(id=int(id_)).first()
        if ds:
            target.perm = ds.perm
            target.schema_perm = ds.schema_perm


def event_after_chart_changed(
    _mapper: Mapper, _connection: Connection, target: Slice
) -> None:
    url = get_url_path("Superset.slice", slice_id=target.id, standalone="true")
    cache_chart_thumbnail.delay(url, target.digest, force=True)


sqla.event.listen(Slice, "before_insert", set_related_perm)
sqla.event.listen(Slice, "before_update", set_related_perm)

# events for updating tags
if is_feature_enabled("TAGGING_SYSTEM"):
    sqla.event.listen(Slice, "after_insert", ChartUpdater.after_insert)
    sqla.event.listen(Slice, "after_update", ChartUpdater.after_update)
    sqla.event.listen(Slice, "after_delete", ChartUpdater.after_delete)

# events for updating tags
if is_feature_enabled("THUMBNAILS_SQLA_LISTENERS"):
    sqla.event.listen(Slice, "after_insert", event_after_chart_changed)
    sqla.event.listen(Slice, "after_update", event_after_chart_changed)
