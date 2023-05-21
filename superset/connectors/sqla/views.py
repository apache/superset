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
"""Views used by the SqlAlchemy connector"""
import logging
import re

from flask import flash, Markup, redirect
from flask_appbuilder import CompactCRUDMixin, expose, permission_name
from flask_appbuilder.fields import QuerySelectField
from flask_appbuilder.fieldwidgets import Select2Widget
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from wtforms.validators import DataRequired, Regexp

from superset import db
from superset.connectors.base.views import DatasourceModelView
from superset.connectors.sqla import models
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils
from superset.views.base import (
    BaseSupersetView,
    DatasourceFilter,
    DeleteMixin,
    ListWidgetWithCheckboxes,
    SupersetModelView,
    YamlExportMixin,
)

logger = logging.getLogger(__name__)


class SelectDataRequired(DataRequired):  # pylint: disable=too-few-public-methods
    """
    Select required flag on the input field will not work well on Chrome
    Console error:
        An invalid form control with name='tables' is not focusable.

    This makes a simple override to the DataRequired to be used specifically with
    select fields
    """

    field_flags = ()


class TableColumnInlineView(  # pylint: disable=too-many-ancestors
    CompactCRUDMixin,
    SupersetModelView,
):
    datamodel = SQLAInterface(models.TableColumn)
    # TODO TODO, review need for this on related_views
    class_permission_name = "Dataset"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.RELATED_VIEW_SET | RouteMethod.API_SET

    list_title = _("Columns")
    show_title = _("Show Column")
    add_title = _("Add Column")
    edit_title = _("Edit Column")

    can_delete = False
    list_widget = ListWidgetWithCheckboxes
    edit_columns = [
        "column_name",
        "verbose_name",
        "description",
        "type",
        "advanced_data_type",
        "groupby",
        "filterable",
        "table",
        "expression",
        "is_dttm",
        "python_date_format",
        "extra",
    ]
    add_columns = edit_columns
    list_columns = [
        "column_name",
        "verbose_name",
        "type",
        "advanced_data_type",
        "groupby",
        "filterable",
        "is_dttm",
        "extra",
    ]
    page_size = 500
    description_columns = {
        "is_dttm": _(
            "Whether to make this column available as a "
            "[Time Granularity] option, column has to be DATETIME or "
            "DATETIME-like"
        ),
        "filterable": _(
            "Whether this column is exposed in the `Filters` section "
            "of the explore view."
        ),
        "type": _(
            "The data type that was inferred by the database. "
            "It may be necessary to input a type manually for "
            "expression-defined columns in some cases. In most case "
            "users should not need to alter this."
        ),
        "expression": utils.markdown(
            "a valid, *non-aggregating* SQL expression as supported by the "
            "underlying backend. Example: `substr(name, 1, 1)`",
            True,
        ),
        "python_date_format": utils.markdown(
            Markup(
                "The pattern of timestamp format. For strings use "
                '<a href="https://docs.python.org/2/library/'
                'datetime.html#strftime-strptime-behavior">'
                "python datetime string pattern</a> expression which needs to "
                'adhere to the <a href="https://en.wikipedia.org/wiki/ISO_8601">'
                "ISO 8601</a> standard to ensure that the lexicographical ordering "
                "coincides with the chronological ordering. If the timestamp "
                "format does not adhere to the ISO 8601 standard you will need to "
                "define an expression and type for transforming the string into a "
                "date or timestamp. Note currently time zones are not supported. "
                "If time is stored in epoch format, put `epoch_s` or `epoch_ms`."
                "If no pattern is specified we fall back to using the optional "
                "defaults on a per database/column name level via the extra parameter."
                ""
            ),
            True,
        ),
        "extra": utils.markdown(
            "Extra data to specify column metadata. Currently supports "
            'certification data of the format: `{ "certification": "certified_by": '
            '"Taylor Swift", "details": "This column is the source of truth." '
            "} }`. This should be modified from the edit datasource model in "
            "Explore to ensure correct formatting.",
            True,
        ),
    }
    label_columns = {
        "column_name": _("Column"),
        "verbose_name": _("Verbose Name"),
        "description": _("Description"),
        "groupby": _("Groupable"),
        "filterable": _("Filterable"),
        "table": _("Table"),
        "expression": _("Expression"),
        "is_dttm": _("Is temporal"),
        "python_date_format": _("Datetime Format"),
        "type": _("Type"),
        "advanced_data_type": _("Business Data Type"),
    }
    validators_columns = {
        "python_date_format": [
            # Restrict viable values to epoch_s, epoch_ms, or a strftime format
            # which adhere's to the ISO 8601 format (without time zone).
            Regexp(
                re.compile(
                    r"""
                    ^(
                        epoch_s|epoch_ms|
                        (?P<date>%Y(-%m(-%d)?)?)([\sT](?P<time>%H(:%M(:%S(\.%f)?)?)?))?
                    )$
                    """,
                    re.VERBOSE,
                ),
                message=_("Invalid date/timestamp format"),
            )
        ]
    }

    add_form_extra_fields = {
        "table": QuerySelectField(
            "Table",
            query_func=lambda: db.session.query(models.SqlaTable),
            allow_blank=True,
            widget=Select2Widget(extra_classes="readonly"),
        )
    }

    edit_form_extra_fields = add_form_extra_fields


