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
# pylint: disable=C,R,W
"""A collection of ORM sqlalchemy models for Superset"""
from contextlib import closing
from copy import copy, deepcopy
from datetime import datetime
import json
import logging
import textwrap
from typing import List

from flask import escape, g, Markup, request
from flask_appbuilder import Model
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.security.sqla.models import User
import numpy
import pandas as pd
import sqlalchemy as sqla
from sqlalchemy import (
    Boolean,
    Column,
    create_engine,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)
from sqlalchemy.engine import url
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import relationship, sessionmaker, subqueryload
from sqlalchemy.orm.session import make_transient
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy_utils import EncryptedType
import sqlparse

from superset import app, db, db_engine_specs, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.legacy import update_time_range
from superset.models.helpers import AuditMixinNullable, ImportMixin
from superset.models.tags import ChartUpdater, DashboardUpdater, FavStarUpdater
from superset.models.user_attributes import UserAttribute
from superset.utils import cache as cache_util, core as utils
from superset.viz import viz_types
from urllib import parse  # noqa

config = app.config
custom_password_store = config.get("SQLALCHEMY_CUSTOM_PASSWORD_STORE")
stats_logger = config.get("STATS_LOGGER")
log_query = config.get("QUERY_LOGGER")
metadata = Model.metadata  # pylint: disable=no-member

PASSWORD_MASK = "X" * 10


def set_related_perm(mapper, connection, target):  # noqa
    src_class = target.cls_model
    id_ = target.datasource_id
    if id_:
        ds = db.session.query(src_class).filter_by(id=int(id_)).first()
        if ds:
            target.perm = ds.perm


def copy_dashboard(mapper, connection, target):
    dashboard_id = config.get("DASHBOARD_TEMPLATE_ID")
    if dashboard_id is None:
        return

    Session = sessionmaker(autoflush=False)
    session = Session(bind=connection)
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


class Url(Model, AuditMixinNullable):
    """Used for the short url feature"""

    __tablename__ = "url"
    id = Column(Integer, primary_key=True)
    url = Column(Text)


class KeyValue(Model):

    """Used for any type of key-value store"""

    __tablename__ = "keyvalue"
    id = Column(Integer, primary_key=True)
    value = Column(Text, nullable=False)


class CssTemplate(Model, AuditMixinNullable):

    """CSS templates for dashboards"""

    __tablename__ = "css_templates"
    id = Column(Integer, primary_key=True)
    template_name = Column(String(250))
    css = Column(Text, default="")


