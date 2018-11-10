"""Views used by the SqlAlchemy connector"""
import json
import logging
from flask import flash, Markup, redirect
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.fieldwidgets import BS3TextAreaFieldWidget, BS3TextFieldWidget
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
from past.builtins import basestring
import sqlalchemy as sa
from wtforms import SelectField, StringField, validators
from superset import appbuilder, db, security, security_manager, utils
from superset.connectors.base.views import DatasourceModelView
from flask_appbuilder.security.decorators import has_access
from superset.views.base import (
    DatasourceFilter, DeleteMixin, get_datasource_exist_error_msg,
    ListWidgetWithCheckboxes, SupersetModelView,
)

from .models import FORMATS, PandasColumn, PandasDatasource, PandasMetric


class ChoiceTypeSelectField(SelectField):
    """A SelectField based on a ChoiceType model field."""

    def process_data(self, value):
        """Use the code rather than the str() representation as data"""
        try:
            self.data = value.code
        except AttributeError:
            super(ChoiceTypeSelectField, self).process_data(value)


class JSONField(StringField):
    """
    JSON field for WTForms that converts between the form string data
    and a dictionary representation, with validation

    See https://gist.github.com/dukebody/dcc371bf286534d546e9
    """

    def _value(self):
        return json.dumps(self.data) if self.data else ''

    def process_formdata(self, valuelist):
        if valuelist:
            try:
                self.data = json.loads(valuelist[0])
            except ValueError:
                raise ValueError('This field contains invalid JSON')
        else:
            self.data = None

    def pre_validate(self, form):
        super(StringField, self).pre_validate(form)
        if self.data:
            try:
                json.dumps(self.data)
            except TypeError:
                raise ValueError('This field contains invalid JSON')


class PandasColumnInlineView(CompactCRUDMixin, SupersetModelView):  # noqa
    datamodel = SQLAInterface(PandasColumn)

    list_title = _('List Columns')
    show_title = _('Show Column')
    add_title = _('Add Column')
    edit_title = _('Edit Column')

    list_widget = ListWidgetWithCheckboxes
    edit_columns = [
        'column_name', 'verbose_name', 'description',
        'type', 'groupby', 'filterable',
        'datasource', 'count_distinct', 'sum', 'avg', 'min', 'max']
    add_columns = edit_columns
    list_columns = [
        'column_name', 'verbose_name', 'type', 'groupby', 'filterable',
        'count_distinct', 'sum', 'avg', 'min', 'max']
    page_size = 500
    description_columns = {
        'is_dttm': _(
            'Whether to make this column available as a '
            '[Time Granularity] option, column has to be DATETIME or '
            'DATETIME-like'),
        'filterable': _(
            'Whether this column is exposed in the `Filters` section '
            'of the explore view.'),
        'type': _(
            'The data type that was inferred by Pandas. '
            'It may be necessary to input a type manually for '
            'expression-defined columns in some cases. In most case '
            'users should not need to alter this.'),
    }
    label_columns = {
        'column_name': _('Column'),
        'verbose_name': _('Verbose Name'),
        'description': _('Description'),
        'groupby': _('Groupable'),
        'filterable': _('Filterable'),
        'datasource': _('Datasource'),
        'count_distinct': _('Count Distinct'),
        'sum': _('Sum'),
        'avg': _('Average'),
        'min': _('Min'),
        'max': _('Max'),
        'type': _('Type'),
    }


appbuilder.add_view_no_menu(PandasColumnInlineView)


