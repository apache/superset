from wtforms import Field, Form, SelectMultipleField, SelectField, TextField
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
    }
    field_css_classes = {k: ['form-control'] for k in px_form_fields.keys()}
    select2 = [
        'viz_type', 'metrics', 'groupby',
        'row_limit', 'rolling_type', 'series',
        'entity', 'x', 'y', 'size']
    field_css_classes['since'] += ['select2_free_since']
    field_css_classes['until'] += ['select2_free_until']
    field_css_classes['granularity'] += ['select2_free_granularity']
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
