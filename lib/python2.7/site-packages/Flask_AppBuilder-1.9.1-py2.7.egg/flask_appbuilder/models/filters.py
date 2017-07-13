import logging
import copy
from .._compat import as_unicode

log = logging.getLogger(__name__)

class BaseFilter(object):
    """
        Base class for all data filters.
        Sub class to implement your own custom filters
    """
    column_name = ''
    datamodel = None
    model = None
    name = ''
    is_related_view = False
    """
        Sets this filter to a special kind for related views.
        If true this filter was not set by the user
    """

    def __init__(self, column_name, datamodel, is_related_view=False):
        """
            Constructor.

            :param column_name:
                Model field name
            :param datamodel:
                The datamodel access class
            :param is_related_view:
                Optional internal parameter to filter related views
        """
        self.column_name = column_name
        self.datamodel = datamodel
        self.model = datamodel.obj
        self.is_related_view = is_related_view

    def apply(self, query, value):
        """
            Override this to implement your own new filters
        """
        raise NotImplementedError

    def __repr__(self):
        return self.name


class FilterRelation(BaseFilter):
    """
        Base class for all filters for relations
    """
    pass


class BaseFilterConverter(object):
    """
        Base Filter Converter, all classes responsible
        for the association of columns and possible filters
        will inherit from this and override the conversion_table property.

    """
    conversion_table = ()
    """
        When implementing your own filters you just need to define
        the new filters, and register them overriding this property.
        This will map a column type to all possible filters.
        use something like this::

            (('is_text', [FilterCustomForText,
                                     FilterNotContains,
                                     FilterEqual,
                                     FilterNotEqual]
                                     ),
                        ('is_string', [FilterContains,
                                       FilterNotContains,
                                       FilterEqual,
                                       FilterNotEqual]),
                        ('is_integer', [FilterEqual,
                                        FilterNotEqual]),
                        )

    """

    def __init__(self, datamodel):
        self.datamodel = datamodel

    def convert(self, col_name):
        for conversion in self.conversion_table:
            if getattr(self.datamodel, conversion[0])(col_name):
                return [item(col_name, self.datamodel) for item in conversion[1]]
        log.warning('Filter type not supported for column: %s' % col_name)


class Filters(object):
    filters = []
    """ List of instanciated BaseFilter classes """
    values = []
    """ list of values to apply to filters """
    _search_filters = {}
    """ dict like {'col_name':[BaseFilter1, BaseFilter2, ...], ... } """
    _all_filters = {}

    def __init__(self, filter_converter, datamodel, search_columns=None):
        """

            :param filter_converter: Accepts BaseFilterConverter class
            :param search_columns: restricts possible columns, accepts a list of column names
            :param datamodel: Accepts BaseInterface class
        """
        search_columns = search_columns or []
        self.filter_converter = filter_converter
        self.datamodel = datamodel
        self.clear_filters()
        if search_columns:
            self._search_filters = self._get_filters(search_columns)
            self._all_filters = self._get_filters(datamodel.get_columns_list())

    def get_search_filters(self):
        return self._search_filters

    def _get_filters(self, cols):
        filters = {}
        for col in cols:
            _filters = self.filter_converter(self.datamodel).convert(col)
            if _filters:
                filters[col] = _filters
        return filters

    def clear_filters(self):
        self.filters = []
        self.values = []

    def _add_filter(self, filter_instance, value):
        self.filters.append(filter_instance)
        self.values.append(value)

    def add_filter_index(self, column_name, filter_instance_index, value):
        self._add_filter(self._all_filters[column_name][filter_instance_index], value)

    def add_filter(self, column_name, filter_class, value):
        self._add_filter(filter_class(column_name, self.datamodel), value)
        return self

    def add_filter_related_view(self, column_name, filter_class, value):
        self._add_filter(filter_class(column_name, self.datamodel, True), value)
        return self

    def add_filter_list(self, active_filter_list=None):
        for item in active_filter_list:
            column_name, filter_class, value = item
            self._add_filter(filter_class(column_name, self.datamodel), value)
        return self

    def get_joined_filters(self, filters):
        """
            Creates a new filters class with active filters joined
        """
        retfilters = Filters(self.filter_converter, self.datamodel)
        retfilters.filters = self.filters + filters.filters
        retfilters.values = self.values + filters.values
        return retfilters

    def copy(self):
        """
            Returns a copy of this object

            :return: A copy of self
        """
        retfilters = Filters(self.filter_converter, self.datamodel)
        retfilters.filters = copy.copy(self.filters)
        retfilters.values = copy.copy(self.values)
        return retfilters

    def get_relation_cols(self):
        """
            Returns the filter active FilterRelation cols
        """
        retlst = []
        for flt, value in zip(self.filters, self.values):
            if isinstance(flt, FilterRelation) and value:
                retlst.append(flt.column_name)
        return retlst

    def get_filters_values(self):
        """
            Returns a list of tuples [(FILTER, value),(...,...),....]
        """
        return [(flt, value) for flt, value in zip(self.filters, self.values)]

    def get_filter_value(self, column_name):
        """
            Returns the filtered value for a certain column

            :param column_name: The name of the column that we want the value from
            :return: the filter value of the column
        """
        for flt, value in zip(self.filters, self.values):
            if flt.column_name == column_name:
                return value

    def get_filters_values_tojson(self):
        return [(flt.column_name, as_unicode(flt.name), value) for flt, value in zip(self.filters, self.values)]

    def apply_all(self, query):
        for flt, value in zip(self.filters, self.values):
            query = flt.apply(query, value)
        return query

    def __repr__(self):
        retstr = "FILTERS \n"
        for flt, value in self.get_filters_values():
            retstr = retstr + "%s.%s:%s\n" % (flt.model.__table__, str(flt.column_name), str(value))
        return retstr