class PandasMetricInlineView(CompactCRUDMixin, SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(PandasMetric)

    list_title = _('List Metrics')
    show_title = _('Show Metric')
    add_title = _('Add Metric')
    edit_title = _('Edit Metric')

    list_columns = ['metric_name', 'verbose_name', 'metric_type']
    edit_columns = [
        'metric_name', 'description', 'verbose_name', 'metric_type',
        'source', 'expression', 'datasource', 'd3format', 'is_restricted',
        'warning_text']
    description_columns = {
        'source': utils.markdown(
            'a comma-separated list of column(s) used to calculate '
            ' the metric. Example: `claim_amount`', True),
        'expression': utils.markdown(
            'a valid Pandas expression as supported by the underlying '
            'backend. Example: `count()`', True),
        'is_restricted': _('Whether the access to this metric is restricted '
                           'to certain roles. Only roles with the permission '
                           "'metric access on XXX (the name of this metric)' "
                           'are allowed to access this metric'),
        'd3format': utils.markdown(
            'd3 formatting string as defined [here]'
            '(https://github.com/d3/d3-format/blob/master/README.md#format). '
            'For instance, this default formatting applies in the Table '
            'visualization and allow for different metric to use different '
            'formats', True,
        ),
    }
    add_columns = edit_columns
    page_size = 500
    label_columns = {
        'metric_name': _('Metric'),
        'description': _('Description'),
        'verbose_name': _('Verbose Name'),
        'metric_type': _('Type'),
        'source': _('Pandas Source Columns'),
        'expression': _('Pandas Expression'),
        'datasource': _('Datasource'),
        'd3format': _('D3 Format'),
        'is_restricted': _('Is Restricted'),
        'warning_text': _('Warning Message'),
    }

    def post_add(self, metric):
        if metric.is_restricted:
            security.merge_perm(security_manager, 'metric_access', metric.get_perm())

    def post_update(self, metric):
        if metric.is_restricted:
            security.merge_perm(security_manager, 'metric_access', metric.get_perm())


appbuilder.add_view_no_menu(PandasMetricInlineView)


class PandasDatasourceModelView(DatasourceModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(PandasDatasource)

    list_title = _('List File Datasources')
    show_title = _('Show File Datasource')
    add_title = _('Add File Datasource')
    edit_title = _('Edit File Datasource')

    list_columns = [
        'link', 'changed_by_', 'modified']
    order_columns = [
        'link', 'changed_on_']
    add_columns = ['name', 'source_url', 'source_auth', 'source_parameters',
                   'format', 'additional_parameters']
    add_form_extra_fields = {
        'source_auth': JSONField(
            _('Source Credentials'),
            [validators.optional(), validators.length(max=100)],
            widget=BS3TextFieldWidget(),
            description=(
                'Credentials required to access the raw data, if required. '
                'Can be either a username and password in the form '
                "'[\"username\", \"password\"]' which will be authenticated "
                'using HTTP Basic Auth, or a string which will be used as '
                'an Authorization header')),
        'source_parameters': JSONField(
            _('Additional Query Parameters'),
            [validators.optional(), validators.length(max=500)],
            widget=BS3TextAreaFieldWidget(),
            description=(
                'A JSON-formatted dictionary of additional parameters '
                'used to request the remote file')),
        'format': ChoiceTypeSelectField(_('Format'), choices=FORMATS),
        'additional_parameters': JSONField(
            _('Additional Read Parameters'),
            [validators.optional(), validators.length(max=500)],
            widget=BS3TextAreaFieldWidget(),
            description=(
                'A JSON-formatted dictionary of additional parameters '
                'passed to the Pandas read function')),
    }
    edit_columns = [
        'name', 'source_url', 'source_auth', 'source_parameters',
        'format', 'additional_parameters',
        'filter_select_enabled', 'slices',
        'fetch_values_predicate',
        'description', 'owner',
        'main_dttm_col', 'default_endpoint', 'offset', 'cache_timeout']
    edit_form_extra_fields = add_form_extra_fields
    show_columns = edit_columns + ['perm']
    related_views = [PandasColumnInlineView, PandasMetricInlineView]
    base_order = ('changed_on', 'desc')
    search_columns = (
        'owner', 'name', 'source_url',
    )
    description_columns = {
        'slices': _(
            'The list of slices associated with this datasource. By '
            'altering this datasource, you may change how these associated '
            'slices behave. '
            'Also note that slices need to point to a datasource, so '
            'this form will fail at saving if removing slices from a '
            'datasource. If you want to change the datasource for a slice, '
            "overwrite the slice from the 'explore view'"),
        'offset': _('Timezone offset (in hours) for this datasource'),
        'name': _(
            'The name of this datasource'),
        'source_url': _(
            'The URL used to access the raw data'),
        'format': _(
            'The format of the raw data, e.g. csv'),
        'description': Markup(
            "Supports <a href='https://daringfireball.net/projects/markdown/'>"
            'markdown</a>'),
        'fetch_values_predicate': _(
            'Predicate applied when fetching distinct value to '
            'populate the filter control component. Supports '
            'jinja template syntax. Applies only when '
            '`Enable Filter Select` is on.'),
        'default_endpoint': _(
            'Redirects to this endpoint when clicking on the datasource '
            'from the datasource list'),
        'filter_select_enabled': _(
            "Whether to populate the filter's dropdown in the explore "
            "view's filter section with a list of distinct values fetched "
            'from the backend on the fly'),
    }
    base_filters = [['id', DatasourceFilter, lambda: []]]
    label_columns = {
        'slices': _('Associated Slices'),
        'link': _('Datasource'),
        'changed_by_': _('Changed By'),
        'changed_on_': _('Last Changed'),
        'filter_select_enabled': _('Enable Filter Select'),
        'default_endpoint': _('Default Endpoint'),
        'offset': _('Offset'),
        'cache_timeout': _('Cache Timeout'),
        'name': _('Name'),
        'source_url': _('Source URL'),
        'format': _('Format'),
        'fetch_values_predicate': _('Fetch Values Predicate'),
        'owner': _('Owner'),
        'main_dttm_col': _('Main Datetime Column'),
        'description': _('Description'),
    }

    def pre_add(self, datasource):
        number_of_existing_datasources = (
            db.session
              .query(sa.func.count('*'))
              .filter(PandasDatasource.source_url == datasource.source_url)
              .scalar())
        # datasource object is already added to the session
        if number_of_existing_datasources > 1:
            raise Exception(
                get_datasource_exist_error_msg(datasource.full_name))

        # Fail before adding if the datasource can't be found
        try:
            datasource.get_dataframe()
        except Exception as e:
            logging.exception(e)
            raise Exception(_(
                'File [{}] could not be read, '
                'please double check the '
                'Source URL and Read Method').format(datasource.name))

    def post_add(self, datasource, flash_message=True):
        datasource.get_metadata()
        security.merge_perm(security_manager, 'datasource_access', datasource.get_perm())

        if flash_message:
            flash(_(
                'The datasource was created. '
                'As part of this two phase configuration '
                'process, you should now click the edit button by '
                'the new datasource to configure it.'), 'info')

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
    'File Datasources',
    label=__('File Datasources'),
    category='Sources',
    category_label=__('Sources'),
    icon='fa-file',)

appbuilder.add_separator('Sources')
