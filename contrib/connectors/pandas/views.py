"""Views used by the SqlAlchemy connector"""
import logging

from past.builtins import basestring

from flask import Markup, flash, redirect
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
import sqlalchemy as sa

from flask_babel import lazy_gettext as _
from flask_babel import gettext as __

from superset import appbuilder, db, utils, security, sm
from superset.utils import has_access
from superset.connectors.base.views import DatasourceModelView
from superset.views.base import (
    SupersetModelView, ListWidgetWithCheckboxes, DeleteMixin, DatasourceFilter,
    get_datasource_exist_error_mgs,
)

from . import models


class PandasColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.PandasColumn)

    list_title = _('List Columns')
    show_title = _('Show Column')
    add_title = _('Add Column')
    edit_title = _('Edit Column')

    can_delete = False
    list_widget = ListWidgetWithCheckboxes
    edit_columns = [
        'column_name', 'verbose_name', 'description',
        'type', 'groupby', 'filterable',
        'datasource', 'count_distinct', 'sum', 'min', 'max']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'verbose_name', 'type', 'groupby', 'filterable',
        'count_distinct', 'sum', 'min', 'max']
    page_size = 500
    description_columns = {
        'is_dttm': _(
            "Whether to make this column available as a "
            "[Time Granularity] option, column has to be DATETIME or "
            "DATETIME-like"),
        'filterable': _(
            "Whether this column is exposed in the `Filters` section "
            "of the explore view."),
        'type': _(
            "The data type that was inferred by Pandas. "
            "It may be necessary to input a type manually for "
            "expression-defined columns in some cases. In most case "
            "users should not need to alter this."),
    }
    label_columns = {
        'column_name': _("Column"),
        'verbose_name': _("Verbose Name"),
        'description': _("Description"),
        'groupby': _("Groupable"),
        'filterable': _("Filterable"),
        'datasource': _("Datasource"),
        'count_distinct': _("Count Distinct"),
        'sum': _("Sum"),
        'min': _("Min"),
        'max': _("Max"),
        'type': _('Type'),
    }


appbuilder.add_view_no_menu(PandasColumnInlineView)


class PandasMetricInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(models.PandasMetric)

    list_title = _('List Metrics')
    show_title = _('Show Metric')
    add_title = _('Add Metric')
    edit_title = _('Edit Metric')

    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'source', 'expression', 'datasource', 'd3format', 'is_restricted']
    description_columns = {
        'source': utils.markdown(
            "a comma-separated list of column(s) used to calculate "
            " the metric. Example: `claim_amount`", True),
        'expression': utils.markdown(
            "a valid Pandas expression as supported by the underlying "
            "backend. Example: `count()`", True),
        'is_restricted': _("Whether the access to this metric is restricted "
                           "to certain roles. Only roles with the permission "
                           "'metric access on XXX (the name of this metric)' "
                           "are allowed to access this metric"),
        'd3format': utils.markdown(
            "d3 formatting string as defined [here]"
            "(https://github.com/d3/d3-format/blob/master/README.md#format). "
            "For instance, this default formatting applies in the Table "
            "visualization and allow for different metric to use different "
            "formats", True
        ),
    }
    add_columns = edit_columns
    page_size = 500
    label_columns = {
        'metric_name': _("Metric"),
        'description': _("Description"),
        'verbose_name': _("Verbose Name"),
        'metric_type': _("Type"),
        'source': _("Pandas Source Columns"),
        'expression': _("Pandas Expression"),
        'datasource': _("Datasource"),
        'd3format': _("D3 Format"),
        'is_restricted': _('Is Restricted')
    }

    def post_add(self, metric):
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())

    def post_update(self, metric):
        if metric.is_restricted:
            security.merge_perm(sm, 'metric_access', metric.get_perm())


appbuilder.add_view_no_menu(PandasMetricInlineView)


