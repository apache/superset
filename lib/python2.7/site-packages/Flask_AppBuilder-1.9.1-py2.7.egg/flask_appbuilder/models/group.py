from __future__ import unicode_literals
import datetime
import calendar
import logging
from itertools import groupby
from flask_babel import lazy_gettext as _
from flask_appbuilder._compat import as_unicode
from .. import const as c

log = logging.getLogger(__name__)

def aggregate(label=''):
    """
        Use this decorator to set a label for your aggregation functions on charts.

        :param label:
            The label to complement with the column
    """
    def wrap(f):
        f._label = label
        return f
    return wrap


@aggregate(_('Count of'))
def aggregate_count(items, col):
    """
        Function to use on Group by Charts.
        accepts a list and returns the count of the list's items
    """
    return len(list(items))


@aggregate(_('Sum of'))
def aggregate_sum(items, col):
    """
        Function to use on Group by Charts.
        accepts a list and returns the sum of the list's items
    """
    return sum(getattr(item, col) for item in items)

@aggregate(_('Avg. of'))
def aggregate_avg(items, col):
    """
        Function to use on Group by Charts.
        accepts a list and returns the average of the list's items
    """
    try:
        return aggregate_sum(items, col) / aggregate_count(items, col)
    except:
        log.warning(c.LOGMSG_WAR_DBI_AVG_ZERODIV)
        return 0.0


class BaseGroupBy(object):
    column_name = ''
    name = ''
    aggregate_func = None
    aggregate_col = ''

    def __init__(self, column_name, name, aggregate_func=aggregate_count, aggregate_col=''):
        """
            Constructor.

            :param column_name:
                Model field name
            :param name:
                The group by name

        """
        self.column_name = column_name
        self.name = name
        self.aggregate_func = aggregate_func
        self.aggregate_col = aggregate_col

    def apply(self, data):
        """
            Override this to implement you own new filters
        """
        pass

    def get_group_col(self, item):
        return getattr(item, self.column_name)

    def get_format_group_col(self, item):
        return (item)

    def get_aggregate_col_name(self):
        if self.aggregate_col:
            return self.aggregate_func.__name__ + '_' + self.aggregate_col
        else:
            return self.aggregate_func.__name__

    def __repr__(self):
        return self.name


class GroupByCol(BaseGroupBy):

    def _apply(self, data):
        data = sorted(data, key=self.get_group_col)
        json_data = dict()
        json_data['cols'] = [{'id': self.column_name,
                              'label': self.column_name,
                              'type': 'string'},
                             {'id': self.aggregate_func.__name__ + '_' + self.column_name,
                              'label': self.aggregate_func.__name__ + '_' + self.column_name,
                              'type': 'number'}]
        json_data['rows'] = []
        for (grouped, items) in groupby(data, self.get_group_col):
            aggregate_value = self.aggregate_func(items, self.aggregate_col)
            json_data['rows'].append(
                {"c": [{"v": self.get_format_group_col(grouped)}, {"v": aggregate_value}]})
        return json_data


    def apply(self, data):
        data = sorted(data, key=self.get_group_col)
        return [
            [self.get_format_group_col(grouped), self.aggregate_func(items, self.aggregate_col)]
            for (grouped, items) in groupby(data, self.get_group_col)
        ]


class GroupByDateYear(BaseGroupBy):
    def apply(self, data):
        data = sorted(data, key=self.get_group_col)
        return [
            [self.get_format_group_col(grouped), self.aggregate_func(items, self.aggregate_col)]
            for (grouped, items) in groupby(data, self.get_group_col)
        ]

    def get_group_col(self, item):
        value = getattr(item, self.column_name)
        if value:
            return value.year


class GroupByDateMonth(BaseGroupBy):
    def apply(self, data):
        data = sorted(data, key=self.get_group_col)
        return [
            [self.get_format_group_col(grouped), self.aggregate_func(items, self.aggregate_col)]
            for (grouped, items) in groupby(data, self.get_group_col)
            if grouped
        ]

    def get_group_col(self, item):
        value = getattr(item, self.column_name)
        if value:
            return value.year, value.month

    def get_format_group_col(self, item):
        return calendar.month_name[item[1]] + ' ' + str(item[0])


