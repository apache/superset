from wtforms import Field, Form, SelectMultipleField, SelectField, TextField


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


def form_factory(datasource, viz, form_args=None):
    from panoramix.viz import viz_types
    row_limits = [10, 50, 100, 500, 1000, 5000, 10000]
    series_limits = [0, 5, 10, 25, 50, 100, 500]
    group_by_choices = [(s, s) for s in datasource.groupby_column_names]
    # Pool of all the fields that can be used in Panoramix
    px_form_fields = {
        'viz_type': SelectField(
            'Viz',
            choices=[(k, v.verbose_name) for k, v in viz_types.items()]),
        'metrics': SelectMultipleField(
            'Metrics', choices=datasource.metrics_combo),
        'groupby': SelectMultipleField(
            'Group by',
            choices=[(s, s) for s in datasource.groupby_column_names]),
        'granularity': TextField('Time Granularity', default="one day"),
        'since': TextField('Since', default="one day ago"),
        'until': TextField('Until', default="now"),
        'row_limit':
            SelectField(
                'Row limit', choices=[(s, s) for s in row_limits]),
        'limit':
            SelectField(
                'Series limit', choices=[(s, s) for s in series_limits]),
        'rolling_type': SelectField(
            'Rolling',
            choices=[(s, s) for s in ['mean', 'sum', 'std']]),
        'rolling_periods': TextField('Periods',),
        'series': SelectField('Series', choices=group_by_choices),
        'entity': SelectField('Entity', choices=group_by_choices),
        'x': SelectField('X Axis', choices=datasource.metrics_combo),
        'y': SelectField('Y Axis', choices=datasource.metrics_combo),
        'size': SelectField('Bubble Size', choices=datasource.metrics_combo),
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
        field_order = viz.form_fields
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
    return QueryForm
