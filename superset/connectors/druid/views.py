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
# pylint: disable=too-many-ancestors
import json
import logging
from datetime import datetime

from flask import flash, Markup, redirect
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.fieldwidgets import Select2Widget
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from wtforms import StringField
from wtforms.ext.sqlalchemy.fields import QuerySelectField

from superset import db, security_manager
from superset.connectors.base.views import BS3TextFieldROWidget, DatasourceModelView
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.druid import models
from superset.constants import RouteMethod
from superset.typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import (
    BaseSupersetView,
    DatasourceFilter,
    DeleteMixin,
    get_dataset_exist_error_msg,
    ListWidgetWithCheckboxes,
    SupersetModelView,
    validate_json,
    YamlExportMixin,
)

logger = logging.getLogger(__name__)


class DruidColumnInlineView(CompactCRUDMixin, SupersetModelView):
    datamodel = SQLAInterface(models.DruidColumn)
    include_route_methods = RouteMethod.RELATED_VIEW_SET

    list_title = _("Columns")
    show_title = _("Show Druid Column")
    add_title = _("Add Druid Column")
    edit_title = _("Edit Druid Column")

    list_widget = ListWidgetWithCheckboxes

    edit_columns = [
        "column_name",
        "verbose_name",
        "description",
        "dimension_spec_json",
        "datasource",
        "groupby",
        "filterable",
    ]
    add_columns = edit_columns
    list_columns = ["column_name", "verbose_name", "type", "groupby", "filterable"]
    can_delete = False
    page_size = 500
    label_columns = {
        "column_name": _("Column"),
        "type": _("Type"),
        "datasource": _("Datasource"),
        "groupby": _("Groupable"),
        "filterable": _("Filterable"),
    }
    description_columns = {
        "filterable": _(
            "Whether this column is exposed in the `Filters` section "
            "of the explore view."
        ),
        "dimension_spec_json": utils.markdown(
            "this field can be used to specify  "
            "a `dimensionSpec` as documented [here]"
            "(http://druid.io/docs/latest/querying/dimensionspecs.html). "
            "Make sure to input valid JSON and that the "
            "`outputName` matches the `column_name` defined "
            "above.",
            True,
        ),
    }

    add_form_extra_fields = {
        "datasource": QuerySelectField(
            "Datasource",
            query_factory=lambda: db.session.query(models.DruidDatasource),
            allow_blank=True,
            widget=Select2Widget(extra_classes="readonly"),
        )
    }

    edit_form_extra_fields = add_form_extra_fields

    def pre_update(self, item: "DruidColumnInlineView") -> None:
        # If a dimension spec JSON is given, ensure that it is
        # valid JSON and that `outputName` is specified
        if item.dimension_spec_json:
            try:
                dimension_spec = json.loads(item.dimension_spec_json)
            except ValueError as ex:
                raise ValueError("Invalid Dimension Spec JSON: " + str(ex))
            if not isinstance(dimension_spec, dict):
                raise ValueError("Dimension Spec must be a JSON object")
            if "outputName" not in dimension_spec:
                raise ValueError("Dimension Spec does not contain `outputName`")
            if "dimension" not in dimension_spec:
                raise ValueError("Dimension Spec is missing `dimension`")
            # `outputName` should be the same as the `column_name`
            if dimension_spec["outputName"] != item.column_name:
                raise ValueError(
                    "`outputName` [{}] unequal to `column_name` [{}]".format(
                        dimension_spec["outputName"], item.column_name
                    )
                )

    def post_update(self, item: "DruidColumnInlineView") -> None:
        item.refresh_metrics()

    def post_add(self, item: "DruidColumnInlineView") -> None:
        self.post_update(item)