class PandasDatasourceModelView(DatasourceModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.PandasDatasource)

    list_title = _('List Pandas Datasources')
    show_title = _('Show Pandas Datasource')
    add_title = _('Add Pandas Datasource')
    edit_title = _('Edit Pandas Datasource')

    list_columns = [
        'link', 'changed_by_', 'modified']
    order_columns = [
        'link', 'changed_on_']
    add_columns = ['name', 'source_url', 'format']
    edit_columns = [
        'name', 'source_url', 'format',
        'filter_select_enabled', 'slices',
        'fetch_values_predicate',
        'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    show_columns = edit_columns + ['perm']
    related_views = [PandasColumnInlineView, PandasMetricInlineView]
    base_order = ('changed_on', 'desc')
    search_columns = (
        'owner', 'name', 'source_url'
    )
    description_columns = {
        'slices': _(
            "The list of slices associated with this datasource. By "
            "altering this datasource, you may change how these associated "
            "slices behave. "
            "Also note that slices need to point to a datasource, so "
            "this form will fail at saving if removing slices from a "
            "datasource. If you want to change the datasource for a slice, "
            "overwrite the slice from the 'explore view'"),
        'offset': _("Timezone offset (in hours) for this datasource"),
        'name': _(
            "The name of this datasource"),
        'source_url': _(
            "The URL used to access the raw data"),
        'format': _(
            "The format of the raw data, e.g. csv"),
        'additional_parameters': _(
            "A JSON-formatted dictionary of additional parameters "
            "to be used by Pandas when reading the raw data"),
        'description': Markup(
            "Supports <a href='https://daringfireball.net/projects/markdown/'>"
            "markdown</a>"),
        'fetch_values_predicate': _(
            "Predicate applied when fetching distinct value to "
            "populate the filter control component. Supports "
            "jinja template syntax. Applies only when "
            "`Enable Filter Select` is on."
        ),
        'default_endpoint': _(
            "Redirects to this endpoint when clicking on the datasource "
            "from the datasource list"),
        'filter_select_enabled': _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            "from the backend on the fly"),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'slices': _("Associated Slices"),
        'link': _("Datasource"),
        'changed_by_': _("Changed By"),
        'changed_on_': _("Last Changed"),
        'filter_select_enabled': _("Enable Filter Select"),
        'default_endpoint': _('Default Endpoint'),
        'offset': _("Offset"),
        'cache_timeout': _("Cache Timeout"),
        'name': _("Name"),
        'source_url': _("Source URL"),
        'format': _("Format"),
        'additional_parameters': _("Additional Read Parameters"),
        'fetch_values_predicate': _('Fetch Values Predicate'),
        'owner': _("Owner"),
        'main_dttm_col': _("Main Datetime Column"),
        'description': _('Description'),
    }

    def pre_add(self, datasource):
        number_of_existing_datasources = (
            db.session
              .query(sa.func.count('*'))
              .filter(models.PandasDatasource.source_url == datasource.source_url)
              .scalar())
        # datasource object is already added to the session
        if number_of_existing_datasources > 1:
            raise Exception(
                get_datasource_exist_error_mgs(datasource.full_name))

        # Fail before adding if the datasource can't be found
        try:
            datasource.get_dataframe()
        except Exception as e:
            logging.exception(e)
            raise Exception(_(
                "File [{}] could not be read, "
                "please double check the "
                "Source URL and Read Method").format(datasource.name))

    def post_add(self, datasource, flash_message=True):
        datasource.get_metadata()
        security.merge_perm(sm, 'datasource_access', datasource.get_perm())

        if flash_message:
            flash(_(
                "The datasource was created. "
                "As part of this two phase configuration "
                "process, you should now click the edit button by "
                "the new datasource to configure it."), "info")

    def post_update(self, datasource):
        self.post_add(datasource, flash_message=False)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)

    @expose('/edit/<pk>', methods=['GET', 'POST'])
    @has_access
    def edit(self, pk):
        """Simple hack to redirect to explore view after saving"""
        resp = super(PandasDatasourceModelView, self).edit(pk)
        if isinstance(resp, basestring):
            return resp
        return redirect('/superset/explore/pandas/{}/'.format(pk))


appbuilder.add_view(
    PandasDatasourceModelView,
    "Pandas Datasources",
    label=__("Pandas Datasources"),
    category="Sources",
    category_label=__("Sources"),
    icon='fa-file',)

appbuilder.add_separator("Sources")
