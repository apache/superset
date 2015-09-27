from wtforms import (
    Field, Form, SelectMultipleField, SelectField, TextField, TextAreaField,
    BooleanField)
from copy import copy


class OmgWtForm(Form):
    field_order = tuple()
    css_classes = dict()

    @property
    def fields(self):
        fields = []
        for field in self.field_order:
            if hasattr(self, field):
                obj = getattr(self, field)
                if isinstance(obj, Field):
                    fields.append(getattr(self, field))
        return fields

    def get_field(self, fieldname):
        return getattr(self, fieldname)

    def field_css_classes(self, fieldname):
        if fieldname in self.css_classes:
            return " ".join(self.css_classes[fieldname])
        return ""


def form_factory(viz):
    datasource = viz.datasource
    from panoramix.viz import viz_types
    row_limits = [10, 50, 100, 500, 1000, 5000, 10000]
    series_limits = [0, 5, 10, 25, 50, 100, 500]
    group_by_choices = [(s, s) for s in datasource.groupby_column_names]
    # Pool of all the fields that can be used in Panoramix
    px_form_fields = {
        'viz_type': SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz_types.items()],
            description="The type of visualization to display"),
        'metrics': SelectMultipleField(
            'Metrics', choices=datasource.metrics_combo,
            description="One or many metrics to display"),
        'metric': SelectField(
            'Metric', choices=datasource.metrics_combo,
            description="One or many metrics to display"),
        'groupby': SelectMultipleField(
            'Group by',
            choices=[(s, s) for s in datasource.groupby_column_names],
            description="One or many fields to group by"),
        'granularity': TextField(
            'Time Granularity', default="one day",
            description=(
                "The time granularity for the visualization. Note that you "
                "can type and use simple natural language as in '10 seconds', "
                "'1 day' or '56 weeks'")),
        'since': TextField(
            'Since', default="one day ago", description=(
                "Timestamp from filter. This supports free form typing and "
                "natural language as in '1 day ago', '28 days' or '3 years'")),
        'until': TextField('Until', default="now"),
        'row_limit':
            SelectField(
                'Row limit', choices=[(s, s) for s in row_limits]),
        'limit':
            SelectField(
                'Series limit', choices=[(s, s) for s in series_limits],
                description=(
                    "Limits the number of time series that get displayed")),
        'rolling_type': SelectField(
            'Rolling',
            choices=[(s, s) for s in ['mean', 'sum', 'std']],
            description=(
                "Defines a rolling window function to apply")),
        'rolling_periods': TextField('Periods', description=(
            "Defines the size of the rolling window function, "
            "relative to the 'granularity' field")),
        'series': SelectField('Series', choices=group_by_choices),
        'entity': SelectField('Entity', choices=group_by_choices),
        'x': SelectField('X Axis', choices=datasource.metrics_combo),
        'y': SelectField('Y Axis', choices=datasource.metrics_combo),
        'size': SelectField('Bubble Size', choices=datasource.metrics_combo),
        'where': TextField('Custom WHERE clause'),
        'compare_lag': TextField('Comparison Period Lag',
            description="Based on granularity, number of time periods to compare against"),
        'compare_suffix': TextField('Comparison suffix',
            description="Suffix to apply after the percentage display"),
        'markup_type': SelectField(
            "Markup Type",
            choices=[(s, s) for s in ['markdown', 'html']],
            default="markdown",
            description="Pick your favorite markup language"),
        'rotation': SelectField(
            "Rotation",
            choices=[(s, s) for s in ['random', 'flat', 'square']],
            default="random",
            description="Rotation to apply to words in the cloud"),
        'code': TextAreaField("Code", description="Put your code here"),
        'size_from': TextField(
            "Font Size From",
            default="20",
            description="Font size for the smallest value in the list"),
        'size_to': TextField(
            "Font Size To",
            default="150",
            description="Font size for the biggest value in the list"),
        'show_brush': BooleanField(
            "Range Selector", default=True,
            description="Whether to display the time range interactive selector"),
        'show_legend': BooleanField(
            "Legend", default=True,
            description="Whether to display the legend (toggles)"),
        'rich_tooltip': BooleanField(
            "Rich Tooltip", default=True,
            description="The rich tooltip shows a list of all series for that point in time"),
        'y_axis_zero': BooleanField(
            "Y Axis Zero", default=False,
            description="Force the Y axis to start at 0 instead of the minimum value"),
        'y_log_scale': BooleanField(
            "Y Log", default=False,
            description="Use a log scale for the Y axis"),
    }
    field_css_classes = {k: ['form-control'] for k in px_form_fields.keys()}
    select2 = [
        'viz_type', 'metrics', 'groupby',
        'row_limit', 'rolling_type', 'series',
        'entity', 'x', 'y', 'size', 'rotation', 'metric', 'limit',
        'markup_type',]
    field_css_classes['since'] += ['select2_free_since']
    field_css_classes['until'] += ['select2_free_until']
    field_css_classes['granularity'] += ['select2_free_granularity']
    for field in ('show_brush', 'show_legend', 'rich_tooltip'):
        field_css_classes[field] += ['input-sm']
    for field in select2:
        field_css_classes[field] += ['select2']

    class QueryForm(OmgWtForm):
        field_order = copy(viz.form_fields)
        css_classes = field_css_classes

    for i in range(10):
        setattr(QueryForm, 'flt_col_' + str(i), SelectField(
            'Filter 1',
            choices=[(s, s) for s in datasource.filterable_column_names]))
        setattr(QueryForm, 'flt_op_' + str(i), SelectField(
            'Filter 1', choices=[(m, m) for m in ['in', 'not in']]))
        setattr(QueryForm, 'flt_eq_' + str(i), TextField("Super"))
    for ff in viz.form_fields:
        if isinstance(ff, basestring):
            ff = [ff]
        for s in ff:
            setattr(QueryForm, s, px_form_fields[s])

    # datasource type specific form elements
    if datasource.__class__.__name__ == 'Table':
        QueryForm.field_order += ['where']
        setattr(QueryForm, 'where', px_form_fields['where'])
    return QueryForm
