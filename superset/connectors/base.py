import json

from superset import utils


class Datasource(object):

    """A common interface to objects that are queryable (tables and datasources)"""

    # Used to do code highlighting when displaying the query in the UI
    query_language = None

    @property
    def column_names(self):
        return sorted([c.column_name for c in self.columns])

    @property
    def main_dttm_col(self):
        return "timestamp"

    @property
    def groupby_column_names(self):
        return sorted([c.column_name for c in self.columns if c.groupby])

    @property
    def filterable_column_names(self):
        return sorted([c.column_name for c in self.columns if c.filterable])

    @property
    def dttm_cols(self):
        return []

    @property
    def url(self):
        return '/{}/edit/{}'.format(self.baselink, self.id)

    @property
    def explore_url(self):
        if self.default_endpoint:
            return self.default_endpoint
        else:
            return "/superset/explore/{obj.type}/{obj.id}/".format(obj=self)

    @property
    def column_formats(self):
        return {
            m.metric_name: m.d3format
            for m in self.metrics
            if m.d3format
        }

    @property
    def data(self):
        """data representation of the datasource sent to the frontend"""
        order_by_choices = []
        for s in sorted(self.column_names):
            order_by_choices.append((json.dumps([s, True]), s + ' [asc]'))
            order_by_choices.append((json.dumps([s, False]), s + ' [desc]'))

        d = {
            'all_cols': utils.choicify(self.column_names),
            'column_formats': self.column_formats,
            'edit_url' : self.url,
            'filter_select': self.filter_select_enabled,
            'filterable_cols': utils.choicify(self.filterable_column_names),
            'gb_cols': utils.choicify(self.groupby_column_names),
            'id': self.id,
            'metrics_combo': self.metrics_combo,
            'name': self.name,
            'order_by_choices': order_by_choices,
            'type': self.type,
        }
        if self.type == 'table':
            grains = self.database.grains() or []
            if grains:
                grains = [(g.name, g.name) for g in grains]
            d['granularity_sqla'] = utils.choicify(self.dttm_cols)
            d['time_grain_sqla'] = grains
        return d