slice_user = Table(
    "slice_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Slice(Model, AuditMixinNullable, ImportMixin):

    """A slice is essentially a report or a view on data"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    datasource_id = Column(Integer)
    datasource_type = Column(String(200))
    datasource_name = Column(String(2000))
    viz_type = Column(String(250))
    params = Column(Text)
    description = Column(Text)
    cache_timeout = Column(Integer)
    perm = Column(String(1000))
    owners = relationship(security_manager.user_model, secondary=slice_user)

    export_fields = (
        "slice_name",
        "datasource_type",
        "datasource_name",
        "viz_type",
        "params",
        "cache_timeout",
    )

    def __repr__(self):
        return self.slice_name or str(self.id)

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def datasource(self):
        return self.get_datasource

    def clone(self):
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

    @datasource.getter  # type: ignore
    @utils.memoized
    def get_datasource(self):
        return db.session.query(self.cls_model).filter_by(id=self.datasource_id).first()

    @renders("datasource_name")
    def datasource_link(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.link if datasource else None

    def datasource_name_text(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.name if datasource else None

    @property
    def datasource_edit_url(self):
        # pylint: disable=no-member
        datasource = self.datasource
        return datasource.url if datasource else None

    @property  # type: ignore
    @utils.memoized
    def viz(self):
        d = json.loads(self.params)
        viz_class = viz_types[self.viz_type]
        # pylint: disable=no-member
        return viz_class(datasource=self.datasource, form_data=d)

    @property
    def description_markeddown(self):
        return utils.markdown(self.description)

    @property
    def data(self):
        """Data used to render slice in templates"""
        d = {}
        self.token = ""
        try:
            d = self.viz.data
            self.token = d.get("token")
        except Exception as e:
            logging.exception(e)
            d["error"] = str(e)
        return {
            "datasource": self.datasource_name,
            "description": self.description,
            "description_markeddown": self.description_markeddown,
            "edit_url": self.edit_url,
            "form_data": self.form_data,
            "slice_id": self.id,
            "slice_name": self.slice_name,
            "slice_url": self.slice_url,
            "modified": self.modified(),
            "changed_on_humanized": self.changed_on_humanized,
            "changed_on": self.changed_on.isoformat(),
        }

    @property
    def json_data(self):
        return json.dumps(self.data)

    @property
    def form_data(self):
        form_data = {}
        try:
            form_data = json.loads(self.params)
        except Exception as e:
            logging.error("Malformed json in slice's params")
            logging.exception(e)
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

    def get_explore_url(self, base_url="/superset/explore", overrides=None):
        overrides = overrides or {}
        form_data = {"slice_id": self.id}
        form_data.update(overrides)
        params = parse.quote(json.dumps(form_data))
        return f"{base_url}/?form_data={params}"

    @property
    def slice_url(self):
        """Defines the url to access the slice"""
        return self.get_explore_url()

    @property
    def explore_json_url(self):
        """Defines the url to access the slice"""
        return self.get_explore_url("/superset/explore_json")

    @property
    def edit_url(self):
        return "/chart/edit/{}".format(self.id)

    @property
    def chart(self):
        return self.slice_name or "<empty>"

    @property
    def slice_link(self):
        url = self.slice_url
        name = escape(self.chart)
        return Markup(f'<a href="{url}">{name}</a>')

    def get_viz(self, force=False):
        """Creates :py:class:viz.BaseViz object from the url_params_multidict.

        :return: object of the 'viz_type' type that is taken from the
            url_params_multidict or self.params.
        :rtype: :py:class:viz.BaseViz
        """
        slice_params = json.loads(self.params)
        slice_params["slice_id"] = self.id
        slice_params["json"] = "false"
        slice_params["slice_name"] = self.slice_name
        slice_params["viz_type"] = self.viz_type if self.viz_type else "table"

        return viz_types[slice_params.get("viz_type")](
            self.datasource, form_data=slice_params, force=force
        )

    @property
    def icons(self):
        return f"""
        <a
                href="{self.datasource_edit_url}"
                data-toggle="tooltip"
                title="{self.datasource}">
            <i class="fa fa-database"></i>
        </a>
        """

    @classmethod
    def import_obj(cls, slc_to_import, slc_to_override, import_time=None):
        """Inserts or overrides slc in the database.

        remote_id and import_time fields in params_dict are set to track the
        slice origin and ensure correct overrides for multiple imports.
        Slice.perm is used to find the datasources and connect them.

        :param Slice slc_to_import: Slice object to import
        :param Slice slc_to_override: Slice to replace, id matches remote_id
        :returns: The resulting id for the imported slice
        :rtype: int
        """
        session = db.session
        make_transient(slc_to_import)
        slc_to_import.dashboards = []
        slc_to_import.alter_params(remote_id=slc_to_import.id, import_time=import_time)

        slc_to_import = slc_to_import.copy()
        slc_to_import.reset_ownership()
        params = slc_to_import.params_dict
        slc_to_import.datasource_id = ConnectorRegistry.get_datasource_by_name(
            session,
            slc_to_import.datasource_type,
            params["datasource_name"],
            params["schema"],
            params["database_name"],
        ).id
        if slc_to_override:
            slc_to_override.override(slc_to_import)
            session.flush()
            return slc_to_override.id
        session.add(slc_to_import)
        logging.info("Final slice: {}".format(slc_to_import.to_json()))
        session.flush()
        return slc_to_import.id

    @property
    def url(self):
        return "/superset/explore/?form_data=%7B%22slice_id%22%3A%20{0}%7D".format(
            self.id
        )


sqla.event.listen(Slice, "before_insert", set_related_perm)
sqla.event.listen(Slice, "before_update", set_related_perm)


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


class Dashboard(Model, AuditMixinNullable, ImportMixin):

    """The dashboard object!"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(utils.MediumText())
    description = Column(Text)
    css = Column(Text)
    json_metadata = Column(Text)
    slug = Column(String(255), unique=True)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")
    owners = relationship(security_manager.user_model, secondary=dashboard_user)
    published = Column(Boolean, default=False)

    export_fields = (
        "dashboard_title",
        "position_json",
        "json_metadata",
        "description",
        "css",
        "slug",
    )

    def __repr__(self):
        return self.dashboard_title or str(self.id)

    @property
    def table_names(self):
        # pylint: disable=no-member
        return ", ".join({"{}".format(s.datasource.full_name) for s in self.slices})

    @property
    def url(self):
        if self.json_metadata:
            # add default_filters to the preselect_filters of dashboard
            json_metadata = json.loads(self.json_metadata)
            default_filters = json_metadata.get("default_filters")
            # make sure default_filters is not empty and is valid
            if default_filters and default_filters != "{}":
                try:
                    if json.loads(default_filters):
                        filters = parse.quote(default_filters.encode("utf8"))
                        return "/superset/dashboard/{}/?preselect_filters={}".format(
                            self.slug or self.id, filters
                        )
                except Exception:
                    pass
        return "/superset/dashboard/{}/".format(self.slug or self.id)

    @property
    def datasources(self):
        return {slc.datasource for slc in self.slices}

    @property
    def charts(self):
        return [slc.chart for slc in self.slices]

    @property
    def sqla_metadata(self):
        # pylint: disable=no-member
        metadata = MetaData(bind=self.get_sqla_engine())
        return metadata.reflect()

    def dashboard_link(self):
        title = escape(self.dashboard_title or "<empty>")
        return Markup(f'<a href="{self.url}">{title}</a>')

    @property
    def data(self):
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
        }

    @property
    def params(self):
        return self.json_metadata

    @params.setter
    def params(self, value):
        self.json_metadata = value

    @property
    def position(self):
        if self.position_json:
            return json.loads(self.position_json)
        return {}

    @classmethod
    def import_obj(cls, dashboard_to_import, import_time=None):
        """Imports the dashboard from the object to the database.

         Once dashboard is imported, json_metadata field is extended and stores
         remote_id and import_time. It helps to decide if the dashboard has to
         be overridden or just copies over. Slices that belong to this
         dashboard will be wired to existing tables. This function can be used
         to import/export dashboards between multiple superset instances.
         Audit metadata isn't copied over.
        """

        def alter_positions(dashboard, old_to_new_slc_id_dict):
            """ Updates slice_ids in the position json.

            Sample position_json data:
            {
                "DASHBOARD_VERSION_KEY": "v2",
                "DASHBOARD_ROOT_ID": {
                    "type": "DASHBOARD_ROOT_TYPE",
                    "id": "DASHBOARD_ROOT_ID",
                    "children": ["DASHBOARD_GRID_ID"]
                },
                "DASHBOARD_GRID_ID": {
                    "type": "DASHBOARD_GRID_TYPE",
                    "id": "DASHBOARD_GRID_ID",
                    "children": ["DASHBOARD_CHART_TYPE-2"]
                },
                "DASHBOARD_CHART_TYPE-2": {
                    "type": "DASHBOARD_CHART_TYPE",
                    "id": "DASHBOARD_CHART_TYPE-2",
                    "children": [],
                    "meta": {
                        "width": 4,
                        "height": 50,
                        "chartId": 118
                    }
                },
            }
            """
            position_data = json.loads(dashboard.position_json)
            position_json = position_data.values()
            for value in position_json:
                if (
                    isinstance(value, dict)
                    and value.get("meta")
                    and value.get("meta").get("chartId")
                ):
                    old_slice_id = value.get("meta").get("chartId")

                    if old_slice_id in old_to_new_slc_id_dict:
                        value["meta"]["chartId"] = old_to_new_slc_id_dict[old_slice_id]
            dashboard.position_json = json.dumps(position_data)

        logging.info(
            "Started import of the dashboard: {}".format(dashboard_to_import.to_json())
        )
        session = db.session
        logging.info("Dashboard has {} slices".format(len(dashboard_to_import.slices)))
        # copy slices object as Slice.import_slice will mutate the slice
        # and will remove the existing dashboard - slice association
        slices = copy(dashboard_to_import.slices)
        old_to_new_slc_id_dict = {}
        new_filter_immune_slices = []
        new_timed_refresh_immune_slices = []
        new_expanded_slices = {}
        i_params_dict = dashboard_to_import.params_dict
        remote_id_slice_map = {
            slc.params_dict["remote_id"]: slc
            for slc in session.query(Slice).all()
            if "remote_id" in slc.params_dict
        }
        for slc in slices:
            logging.info(
                "Importing slice {} from the dashboard: {}".format(
                    slc.to_json(), dashboard_to_import.dashboard_title
                )
            )
            remote_slc = remote_id_slice_map.get(slc.id)
            new_slc_id = Slice.import_obj(slc, remote_slc, import_time=import_time)
            old_to_new_slc_id_dict[slc.id] = new_slc_id
            # update json metadata that deals with slice ids
            new_slc_id_str = "{}".format(new_slc_id)
            old_slc_id_str = "{}".format(slc.id)
            if (
                "filter_immune_slices" in i_params_dict
                and old_slc_id_str in i_params_dict["filter_immune_slices"]
            ):
                new_filter_immune_slices.append(new_slc_id_str)
            if (
                "timed_refresh_immune_slices" in i_params_dict
                and old_slc_id_str in i_params_dict["timed_refresh_immune_slices"]
            ):
                new_timed_refresh_immune_slices.append(new_slc_id_str)
            if (
                "expanded_slices" in i_params_dict
                and old_slc_id_str in i_params_dict["expanded_slices"]
            ):
                new_expanded_slices[new_slc_id_str] = i_params_dict["expanded_slices"][
                    old_slc_id_str
                ]

        # override the dashboard
        existing_dashboard = None
        for dash in session.query(Dashboard).all():
            if (
                "remote_id" in dash.params_dict
                and dash.params_dict["remote_id"] == dashboard_to_import.id
            ):
                existing_dashboard = dash

        dashboard_to_import = dashboard_to_import.copy()
        dashboard_to_import.id = None
        dashboard_to_import.reset_ownership()
        # position_json can be empty for dashboards
        # with charts added from chart-edit page and without re-arranging
        if dashboard_to_import.position_json:
            alter_positions(dashboard_to_import, old_to_new_slc_id_dict)
        dashboard_to_import.alter_params(import_time=import_time)
        if new_expanded_slices:
            dashboard_to_import.alter_params(expanded_slices=new_expanded_slices)
        if new_filter_immune_slices:
            dashboard_to_import.alter_params(
                filter_immune_slices=new_filter_immune_slices
            )
        if new_timed_refresh_immune_slices:
            dashboard_to_import.alter_params(
                timed_refresh_immune_slices=new_timed_refresh_immune_slices
            )

        new_slices = (
            session.query(Slice)
            .filter(Slice.id.in_(old_to_new_slc_id_dict.values()))
            .all()
        )

        if existing_dashboard:
            existing_dashboard.override(dashboard_to_import)
            existing_dashboard.slices = new_slices
            session.flush()
            return existing_dashboard.id
        else:
            dashboard_to_import.slices = new_slices
            session.add(dashboard_to_import)
            session.flush()
            return dashboard_to_import.id

    @classmethod
    def export_dashboards(cls, dashboard_ids):
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