class DruidMetricInlineView(CompactCRUDMixin, SupersetModelView):
    datamodel = SQLAInterface(models.DruidMetric)
    include_route_methods = RouteMethod.RELATED_VIEW_SET

    list_title = _("Metrics")
    show_title = _("Show Druid Metric")
    add_title = _("Add Druid Metric")
    edit_title = _("Edit Druid Metric")

    list_columns = ["metric_name", "verbose_name", "metric_type"]
    edit_columns = [
        "metric_name",
        "description",
        "verbose_name",
        "metric_type",
        "json",
        "datasource",
        "d3format",
        "warning_text",
    ]
    add_columns = edit_columns
    page_size = 500
    validators_columns = {"json": [validate_json]}
    description_columns = {
        "metric_type": utils.markdown(
            "use `postagg` as the metric type if you are defining a "
            "[Druid Post Aggregation]"
            "(http://druid.io/docs/latest/querying/post-aggregations.html)",
            True,
        )
    }
    label_columns = {
        "metric_name": _("Metric"),
        "description": _("Description"),
        "verbose_name": _("Verbose Name"),
        "metric_type": _("Type"),
        "json": _("JSON"),
        "datasource": _("Druid Datasource"),
        "warning_text": _("Warning Message"),
    }

    add_form_extra_fields = {
        "datasource": QuerySelectField(
            "Datasource",
            query_factory=lambda: db.session.query(models.DruidDatasource),
            allow_blank=True,
            widget=Select2Widget(extra_classes="readonly"),
        )
    }

    edit_form_extra_fields = add_form_extra_fields


class DruidClusterModelView(SupersetModelView, DeleteMixin, YamlExportMixin):
    datamodel = SQLAInterface(models.DruidCluster)
    include_route_methods = RouteMethod.CRUD_SET
    list_title = _("Druid Clusters")
    show_title = _("Show Druid Cluster")
    add_title = _("Add Druid Cluster")
    edit_title = _("Edit Druid Cluster")

    add_columns = [
        "verbose_name",
        "broker_host",
        "broker_port",
        "broker_user",
        "broker_pass",
        "broker_endpoint",
        "cache_timeout",
        "cluster_name",
    ]
    edit_columns = add_columns
    list_columns = ["cluster_name", "metadata_last_refreshed"]
    search_columns = ("cluster_name",)
    label_columns = {
        "cluster_name": _("Cluster Name"),
        "broker_host": _("Broker Host"),
        "broker_port": _("Broker Port"),
        "broker_user": _("Broker Username"),
        "broker_pass": _("Broker Password"),
        "broker_endpoint": _("Broker Endpoint"),
        "verbose_name": _("Verbose Name"),
        "cache_timeout": _("Cache Timeout"),
        "metadata_last_refreshed": _("Metadata Last Refreshed"),
    }
    description_columns = {
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this cluster. "
            "A timeout of 0 indicates that the cache never expires. "
            "Note this defaults to the global timeout if undefined."
        ),
        "broker_user": _(
            "Druid supports basic authentication. See "
            "[auth](http://druid.io/docs/latest/design/auth.html) and "
            "druid-basic-security extension"
        ),
        "broker_pass": _(
            "Druid supports basic authentication. See "
            "[auth](http://druid.io/docs/latest/design/auth.html) and "
            "druid-basic-security extension"
        ),
    }

    yaml_dict_key = "databases"

    def pre_add(self, item: "DruidClusterModelView") -> None:
        security_manager.add_permission_view_menu("database_access", item.perm)

    def pre_update(self, item: "DruidClusterModelView") -> None:
        self.pre_add(item)

    def _delete(self, pk: int) -> None:
        DeleteMixin._delete(self, pk)


