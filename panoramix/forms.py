from wtforms import (
    Field, Form, SelectMultipleField, SelectField, TextField, TextAreaField,
    BooleanField, IntegerField, HiddenField)
from wtforms import validators, widgets
from copy import copy
from panoramix import app
from six import string_types
from collections import OrderedDict
config = app.config


class BetterBooleanField(BooleanField):
    """
    Fixes behavior of html forms omitting non checked <input>
    (which doesn't distinguish False from NULL/missing )
    If value is unchecked, this hidden <input> fills in False value
    """
    def __call__(self, **kwargs):
        html = super(BetterBooleanField, self).__call__(**kwargs)
        html += u'<input type="hidden" name="show_brush" value="false">'
        return widgets.HTMLString(html)


class SelectMultipleSortableField(SelectMultipleField):
    """
    Works along with select2sortable to preserves the sort order
    """
    def iter_choices(self):
        d = OrderedDict()
        for value, label in self.choices:
            selected = self.data is not None and self.coerce(value) in self.data
            d[value] = (value, label, selected)
        if self.data:
            for value in self.data:
                yield d.pop(value)
        while d:
            yield d.pop(d.keys()[0])


class FreeFormSelect(widgets.Select):
    def __call__(self, field, **kwargs):
        kwargs.setdefault('id', field.id)
        if self.multiple:
            kwargs['multiple'] = True
        html = ['<select %s>' % widgets.html_params(name=field.name, **kwargs)]
        found = False
        for val, label, selected in field.iter_choices():
            html.append(self.render_option(val, label, selected))
            if field.data and val == field.data:
                found = True
        if not found:
            html.insert(1, self.render_option(field.data, field.data, True))
        html.append('</select>')
        return widgets.HTMLString(''.join(html))

class FreeFormSelectField(SelectField):
    widget = FreeFormSelect()
    def pre_validate(self, form):
        return


class OmgWtForm(Form):
    fieldsets = {}
    css_classes = dict()

    def get_field(self, fieldname):
        return getattr(self, fieldname)

    def field_css_classes(self, fieldname):
        if fieldname in self.css_classes:
            return " ".join(self.css_classes[fieldname])
        return ""