class SqlMetricInlineView(  # pylint: disable=too-many-ancestors
    CompactCRUDMixin,
    SupersetModelView,
):
    datamodel = SQLAInterface(models.SqlMetric)
    class_permission_name = "Dataset"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.RELATED_VIEW_SET | RouteMethod.API_SET

    list_title = _("Metrics")
    show_title = _("Show Metric")
    add_title = _("Add Metric")
    edit_title = _("Edit Metric")

    list_columns = ["metric_name", "verbose_name", "metric_type", "extra"]
    edit_columns = [
        "metric_name",
        "description",
        "verbose_name",
        "metric_type",
        "expression",
        "table",
        "d3format",
        "extra",
        "warning_text",
    ]
    description_columns = {
        "expression": utils.markdown(
            "a valid, *aggregating* SQL expression as supported by the "
            "underlying backend. Example: `count(DISTINCT userid)`",
            True,
        ),
        "d3format": utils.markdown(
            "d3 formatting string as defined [here]"
            "(https://github.com/d3/d3-format/blob/master/README.md#format). "
            "For instance, this default formatting applies in the Table "
            "visualization and allow for different metric to use different "
            "formats",
            True,
        ),
        "extra": utils.markdown(
            "Extra data to specify metric metadata. Currently supports "
            'metadata of the format: `{ "certification": { "certified_by": '
            '"Data Platform Team", "details": "This metric is the source of truth." '
            '}, "warning_markdown": "This is a warning." }`. This should be modified '
            "from the edit datasource model in Explore to ensure correct formatting.",
            True,
        ),
    }
    add_columns = edit_columns
    page_size = 500
    label_columns = {
        "metric_name": _("Metric"),
        "description": _("Description"),
        "verbose_name": _("Verbose Name"),
        "metric_type": _("Type"),
        "expression": _("SQL Expression"),
        "table": _("Table"),
        "d3format": _("D3 Format"),
        "extra": _("Extra"),
        "warning_text": _("Warning Message"),
    }

    add_form_extra_fields = {
        "table": QuerySelectField(
            "Table",
            query_func=lambda: db.session.query(models.SqlaTable),
            allow_blank=True,
            widget=Select2Widget(extra_classes="readonly"),
        )
    }

    edit_form_extra_fields = add_form_extra_fields


class RowLevelSecurityView(BaseSupersetView):
    route_base = "/rowlevelsecurity"
    class_permission_name = "RowLevelSecurity"

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()