class BaseProcessData(object):
    """
        Base class to process data. It will group data by one or many columns or functions.
        The aggregation is made by an already defined function, or by a custom function

        :group_bys_cols: A list of columns or functions to group data.
        :aggr_by_cols: A list of tuples [(<AGGR FUNC>,'<COLNAME>'),...].
        :formatter_by_cols: A dict.
    """

    group_bys_cols = None
    # ['<COLNAME>',<FUNC>, ....]
    aggr_by_cols = None
    # [(<AGGR FUNC>,'<COLNAME>'),...]
    formatter_by_cols = {}
    # {<FUNC>: '<COLNAME>',...}

    def __init__(self, group_by_cols, aggr_by_cols, formatter_by_cols):
        self.group_bys_cols = group_by_cols
        self.aggr_by_cols = aggr_by_cols
        self.formatter_by_cols = formatter_by_cols

    def attrgetter(self, *items):
        if len(items) == 1:
            attr = items[0]

            def g(obj):
                return self.resolve_attr(obj, attr)
        else:
            def g(obj):
                return tuple(self.resolve_attr(obj, attr) for attr in items)
        return g

    def resolve_attr(self, obj, attr):
        if not hasattr(obj, attr):
            # it's an inner obj attr
            return reduce(getattr, attr.split('.'), obj)
        if hasattr(getattr(obj, attr), '__call__'):
            # its a function
            return getattr(obj, attr)()
        else:
            # it's an attribute
            return getattr(obj, attr)

    def format_columns(self, *values):
        if len(values) == 1:
            return self.format_column(self.group_bys_cols[0], values[0])
        else:
            return tuple(self.format_column(item, value) for item, value in (self.group_bys_cols, values))

    def format_column(self, item, value):
        if item in self.formatter_by_cols:
            return self.formatter_by_cols[item](value)
        else:
            return value

    def apply(self, data):
        pass

    def to_dict(self, data):
        ret = []
        for item in data:
            row = {}
            if not isinstance(item[0], tuple):
                row[self.group_bys_cols[0]] = str(item[0])
            else:
                for group_col_data, i in zip(item[0], enumerate(item[0])):
                    row[self.group_bys_cols[i]] = str(group_col_data)
            for col_data, i in zip(item[1:], enumerate(item[1:])):
                log.debug("{0},{1}".format(col_data, i))
                key = self.aggr_by_cols[i].__name__ + self.aggr_by_cols[i]
                if isinstance(col_data, datetime.date):
                    row[key] = str(col_data)
                else:
                    row[key] = col_data
            ret.append(row)
        return ret



    def to_json(self, data, labels=None):
        """
            Will return a dict with Google JSON structure for charts

            The Google structure::

                {
                    cols: [{id:<COL_NAME>, label:<LABEL FOR COL>, type: <COL TYPE>}, ...]
                    rows: [{c: [{v: <COL VALUE}, ...], ... ]
                }

            :param data:
            :param labels: dict with labels to include on Google JSON strcut
            :return: dict with Google JSON structure
        """
        labels = labels or dict()
        json_data = dict()
        json_data['cols'] = []
        # Create Structure to identify the grouped columns
        for group_col in self.group_bys_cols:
            label = '' or as_unicode(labels[group_col])
            json_data['cols'].append({'id': group_col,
                                      'label': label,
                                      'type': 'string'})
        # Create Structure to identify the Aggregated columns
        for aggr_col in self.aggr_by_cols:
            if isinstance(aggr_col, tuple):
                label_key = aggr_col[0].__name__ + aggr_col[1]
                aggr_col = aggr_col[1]
            else:
                label_key = aggr_col
            label = '' or as_unicode(labels[label_key])
            json_data['cols'].append({'id': aggr_col,
                                      'label': label,
                                      'type': 'number'})
        # Create Structure with the data
        json_data['rows'] = []
        for item in data:
            row = {'c': []}
            if not isinstance(item[0], tuple):
                row['c'].append({'v': '{0}'.format(item[0])})
            else:
                for group_col_data in item[0]:
                    row['c'].append({'v': '{0}'.format(group_col_data)})
            for col_data in item[1:]:
                if isinstance(col_data, datetime.date):
                    row['c'].append({'v': '{0}'.format(col_data)})
                else:
                    row['c'].append({'v': col_data})
            json_data['rows'].append(row)
        return json_data


class DirectProcessData(BaseProcessData):

    def apply(self, data, sort=True):
        group_by = self.group_bys_cols[0]
        if sort:
            data = sorted(data, key=self.attrgetter(group_by))
        result = []
        for item in data:
            result_item = [self.format_columns(self.attrgetter(group_by)(item))]
            for aggr_by_col in self.aggr_by_cols:
                result_item.append(self.attrgetter(aggr_by_col)(item))
            result.append(result_item)
        return result


class GroupByProcessData(BaseProcessData):
    """
        Groups by data by chosen columns (property group_bys_cols).

        :data: A list of objects
        :sort: boolean, if true python will sort the data
        :return: A List of lists with group column and aggregation
    """
    def apply(self, data, sort=True):
        if sort:
            data = sorted(data, key=self.attrgetter(*self.group_bys_cols))
        result = []
        for (grouped, items) in groupby(data, key=self.attrgetter(*self.group_bys_cols)):
            items = list(items)
            result_item = [self.format_columns(grouped)]
            for aggr_by_col in self.aggr_by_cols:
                result_item.append(aggr_by_col[0](items, aggr_by_col[1]))
            result.append(result_item)
        return result