class DruidDatasourceModelView(DatasourceModelView, DeleteMixin, YamlExportMixin):
    datamodel = SQLAInterface(models.DruidDatasource)
    include_route_methods = RouteMethod.CRUD_SET
    list_title = _("Druid Datasources")
    show_title = _("Show Druid Datasource")
    add_title = _("Add Druid Datasource")
    edit_title = _("Edit Druid Datasource")

    list_columns = ["datasource_link", "cluster", "changed_by_", "modified"]
    order_columns = ["datasource_link", "modified"]
    related_views = [DruidColumnInlineView, DruidMetricInlineView]
    edit_columns = [
        "datasource_name",
        "cluster",
        "description",
        "owners",
        "is_hidden",
        "filter_select_enabled",
        "fetch_values_from",
        "default_endpoint",
        "offset",
        "cache_timeout",
    ]
    search_columns = ("datasource_name", "cluster", "description", "owners")
    add_columns = edit_columns
    show_columns = add_columns + ["perm", "slices"]
    page_size = 500
    base_order = ("datasource_name", "asc")
    description_columns = {
        "slices": _(
            "The list of charts associated with this table. By "
            "altering this datasource, you may change how these associated "
            "charts behave. "
            "Also note that charts need to point to a datasource, so "
            "this form will fail at saving if removing charts from a "
            "datasource. If you want to change the datasource for a chart, "
            "overwrite the chart from the 'explore view'"
        ),
        "offset": _("Timezone offset (in hours) for this datasource"),
        "description": Markup(
            'Supports <a href="'
            'https://daringfireball.net/projects/markdown/">markdown</a>'
        ),
        "fetch_values_from": _(
            "Time expression to use as a predicate when retrieving "
            "distinct values to populate the filter component. "
            "Only applies when `Enable Filter Select` is on. If "
            "you enter `7 days ago`, the distinct list of values in "
            "the filter will be populated based on the distinct value over "
            "the past week"
        ),
        "filter_select_enabled": _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            "from the backend on the fly"
        ),
        "default_endpoint": _(
            "Redirects to this endpoint when clicking on the datasource "
            "from the datasource list"
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this datasource. "
            "A timeout of 0 indicates that the cache never expires. "
            "Note this defaults to the cluster timeout if undefined."
        ),
    }
    base_filters = [["id", DatasourceFilter, lambda: []]]
    label_columns = {
        "slices": _("Associated Charts"),
        "datasource_link": _("Data Source"),
        "cluster": _("Cluster"),
        "description": _("Description"),
        "owners": _("Owners"),
        "is_hidden": _("Is Hidden"),
        "filter_select_enabled": _("Enable Filter Select"),
        "default_endpoint": _("Default Endpoint"),
        "offset": _("Time Offset"),
        "cache_timeout": _("Cache Timeout"),
        "datasource_name": _("Datasource Name"),
        "fetch_values_from": _("Fetch Values From"),
        "changed_by_": _("Changed By"),
        "modified": _("Modified"),
    }
    edit_form_extra_fields = {
        "cluster": QuerySelectField(
            "Cluster",
            query_factory=lambda: db.session.query(models.DruidCluster),
            widget=Select2Widget(extra_classes="readonly"),
        ),
        "datasource_name": StringField(
            "Datasource Name", widget=BS3TextFieldROWidget()
        ),
    }

    def pre_add(self, item: "DruidDatasourceModelView") -> None:
        with db.session.no_autoflush:
            query = db.session.query(models.DruidDatasource).filter(
                models.DruidDatasource.datasource_name == item.datasource_name,
                models.DruidDatasource.cluster_id == item.cluster_id,
            )
            if db.session.query(query.exists()).scalar():
                raise Exception(get_dataset_exist_error_msg(item.full_name))

    def post_add(self, item: "DruidDatasourceModelView") -> None:
        item.refresh_metrics()
        security_manager.add_permission_view_menu("datasource_access", item.get_perm())
        if item.schema:
            security_manager.add_permission_view_menu("schema_access", item.schema_perm)

    def post_update(self, item: "DruidDatasourceModelView") -> None:
        self.post_add(item)

    def _delete(self, pk: int) -> None:
        DeleteMixin._delete(self, pk)


class Druid(BaseSupersetView):
    """The base views for Superset!"""

    @has_access
    @expose("/refresh_datasources/")
    def refresh_datasources(  # pylint: disable=no-self-use
        self, refresh_all: bool = True
    ) -> FlaskResponse:
        """endpoint that refreshes druid datasources metadata"""
        session = db.session()
        DruidCluster = ConnectorRegistry.sources[  # pylint: disable=invalid-name
            "druid"
        ].cluster_class
        for cluster in session.query(DruidCluster).all():
            cluster_name = cluster.cluster_name
            valid_cluster = True
            try:
                cluster.refresh_datasources(refresh_all=refresh_all)
            except Exception as ex:  # pylint: disable=broad-except
                valid_cluster = False
                flash(
                    "Error while processing cluster '{}'\n{}".format(
                        cluster_name, utils.error_msg_from_exception(ex)
                    ),
                    "danger",
                )
                logger.exception(ex)
            if valid_cluster:
                cluster.metadata_last_refreshed = datetime.now()
                flash(
                    _("Refreshed metadata from cluster [{}]").format(
                        cluster.cluster_name
                    ),
                    "info",
                )
        session.commit()
        return redirect("/druiddatasourcemodelview/list/")

    @has_access
    @expose("/scan_new_datasources/")
    def scan_new_datasources(self) -> FlaskResponse:
        """
        Calling this endpoint will cause a scan for new
        datasources only and add them.
        """
        return self.refresh_datasources(refresh_all=False)