class FormFactory(object):
    row_limits = [10, 50, 100, 500, 1000, 5000, 10000, 50000]
    series_limits = [0, 5, 10, 25, 50, 100, 500]
    fieltype_class = {
        SelectField: 'select2',
        SelectMultipleField: 'select2',
        FreeFormSelectField: 'select2_freeform',
        SelectMultipleSortableField: 'select2Sortable',
    }

    def __init__(self, viz):
        self.viz = viz
        from panoramix.viz import viz_types
        viz = self.viz
        datasource = viz.datasource
        default_metric = datasource.metrics_combo[0][0]
        default_groupby = datasource.groupby_column_names[0]
        group_by_choices = [(s, s) for s in datasource.groupby_column_names]
        # Pool of all the fields that can be used in Panoramix
        self.field_dict = {
            'viz_type': SelectField(
                'Viz',
                default='table',
                choices=[(k, v.verbose_name) for k, v in viz_types.items()],
                description="The type of visualization to display"),
            'metrics': SelectMultipleSortableField(
                'Metrics', choices=datasource.metrics_combo,
                default=[default_metric],
                description="One or many metrics to display"),
            'metric': SelectField(
                'Metric', choices=datasource.metrics_combo,
                default=default_metric,
                description="Chose the metric"),
            'secondary_metric': SelectField(
                'Color Metric', choices=datasource.metrics_combo,
                default=default_metric,
                description="A metric to use for color"),
            'groupby': SelectMultipleSortableField(
                'Group by',
                choices=self.choicify(datasource.groupby_column_names),
                description="One or many fields to group by"),
            'columns': SelectMultipleSortableField(
                'Columns',
                choices=self.choicify(datasource.groupby_column_names),
                description="One or many fields to pivot as columns"),
            'granularity': FreeFormSelectField(
                'Time Granularity', default="one day",
                choices=self.choicify([
                    'all',
                    '5 seconds',
                    '30 seconds',
                    '1 minute',
                    '5 minutes',
                    '1 hour',
                    '6 hour',
                    '1 day',
                    '7 days',
                ]),
                description=(
                    "The time granularity for the visualization. Note that you "
                    "can type and use simple natural language as in '10 seconds', "
                    "'1 day' or '56 weeks'")),
            'granularity_sqla': SelectField(
                'Time Column', default=datasource.main_dttm_col,
                choices=self.choicify(datasource.dttm_cols),
                description=(
                    "The time granularity for the visualization. Note that you "
                    "can define arbitrary expression that return a DATETIME "
                    "column in the table editor")),
            'since': FreeFormSelectField(
                'Since', default="7 days ago",
                choices=self.choicify([
                    '1 hour ago',
                    '12 hours ago',
                    '1 day ago',
                    '7 days ago',
                    '28 days ago',
                    '90 days ago',
                    '1 year ago'
                ]),
                description=(
                    "Timestamp from filter. This supports free form typing and "
                    "natural language as in '1 day ago', '28 days' or '3 years'")),
            'until': FreeFormSelectField('Until', default="now",
                choices=self.choicify([
                    'now',
                    '1 day ago',
                    '7 days ago',
                    '28 days ago',
                    '90 days ago',
                    '1 year ago'])
                ),
            'row_limit':
                SelectField(
                    'Row limit',
                    default=config.get("ROW_LIMIT"),
                    choices=self.choicify(self.row_limits)),
            'limit':
                SelectField(
                    'Series limit',
                    choices=self.choicify(self.series_limits),
                    default=50,
                    description=(
                        "Limits the number of time series that get displayed")),
            'rolling_type': SelectField(
                'Rolling',
                default='None',
                choices=[(s, s) for s in ['None', 'mean', 'sum', 'std', 'cumsum']],
                description=(
                    "Defines a rolling window function to apply, works along "
                    "with the [Periods] text box")),
            'rolling_periods': IntegerField(
                'Periods',
                validators=[validators.optional()],
                description=(
                "Defines the size of the rolling window function, "
                "relative to the time granularity selected")),
            'series': SelectField(
                'Series', choices=group_by_choices,
                default=default_groupby,
                description=(
                    "Defines the grouping of entities. "
                    "Each serie is shown as a specific color on the chart and "
                    "has a legend toggle")),
            'entity': SelectField('Entity', choices=group_by_choices,
                default=default_groupby,
                description="This define the element to be plotted on the chart"),
            'x': SelectField(
                'X Axis', choices=datasource.metrics_combo,
                default=default_metric,
                description="Metric assigned to the [X] axis"),
            'y': SelectField('Y Axis', choices=datasource.metrics_combo,
                default=default_metric,
                description="Metric assigned to the [Y] axis"),
            'size': SelectField(
                    'Bubble Size',
                    default=default_metric,
                    choices=datasource.metrics_combo),
            'where': TextField(
                'Custom WHERE clause', default='',
                description=(
                    "The text in this box gets included in your query's WHERE "
                    "clause, as an AND to other criteria. You can include "
                    "complex expression, parenthesis and anything else "
                    "supported by the backend it is directed towards.")),
            'having': TextField('Custom HAVING clause', default='',
                description=(
                    "The text in this box gets included in your query's HAVING"
                    " clause, as an AND to other criteria. You can include "
                    "complex expression, parenthesis and anything else "
                    "supported by the backend it is directed towards.")),
            'compare_lag': TextField('Comparison Period Lag',
                description="Based on granularity, number of time periods to compare against"),
            'compare_suffix': TextField('Comparison suffix',
                description="Suffix to apply after the percentage display"),
            'y_axis_format': TextField('Y axis format',
                description="D3 format syntax for y axis "
                            "https://github.com/mbostock/\n"
                            "d3/wiki/Formatting"),
            'markup_type': SelectField(
                "Markup Type",
                choices=self.choicify(['markdown', 'html']),
                default="markdown",
                description="Pick your favorite markup language"),
            'rotation': SelectField(
                "Rotation",
                choices=[(s, s) for s in ['random', 'flat', 'square']],
                default="random",
                description="Rotation to apply to words in the cloud"),
            'line_interpolation': SelectField(
                "Line Style",
                choices=self.choicify([
                    'linear', 'basis', 'cardinal', 'monotone',
                    'step-before', 'step-after']),
                default='linear',
                description="Line interpolation as defined by d3.js"),
            'code': TextAreaField(
                "Code", description="Put your code here", default=''),
            'pandas_aggfunc': SelectField(
                "Aggregation function",
                choices=self.choicify([
                    'sum', 'mean', 'min', 'max', 'median', 'stdev', 'var']),
                default='sum',
                description=(
                    "Aggregate function to apply when pivoting and "
                    "computing the total rows and columns")),
            'size_from': TextField(
                "Font Size From",
                default="20",
                description="Font size for the smallest value in the list"),
            'size_to': TextField(
                "Font Size To",
                default="150",
                description="Font size for the biggest value in the list"),
            'show_brush': BetterBooleanField(
                "Range Filter", default=True,
                description=(
                    "Whether to display the time range interactive selector")),
            'show_legend': BetterBooleanField(
                "Legend", default=True,
                description="Whether to display the legend (toggles)"),
            'x_axis_showminmax': BetterBooleanField(
                "X axis show min/max", default=True,
                description=(
                    "Whether to display the min and max values of the axis")),
            'rich_tooltip': BetterBooleanField(
                "Rich Tooltip", default=True,
                description="The rich tooltip shows a list of all series for that point in time"),
            'y_axis_zero': BetterBooleanField(
                "Y Axis Zero", default=False,
                description="Force the Y axis to start at 0 instead of the minimum value"),
            'y_log_scale': BetterBooleanField(
                "Y Log", default=False,
                description="Use a log scale for the Y axis"),
            'x_log_scale': BetterBooleanField(
                "X Log", default=False,
                description="Use a log scale for the X axis"),
            'donut': BetterBooleanField(
                "Donut", default=False,
                description="Do you want a donut or a pie?"),
            'contribution': BetterBooleanField(
                "Contribution", default=False,
                description="Compute the contribution to the total"),
            'num_period_compare': IntegerField(
                "Period Ratio", default=None,
                validators=[validators.optional()],
                description=(
                    "[integer] Number of period to compare against, "
                    "this is relative to the granularity selected")),
            'time_compare': TextField(
                "Time Shift",
                default="",
                description=(
                    "Overlay a timeseries from a "
                    "relative time period. Expects relative time delta "
                    "in natural language (example: 24 hours, 7 days, "
                    "56 weeks, 365 days")),
        }

    @staticmethod
    def choicify(l):
        return [("{}".format(obj), "{}".format(obj)) for obj in l]

    def get_form(self, previous=False):
        px_form_fields = self.field_dict
        viz = self.viz
        datasource = viz.datasource
        field_css_classes = {}
        for name, obj in px_form_fields.items():
            field_css_classes[name] = ['form-control']
            s = self.fieltype_class.get(obj.field_class)
            if s:
                field_css_classes[name] += [s]

        for field in ('show_brush', 'show_legend', 'rich_tooltip'):
            field_css_classes[field] += ['input-sm']

        class QueryForm(OmgWtForm):
            fieldsets = copy(viz.fieldsetizer())
            css_classes = field_css_classes
            standalone = HiddenField()
            async = HiddenField()
            json = HiddenField()
            slice_id = HiddenField()
            slice_name = HiddenField()
            previous_viz_type = HiddenField(default=viz.viz_type)
            collapsed_fieldsets = HiddenField()

        filter_cols = datasource.filterable_column_names or ['']
        for i in range(10):
            setattr(QueryForm, 'flt_col_' + str(i), SelectField(
                'Filter 1',
                default=filter_cols[0],
                choices=self.choicify(filter_cols)))
            setattr(QueryForm, 'flt_op_' + str(i), SelectField(
                'Filter 1',
                default='in',
                choices=self.choicify(['in', 'not in'])))
            setattr(
                QueryForm, 'flt_eq_' + str(i),
                TextField("Super", default=''))
        for fieldset in viz.fieldsetizer():
            for ff in fieldset['fields']:
                if isinstance(ff, string_types):
                    ff = [ff]
                for s in ff:
                    if s:
                        setattr(QueryForm, s, px_form_fields[s])

        # datasource type specific form elements
        if datasource.__class__.__name__ == 'SqlaTable':
            QueryForm.fieldsets += ({
                'label': 'SQL',
                'fields': ['where', 'having'],
                'description': (
                    "This section exposes ways to include snippets of "
                    "SQL in your query"),
            },)
            setattr(QueryForm, 'where', px_form_fields['where'])
            setattr(QueryForm, 'having', px_form_fields['having'])

            if 'granularity' in viz.flat_form_fields():
                setattr(
                    QueryForm,
                    'granularity', px_form_fields['granularity_sqla'])
                field_css_classes['granularity'] = ['form-control', 'select2']
        return QueryForm
