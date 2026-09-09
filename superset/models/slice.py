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
from typing import Any, TYPE_CHECKING
from urllib import parse

import sqlalchemy as sqla
from flask import has_request_context, url_for
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from markupsafe import escape, Markup
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import relationship
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.sql.elements import BinaryExpression
from superset_core.common.models import Chart as CoreChart

from superset import db, is_feature_enabled, security_manager
from superset.legacy import update_time_range
from superset.models.helpers import (
    AuditMixinNullable,
    ImportExportMixin,
    SoftDeleteMixin,
)
from superset.security.manager import get_extra_editor_subject_ids
from superset.subjects.models import chart_editors, chart_viewers, Subject
from superset.tasks.thumbnails import cache_chart_thumbnail
from superset.tasks.utils import get_current_user
from superset.thumbnails.digest import get_chart_digest
from superset.utils import core as utils, json

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_context_factory import QueryContextFactory
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.datasource import Datasource

    # avoid circular import: superset.connectors.sqla.models imports this module,
    # and superset.semantic_layers.models -> semantic_layers.mapper imports
    # superset.connectors.sqla.models. The ``semantic_view`` relationship below
    # names its target as a string, so the class is only needed for typing.
    from superset.semantic_layers.models import SemanticView

metadata = Model.metadata  # pylint: disable=no-member
logger = logging.getLogger(__name__)