class TableModelView(  # pylint: disable=too-many-ancestors
    DatasourceModelView, DeleteMixin, YamlExportMixin
):
    datamodel = SQLAInterface(models.SqlaTable)
    class_permission_name = "Dataset"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP
    include_route_methods = RouteMethod.CRUD_SET

    list_title = _("Tables")
    show_title = _("Show Table")
    add_title = _("Import a table definition")
    edit_title = _("Edit Table")

    list_columns = ["link", "database_name", "changed_by_", "modified"]
    order_columns = ["modified"]
    add_columns = ["database", "schema", "table_name"]
    edit_columns = [
        "table_name",
        "sql",
        "filter_select_enabled",
        "fetch_values_predicate",
        "database",
        "schema",
        "description",
        "owners",
        "main_dttm_col",
        "default_endpoint",
        "offset",
        "cache_timeout",
        "is_sqllab_view",
        "template_params",
        "extra",
    ]
    base_filters = [["id", DatasourceFilter, lambda: []]]
    show_columns = edit_columns + ["perm", "slices"]
    related_views = [
        TableColumnInlineView,
        SqlMetricInlineView,
    ]
    base_order = ("changed_on", "desc")
    search_columns = ("database", "schema", "table_name", "owners", "is_sqllab_view")
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
        "table_name": _("Name of the table that exists in the source database"),
        "schema": _(
            "Schema, as used only in some databases like Postgres, Redshift " "and DB2"
        ),
        "description": Markup(
            'Supports <a href="https://daringfireball.net/projects/markdown/">'
            "markdown</a>"
        ),
        "sql": _(
            "This fields acts a Superset view, meaning that Superset will "
            "run a query against this string as a subquery."
        ),
        "fetch_values_predicate": _(
            "Predicate applied when fetching distinct value to "
            "populate the filter control component. Supports "
            "jinja template syntax. Applies only when "
            "`Enable Filter Select` is on."
        ),
        "default_endpoint": _(
            "Redirects to this endpoint when clicking on the table "
            "from the table list"
        ),
        "filter_select_enabled": _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            "from the backend on the fly"
        ),
        "is_sqllab_view": _(
            "Whether the table was generated by the 'Visualize' flow " "in SQL Lab"
        ),
        "template_params": _(
            "A set of parameters that become available in the query using "
            "Jinja templating syntax"
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this table. "
            "A timeout of 0 indicates that the cache never expires. "
            "Note this defaults to the database timeout if undefined."
        ),
        "extra": utils.markdown(
            "Extra data to specify table metadata. Currently supports "
            'metadata of the format: `{ "certification": { "certified_by": '
            '"Data Platform Team", "details": "This table is the source of truth." '
            '}, "warning_markdown": "This is a warning." }`.',
            True,
        ),
    }
    label_columns = {
        "slices": _("Associated Charts"),
        "link": _("Table"),
        "changed_by_": _("Changed By"),
        "database": _("Database"),
        "database_name": _("Database"),
        "changed_on_": _("Last Changed"),
        "filter_select_enabled": _("Enable Filter Select"),
        "schema": _("Schema"),
        "default_endpoint": _("Default Endpoint"),
        "offset": _("Offset"),
        "cache_timeout": _("Cache Timeout"),
        "table_name": _("Table Name"),
        "fetch_values_predicate": _("Fetch Values Predicate"),
        "owners": _("Owners"),
        "main_dttm_col": _("Main Datetime Column"),
        "description": _("Description"),
        "is_sqllab_view": _("SQL Lab View"),
        "template_params": _("Template parameters"),
        "extra": _("Extra"),
        "modified": _("Modified"),
    }
    edit_form_extra_fields = {
        "database": QuerySelectField(
            "Database",
            query_func=lambda: db.session.query(models.Database),
            widget=Select2Widget(extra_classes="readonly"),
        )
    }

    def post_add(  # pylint: disable=arguments-differ
        self,
        item: "TableModelView",
        flash_message: bool = True,
        fetch_metadata: bool = True,
    ) -> None:
        if fetch_metadata:
            item.fetch_metadata()
        if flash_message:
            flash(
                _(
                    "The table was created. "
                    "As part of this two-phase configuration "
                    "process, you should now click the edit button by "
                    "the new table to configure it."
                ),
                "info",
            )

    def post_update(self, item: "TableModelView") -> None:
        self.post_add(item, flash_message=False, fetch_metadata=False)

    def _delete(self, pk: int) -> None:
        DeleteMixin._delete(self, pk)

    @expose(
        "/edit/<pk>",
        methods=(
            "GET",
            "POST",
        ),
    )
    @has_access
    def edit(self, pk: str) -> FlaskResponse:
        """Simple hack to redirect to explore view after saving"""
        resp = super().edit(pk)
        if isinstance(resp, str):
            return resp
        return redirect("/explore/?datasource_type=table&datasource_id={}".format(pk))

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()