class Database(Model, AuditMixinNullable, ImportMixin):

    """An ORM object that stores Database related information"""

    __tablename__ = "dbs"
    type = "table"
    __table_args__ = (UniqueConstraint("database_name"),)

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    database_name = Column(String(250), unique=True)
    sqlalchemy_uri = Column(String(1024))
    password = Column(EncryptedType(String(1024), config.get("SECRET_KEY")))
    cache_timeout = Column(Integer)
    select_as_create_table_as = Column(Boolean, default=False)
    expose_in_sqllab = Column(Boolean, default=True)
    allow_run_async = Column(Boolean, default=False)
    allow_csv_upload = Column(Boolean, default=False)
    allow_ctas = Column(Boolean, default=False)
    allow_dml = Column(Boolean, default=False)
    force_ctas_schema = Column(String(250))
    allow_multi_schema_metadata_fetch = Column(Boolean, default=False)
    extra = Column(
        Text,
        default=textwrap.dedent(
            """\
    {
        "metadata_params": {},
        "engine_params": {},
        "metadata_cache_timeout": {},
        "schemas_allowed_for_csv_upload": []
    }
    """
        ),
    )
    perm = Column(String(1000))
    impersonate_user = Column(Boolean, default=False)
    export_fields = (
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_ctas",
        "allow_csv_upload",
        "extra",
    )
    export_children = ["tables"]

    def __repr__(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def name(self):
        return self.verbose_name if self.verbose_name else self.database_name

    @property
    def allows_subquery(self):
        return self.db_engine_spec.allows_subquery

    @property
    def data(self):
        return {
            "id": self.id,
            "name": self.database_name,
            "backend": self.backend,
            "allow_multi_schema_metadata_fetch": self.allow_multi_schema_metadata_fetch,
            "allows_subquery": self.allows_subquery,
        }

    @property
    def unique_name(self):
        return self.database_name

    @property
    def url_object(self):
        return make_url(self.sqlalchemy_uri_decrypted)

    @property
    def backend(self):
        url = make_url(self.sqlalchemy_uri_decrypted)
        return url.get_backend_name()

    @property
    def metadata_cache_timeout(self):
        return self.get_extra().get("metadata_cache_timeout", {})

    @property
    def schema_cache_enabled(self):
        return "schema_cache_timeout" in self.metadata_cache_timeout

    @property
    def schema_cache_timeout(self):
        return self.metadata_cache_timeout.get("schema_cache_timeout")

    @property
    def table_cache_enabled(self):
        return "table_cache_timeout" in self.metadata_cache_timeout

    @property
    def table_cache_timeout(self):
        return self.metadata_cache_timeout.get("table_cache_timeout")

    @property
    def default_schemas(self):
        return self.get_extra().get("default_schemas", [])

    @classmethod
    def get_password_masked_url_from_uri(cls, uri):
        url = make_url(uri)
        return cls.get_password_masked_url(url)

    @classmethod
    def get_password_masked_url(cls, url):
        url_copy = deepcopy(url)
        if url_copy.password is not None and url_copy.password != PASSWORD_MASK:
            url_copy.password = PASSWORD_MASK
        return url_copy

    def set_sqlalchemy_uri(self, uri):
        conn = sqla.engine.url.make_url(uri.strip())
        if conn.password != PASSWORD_MASK and not custom_password_store:
            # do not over-write the password with the password mask
            self.password = conn.password
        conn.password = PASSWORD_MASK if conn.password else None
        self.sqlalchemy_uri = str(conn)  # hides the password

    def get_effective_user(self, url, user_name=None):
        """
        Get the effective user, especially during impersonation.
        :param url: SQL Alchemy URL object
        :param user_name: Default username
        :return: The effective username
        """
        effective_username = None
        if self.impersonate_user:
            effective_username = url.username
            if user_name:
                effective_username = user_name
            elif (
                hasattr(g, "user")
                and hasattr(g.user, "username")
                and g.user.username is not None
            ):
                effective_username = g.user.username
        return effective_username

    @utils.memoized(watch=("impersonate_user", "sqlalchemy_uri_decrypted", "extra"))
    def get_sqla_engine(self, schema=None, nullpool=True, user_name=None, source=None):
        extra = self.get_extra()
        url = make_url(self.sqlalchemy_uri_decrypted)
        url = self.db_engine_spec.adjust_database_uri(url, schema)
        effective_username = self.get_effective_user(url, user_name)
        # If using MySQL or Presto for example, will set url.username
        # If using Hive, will not do anything yet since that relies on a
        # configuration parameter instead.
        self.db_engine_spec.modify_url_for_impersonation(
            url, self.impersonate_user, effective_username
        )

        masked_url = self.get_password_masked_url(url)
        logging.info("Database.get_sqla_engine(). Masked URL: {0}".format(masked_url))

        params = extra.get("engine_params", {})
        if nullpool:
            params["poolclass"] = NullPool

        # If using Hive, this will set hive.server2.proxy.user=$effective_username
        configuration = {}
        configuration.update(
            self.db_engine_spec.get_configuration_for_impersonation(
                str(url), self.impersonate_user, effective_username
            )
        )
        if configuration:
            d = params.get("connect_args", {})
            d["configuration"] = configuration
            params["connect_args"] = d

        DB_CONNECTION_MUTATOR = config.get("DB_CONNECTION_MUTATOR")
        if DB_CONNECTION_MUTATOR:
            url, params = DB_CONNECTION_MUTATOR(
                url, params, effective_username, security_manager, source
            )
        return create_engine(url, **params)

    def get_reserved_words(self):
        return self.get_dialect().preparer.reserved_words

    def get_quoter(self):
        return self.get_dialect().identifier_preparer.quote

    def get_df(self, sql, schema, mutator=None):
        sqls = [str(s).strip().strip(";") for s in sqlparse.parse(sql)]
        source_key = None
        if request and request.referrer:
            if "/superset/dashboard/" in request.referrer:
                source_key = "dashboard"
            elif "/superset/explore/" in request.referrer:
                source_key = "chart"
        engine = self.get_sqla_engine(
            schema=schema, source=utils.sources.get(source_key, None)
        )
        username = utils.get_username()

        def needs_conversion(df_series):
            if df_series.empty:
                return False
            if isinstance(df_series[0], (list, dict)):
                return True
            return False

        def _log_query(sql):
            if log_query:
                log_query(engine.url, sql, schema, username, __name__, security_manager)

        with closing(engine.raw_connection()) as conn:
            with closing(conn.cursor()) as cursor:
                for sql in sqls[:-1]:
                    _log_query(sql)
                    self.db_engine_spec.execute(cursor, sql)
                    cursor.fetchall()

                _log_query(sqls[-1])
                self.db_engine_spec.execute(cursor, sqls[-1])

                if cursor.description is not None:
                    columns = [col_desc[0] for col_desc in cursor.description]
                else:
                    columns = []

                df = pd.DataFrame.from_records(
                    data=list(cursor.fetchall()), columns=columns, coerce_float=True
                )

                if mutator:
                    df = mutator(df)

                for k, v in df.dtypes.items():
                    if v.type == numpy.object_ and needs_conversion(df[k]):
                        df[k] = df[k].apply(utils.json_dumps_w_dates)
                return df

    def compile_sqla_query(self, qry, schema=None):
        engine = self.get_sqla_engine(schema=schema)

        sql = str(qry.compile(engine, compile_kwargs={"literal_binds": True}))

        if engine.dialect.identifier_preparer._double_percents:
            sql = sql.replace("%%", "%")

        return sql

    def select_star(
        self,
        table_name,
        schema=None,
        limit=100,
        show_cols=False,
        indent=True,
        latest_partition=False,
        cols=None,
    ):
        """Generates a ``select *`` statement in the proper dialect"""
        eng = self.get_sqla_engine(
            schema=schema, source=utils.sources.get("sql_lab", None)
        )
        return self.db_engine_spec.select_star(
            self,
            table_name,
            schema=schema,
            engine=eng,
            limit=limit,
            show_cols=show_cols,
            indent=indent,
            latest_partition=latest_partition,
            cols=cols,
        )

    def apply_limit_to_sql(self, sql, limit=1000):
        return self.db_engine_spec.apply_limit_to_sql(sql, limit, self)

    def safe_sqlalchemy_uri(self):
        return self.sqlalchemy_uri

    @property
    def inspector(self):
        engine = self.get_sqla_engine()
        return sqla.inspect(engine)

    @cache_util.memoized_func(
        key=lambda *args, **kwargs: "db:{}:schema:None:table_list",
        attribute_in_key="id",
    )
    def get_all_table_names_in_database(
        self, cache: bool = False, cache_timeout: bool = None, force=False
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments."""
        if not self.allow_multi_schema_metadata_fetch:
            return []
        return self.db_engine_spec.get_all_datasource_names(self, "table")

    @cache_util.memoized_func(
        key=lambda *args, **kwargs: "db:{}:schema:None:view_list", attribute_in_key="id"
    )
    def get_all_view_names_in_database(
        self, cache: bool = False, cache_timeout: bool = None, force: bool = False
    ) -> List[utils.DatasourceName]:
        """Parameters need to be passed as keyword arguments."""
        if not self.allow_multi_schema_metadata_fetch:
            return []
        return self.db_engine_spec.get_all_datasource_names(self, "view")

    @cache_util.memoized_func(
        key=lambda *args, **kwargs: "db:{{}}:schema:{}:table_list".format(
            kwargs.get("schema")
        ),
        attribute_in_key="id",
    )
    def get_all_table_names_in_schema(
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: int = None,
        force: bool = False,
    ):
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: list of tables
        """
        try:
            tables = self.db_engine_spec.get_table_names(
                inspector=self.inspector, schema=schema
            )
            return [
                utils.DatasourceName(table=table, schema=schema) for table in tables
            ]
        except Exception as e:
            logging.exception(e)

    @cache_util.memoized_func(
        key=lambda *args, **kwargs: "db:{{}}:schema:{}:view_list".format(
            kwargs.get("schema")
        ),
        attribute_in_key="id",
    )
    def get_all_view_names_in_schema(
        self,
        schema: str,
        cache: bool = False,
        cache_timeout: int = None,
        force: bool = False,
    ):
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param schema: schema name
        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: list of views
        """
        try:
            views = self.db_engine_spec.get_view_names(
                inspector=self.inspector, schema=schema
            )
            return [utils.DatasourceName(table=view, schema=schema) for view in views]
        except Exception as e:
            logging.exception(e)

    @cache_util.memoized_func(
        key=lambda *args, **kwargs: "db:{}:schema_list", attribute_in_key="id"
    )
    def get_all_schema_names(
        self, cache: bool = False, cache_timeout: int = None, force: bool = False
    ) -> List[str]:
        """Parameters need to be passed as keyword arguments.

        For unused parameters, they are referenced in
        cache_util.memoized_func decorator.

        :param cache: whether cache is enabled for the function
        :param cache_timeout: timeout in seconds for the cache
        :param force: whether to force refresh the cache
        :return: schema list
        """
        return self.db_engine_spec.get_schema_names(self.inspector)

    @property
    def db_engine_spec(self):
        return db_engine_specs.engines.get(self.backend, db_engine_specs.BaseEngineSpec)

    @classmethod
    def get_db_engine_spec_for_backend(cls, backend):
        return db_engine_specs.engines.get(backend, db_engine_specs.BaseEngineSpec)

    def grains(self):
        """Defines time granularity database-specific expressions.

        The idea here is to make it easy for users to change the time grain
        from a datetime (maybe the source grain is arbitrary timestamps, daily
        or 5 minutes increments) to another, "truncated" datetime. Since
        each database has slightly different but similar datetime functions,
        this allows a mapping between database engines and actual functions.
        """
        return self.db_engine_spec.get_time_grains()

    def get_extra(self):
        extra = {}
        if self.extra:
            try:
                extra = json.loads(self.extra)
            except Exception as e:
                logging.error(e)
                raise e
        return extra

    def get_table(self, table_name, schema=None):
        extra = self.get_extra()
        meta = MetaData(**extra.get("metadata_params", {}))
        return Table(
            table_name,
            meta,
            schema=schema or None,
            autoload=True,
            autoload_with=self.get_sqla_engine(),
        )

    def get_columns(self, table_name, schema=None):
        return self.db_engine_spec.get_columns(self.inspector, table_name, schema)

    def get_indexes(self, table_name, schema=None):
        return self.inspector.get_indexes(table_name, schema)

    def get_pk_constraint(self, table_name, schema=None):
        return self.inspector.get_pk_constraint(table_name, schema)

    def get_foreign_keys(self, table_name, schema=None):
        return self.inspector.get_foreign_keys(table_name, schema)

    def get_schema_access_for_csv_upload(self):
        return self.get_extra().get("schemas_allowed_for_csv_upload", [])

    @property
    def sqlalchemy_uri_decrypted(self):
        conn = sqla.engine.url.make_url(self.sqlalchemy_uri)
        if custom_password_store:
            conn.password = custom_password_store(conn)
        else:
            conn.password = self.password
        return str(conn)

    @property
    def sql_url(self):
        return "/superset/sql/{}/".format(self.id)

    def get_perm(self):
        return ("[{obj.database_name}].(id:{obj.id})").format(obj=self)

    def has_table(self, table):
        engine = self.get_sqla_engine()
        return engine.has_table(table.table_name, table.schema or None)

    def has_table_by_name(self, table_name, schema=None):
        engine = self.get_sqla_engine()
        return engine.has_table(table_name, schema)

    @utils.memoized
    def get_dialect(self):
        sqla_url = url.make_url(self.sqlalchemy_uri_decrypted)
        return sqla_url.get_dialect()()


sqla.event.listen(Database, "after_insert", security_manager.set_perm)
sqla.event.listen(Database, "after_update", security_manager.set_perm)


class Log(Model):

    """ORM object used to log Superset actions to the database"""

    __tablename__ = "logs"

    id = Column(Integer, primary_key=True)
    action = Column(String(512))
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    dashboard_id = Column(Integer)
    slice_id = Column(Integer)
    json = Column(Text)
    user = relationship(
        security_manager.user_model, backref="logs", foreign_keys=[user_id]
    )
    dttm = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer)
    referrer = Column(String(1024))


class FavStar(Model):
    __tablename__ = "favstar"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    class_name = Column(String(50))
    obj_id = Column(Integer)
    dttm = Column(DateTime, default=datetime.utcnow)


class DatasourceAccessRequest(Model, AuditMixinNullable):
    """ORM model for the access requests for datasources and dbs."""

    __tablename__ = "access_request"
    id = Column(Integer, primary_key=True)

    datasource_id = Column(Integer)
    datasource_type = Column(String(200))

    ROLES_BLACKLIST = set(config.get("ROBOT_PERMISSION_ROLES", []))

    @property
    def cls_model(self):
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def username(self):
        return self.creator()

    @property
    def datasource(self):
        return self.get_datasource

    @datasource.getter  # type: ignore
    @utils.memoized
    def get_datasource(self):
        # pylint: disable=no-member
        ds = db.session.query(self.cls_model).filter_by(id=self.datasource_id).first()
        return ds

    @property
    def datasource_link(self):
        return self.datasource.link  # pylint: disable=no-member

    @property
    def roles_with_datasource(self):
        action_list = ""
        perm = self.datasource.perm  # pylint: disable=no-member
        pv = security_manager.find_permission_view_menu("datasource_access", perm)
        for r in pv.role:
            if r.name in self.ROLES_BLACKLIST:
                continue
            # pylint: disable=no-member
            url = (
                f"/superset/approve?datasource_type={self.datasource_type}&"
                f"datasource_id={self.datasource_id}&"
                f"created_by={self.created_by.username}&role_to_grant={r.name}"
            )
            href = '<a href="{}">Grant {} Role</a>'.format(url, r.name)
            action_list = action_list + "<li>" + href + "</li>"
        return "<ul>" + action_list + "</ul>"

    @property
    def user_roles(self):
        action_list = ""
        for r in self.created_by.roles:  # pylint: disable=no-member
            # pylint: disable=no-member
            url = (
                f"/superset/approve?datasource_type={self.datasource_type}&"
                f"datasource_id={self.datasource_id}&"
                f"created_by={self.created_by.username}&role_to_extend={r.name}"
            )
            href = '<a href="{}">Extend {} Role</a>'.format(url, r.name)
            if r.name in self.ROLES_BLACKLIST:
                href = "{} Role".format(r.name)
            action_list = action_list + "<li>" + href + "</li>"
        return "<ul>" + action_list + "</ul>"


# events for updating tags
sqla.event.listen(Slice, "after_insert", ChartUpdater.after_insert)
sqla.event.listen(Slice, "after_update", ChartUpdater.after_update)
sqla.event.listen(Slice, "after_delete", ChartUpdater.after_delete)
sqla.event.listen(Dashboard, "after_insert", DashboardUpdater.after_insert)
sqla.event.listen(Dashboard, "after_update", DashboardUpdater.after_update)
sqla.event.listen(Dashboard, "after_delete", DashboardUpdater.after_delete)
sqla.event.listen(FavStar, "after_insert", FavStarUpdater.after_insert)
sqla.event.listen(FavStar, "after_delete", FavStarUpdater.after_delete)