class Slice(  # pylint: disable=too-many-public-methods
    CoreChart, SoftDeleteMixin, AuditMixinNullable, ImportExportMixin
):
    """A slice is essentially a report or a view on data"""

    query_context_factory: QueryContextFactory | None = None

    __tablename__ = "slices"
    __table_args__: tuple[sqla.Index, ...] = (
        sqla.Index(
            "ix_slices_datasource_type_datasource_id",
            "datasource_type",
            "datasource_id",
        ),
    )
    # query_context is excluded: it is a cached/regenerated field, not user-authored.
    # deleted_at is deletion-state metadata (SoftDeleteMixin), tracked by soft
    # delete, not content versioning; it is also absent from the slices_version
    # shadow table, so leaving it in would fail every capture INSERT.
    # Exclude M2M association relationships: Continuum only captures FK columns on
    # association INSERTs (not the auto-increment id), which breaks the NOT NULL PK.
    # Ownership changes are administrative metadata, not user-authored content.
    # Audit / save-marker columns are auto-bumped on every save. Excluding
    # them lets Continuum's is_modified() return False on no-op saves
    # (e.g. owners-only edits) so we don't create empty version rows.
    # version_transaction.user_id / issued_at preserve "who/when".
    # The perm-string class (perm / schema_perm / catalog_perm) is derived
    # security state, not user-authored content: permission maintenance
    # rewrites it in bulk, and versioning it produced phantom transactions
    # flooding the activity stream (10 "Chart updated" rows for one user
    # save — surfaced by the version-history UI). Excluding it
    # also means a restore can't resurrect stale permission strings; the
    # live, derived values stay authoritative.
    __versioned__: dict[str, Any] = {
        "exclude": [
            "query_context",
            "owners",
            "editors",
            "viewers",
            "dashboards",
            "changed_on",
            "created_on",
            "changed_by_fk",
            "created_by_fk",
            "last_saved_at",
            "last_saved_by_fk",
            "perm",
            "schema_perm",
            "catalog_perm",
            "deleted_at",
        ]
    }
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    datasource_id = Column(Integer)
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(utils.MediumText())
    query_context = Column(utils.MediumText())
    description = Column(Text)
    cache_timeout = Column(Integer)
    perm = Column(String(1000))
    schema_perm = Column(String(1000))
    catalog_perm = Column(String(1000), nullable=True, default=None)
    # the last time a user has saved the chart, changed_on is referencing
    # when the database row was last written
    last_saved_at = Column(DateTime, nullable=True)
    last_saved_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    certified_by = Column(Text)
    certification_details = Column(Text)
    is_managed_externally = Column(Boolean, nullable=False, default=False)
    external_url = Column(Text, nullable=True)
    last_saved_by = relationship(
        security_manager.user_model, foreign_keys=[last_saved_by_fk]
    )
    editors = relationship(
        Subject,
        secondary=chart_editors,
        passive_deletes=True,
    )
    viewers = relationship(
        Subject,
        secondary=chart_viewers,
        passive_deletes=True,
    )

    tags = relationship(
        "Tag",
        secondary="tagged_object",
        overlaps="objects,tag,tags",
        primaryjoin="and_(Slice.id == TaggedObject.object_id, "
        "TaggedObject.object_type == 'chart')",
        secondaryjoin="TaggedObject.tag_id == Tag.id",
        viewonly=True,  # cascading deletion already handled by superset.tags.models.ObjectUpdater.after_delete  # noqa: E501
    )
    table = relationship(
        "SqlaTable",
        foreign_keys=[datasource_id],
        overlaps="table",
        primaryjoin="and_(Slice.datasource_id == SqlaTable.id, "
        "Slice.datasource_type == 'table')",
        remote_side="SqlaTable.id",
        lazy="subquery",
    )
    # Counterpart of ``table`` for charts built on a semantic view. ``datasource_id``
    # is only unique within a ``datasource_type``, so the join is guarded on the
    # type to keep a same-id dataset from being resolved by mistake. View-only:
    # ``datasource_id`` is written by the chart, never through this relationship.
    # ``selectin`` costs one extra bounded ``IN (...)`` query per batch of charts
    # loaded (the type predicate rules out the FK-only shortcut); the default
    # lazy load would be one query per semantic-view chart on a list page. The
    # string target resolves because ``superset.daos.datasource`` imports
    # ``SemanticView`` unconditionally during app initialisation.
    semantic_view = relationship(
        "SemanticView",
        foreign_keys=[datasource_id],
        primaryjoin="and_(Slice.datasource_id == SemanticView.id, "
        "Slice.datasource_type == 'semantic_view')",
        remote_side="SemanticView.id",
        viewonly=True,
        lazy="selectin",
    )

    token = ""

    export_fields = [
        "slice_name",
        "description",
        "certified_by",
        "certification_details",
        "datasource_type",
        "datasource_name",
        "viz_type",
        "params",
        "query_context",
        "cache_timeout",
    ]
    export_parent = "table"
    extra_import_fields = ["is_managed_externally", "external_url"]

    def __repr__(self) -> str:
        return self.slice_name or str(self.id)

    @property
    def datasource(self) -> SqlaTable | None:
        return self.table

    def _display_datasource(self) -> SqlaTable | SemanticView | None:
        """Return the datasource used to name and link this chart in listings.

        Display-only counterpart of ``datasource``: it also resolves semantic
        views, selected strictly by ``datasource_type`` so a chart can never be
        labelled with a same-id datasource of another kind. ``datasource`` itself
        deliberately stays ``SqlaTable``-only because access checks and exports
        depend on that type.
        """
        if self.datasource_type == utils.DatasourceType.SEMANTIC_VIEW:
            return self.semantic_view
        return self.table

    @property
    def resolved_datasource(self) -> Datasource | None:
        """The chart's datasource, resolved across datasource types.

        ``Slice.datasource`` is pinned to table-backed datasources (the
        ``table`` relationship joins on ``datasource_type == 'table'``), so
        charts on other datasource types — semantic views in particular —
        resolve to ``None`` there. Authorization call sites must use this
        resolver instead, so those charts participate in access checks
        rather than silently vanishing from them.

        Returns ``None`` when the datasource row does not exist, the type is
        unknown, or the resolved model does not participate in access
        control (no ``perm``, e.g. ``SavedQuery``); callers must treat
        ``None`` as inaccessible, never as absent. Non-table lookups issue a
        database query on every access — deduplicate before calling this in
        a loop.
        """
        if not self.datasource_id:
            return None
        if self.datasource_type == utils.DatasourceType.TABLE:
            return self.table
        if self.datasource_type == utils.DatasourceType.SEMANTIC_VIEW:
            # Resolved through the type-guarded ``semantic_view`` relationship
            # rather than a DAO query: identity-map cached, and its join
            # predicate already enforces the type constraint. ``None`` when
            # the row is gone, matching the DAO fallback's semantics.
            return self.semantic_view
        # pylint: disable=import-outside-toplevel
        # Deferred to avoid a circular import: superset.daos.datasource
        # imports connectors and sql_lab models at module top.
        from superset.daos.datasource import DatasourceDAO
        from superset.daos.exceptions import (
            DatasourceNotFound,
            DatasourceTypeNotSupportedError,
            DatasourceValueIsIncorrect,
        )

        try:
            resolved = DatasourceDAO.get_datasource(
                self.datasource_type, self.datasource_id
            )
        except (
            DatasourceNotFound,
            DatasourceTypeNotSupportedError,
            DatasourceValueIsIncorrect,
        ):
            return None
        # A model without a ``perm`` cannot be authorized by
        # ``can_access_datasource`` — treat it as inaccessible rather than
        # letting the access check crash on it.
        return resolved if hasattr(resolved, "perm") else None

    def clone(self) -> Slice:
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

    # The helpers below read the resolved datasource through ``getattr`` so an
    # unresolved reference (``None``) or a datasource kind lacking the attribute
    # yields ``None`` for that one chart instead of failing a whole listing.

    @renders("datasource_name")
    def datasource_link(self) -> Markup | None:
        return getattr(self._display_datasource(), "link", None)

    @renders("datasource_url")
    def datasource_url(self) -> str | None:
        return getattr(self._display_datasource(), "explore_url", None)

    def datasource_name_text(self) -> str | None:
        # ``SqlaTable.name`` is ``schema.table_name`` when a schema is set;
        # ``SemanticView.name`` is the view's name.
        return getattr(self._display_datasource(), "name", None)

    @property
    def datasource_edit_url(self) -> str | None:
        return getattr(self._display_datasource(), "url", None)

    @property
    def description_markeddown(self) -> str:
        return utils.markdown(self.description or "")

    @property
    def data(self) -> dict[str, Any]:
        """Data used to render slice in templates"""
        data: dict[str, Any] = {}
        self.token = ""
        try:
            data = self.form_data
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
            "editors": [s.id for s in self.editors],
            "extra_editors": get_extra_editor_subject_ids(self),
            "viewers": [s.id for s in self.viewers],
            "slice_id": self.id,
            "slice_name": self.slice_name,
            "slice_url": self.slice_url,
            "certified_by": self.certified_by,
            "certification_details": self.certification_details,
            "is_managed_externally": self.is_managed_externally,
        }

    @property
    def digest(self) -> str | None:
        return get_chart_digest(self)

    @property
    def thumbnail_url(self) -> str | None:
        """
        Returns a thumbnail URL with a HEX digest. We want to avoid browser cache
        if the dashboard has changed
        """
        if digest := self.digest:
            if not has_request_context():
                # Out-of-request callers (CLI, celery tasks) have no
                # SCRIPT_NAME to honor; keep the router-relative shape so
                # the property stays callable anywhere.
                return f"/api/v1/chart/{self.id}/thumbnail/{digest}/"
            # url_for respects SCRIPT_NAME, so the URL carries the application
            # root prefix under subdirectory deployments.
            return url_for("ChartRestApi.thumbnail", pk=self.id, digest=digest)

        return None

    @property
    def json_data(self) -> str:
        return json.dumps(self.data)

    @property
    def form_data(self) -> dict[str, Any]:
        form_data: dict[str, Any] = {}
        try:
            form_data = json.loads(self.params)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Malformed json in slice's params", exc_info=True)
            logger.exception(ex)
        form_data.update(
            {
                "slice_id": self.id,
                "viz_type": self.viz_type,
                "datasource": f"{self.datasource_id}__{self.datasource_type}",
            }
        )

        if self.cache_timeout:
            form_data["cache_timeout"] = self.cache_timeout
        update_time_range(form_data)
        return form_data

    def get_query_context(self) -> QueryContext | None:
        if self.query_context:
            try:
                return self.get_query_context_factory().create(
                    **{**json.loads(self.query_context), "current_slice": self}
                )
            except json.JSONDecodeError as ex:
                logger.error("Malformed json in slice's query context", exc_info=True)
                logger.exception(ex)
        return None

    def get_explore_url(
        self,
        base_url: str = "/explore",
        overrides: dict[str, Any] | None = None,
    ) -> str:
        return self.build_explore_url(self.id, base_url, overrides)

    @staticmethod
    def build_explore_url(
        id_: int, base_url: str = "/explore", overrides: dict[str, Any] | None = None
    ) -> str:
        overrides = overrides or {}
        form_data = {"slice_id": id_}
        form_data.update(overrides)
        params = parse.quote(json.dumps(form_data))
        return f"{base_url}/?slice_id={id_}&form_data={params}"

    @property
    def slice_url(self) -> str:
        """Defines the url to access the slice"""
        return self.get_explore_url()

    @property
    def edit_url(self) -> str:
        return f"/chart/edit/{self.id}"

    @property
    def chart(self) -> str:
        return self.slice_name or "<empty>"

    @property
    def slice_link(self) -> Markup:
        name = escape(self.chart)
        # FAB list view renders this raw HTML; use url_for so Flask prepends
        # SCRIPT_NAME (the application_root). `Slice.url` itself stays router-
        # relative so frontend callers can apply ensureAppRoot exactly once.
        href = url_for("ExploreView.root", slice_id=self.id)
        return Markup(f'<a href="{href}">{name}</a>')

    @property
    def icons(self) -> str:
        # Escape the data-controlled datasource name and edit URL before they
        # are interpolated into HTML attributes.
        url = escape(self.datasource_edit_url)
        datasource = escape(self.datasource_name_text() or "")
        return f"""
        <a
                href="{url}"
                data-toggle="tooltip"
                title="{datasource}">
            <i class="fa fa-database"></i>
        </a>
        """

    @property
    def url(self) -> str:
        return f"/explore/?slice_id={self.id}"

    def get_query_context_factory(self) -> QueryContextFactory:
        if self.query_context_factory is None:
            # pylint: disable=import-outside-toplevel
            from superset.common.query_context_factory import QueryContextFactory

            self.query_context_factory = QueryContextFactory()
        return self.query_context_factory

    @classmethod
    def get(cls, id_or_uuid: str) -> Slice:
        qry = db.session.query(Slice).filter(id_or_uuid_filter(id_or_uuid))
        return qry.one_or_none()


def id_or_uuid_filter(id_or_uuid: str | int) -> BinaryExpression:
    if isinstance(id_or_uuid, int):
        return Slice.id == id_or_uuid
    if id_or_uuid.isdigit():
        return Slice.id == int(id_or_uuid)
    return Slice.uuid == id_or_uuid


def set_related_perm(_mapper: Mapper, _connection: Connection, target: Slice) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.daos.datasource import DatasourceDAO

    src_class = DatasourceDAO.sources[target.datasource_type]
    if id_ := target.datasource_id:
        ds = db.session.query(src_class).filter_by(id=int(id_)).first()
        if ds:
            target.perm = ds.perm
            target.catalog_perm = ds.catalog_perm
            target.schema_perm = ds.schema_perm


def event_after_chart_changed(
    _mapper: Mapper, _connection: Connection, target: Slice
) -> None:
    cache_chart_thumbnail.delay(
        current_user=get_current_user(), chart_id=target.id, force=True
    )


sqla.event.listen(Slice, "before_insert", set_related_perm)
sqla.event.listen(Slice, "before_update", set_related_perm)

if is_feature_enabled("THUMBNAILS_SQLA_LISTENERS"):
    sqla.event.listen(Slice, "after_insert", event_after_chart_changed)
    sqla.event.listen(Slice, "after_update", event_after_chart_changed)
