from . import filters
from ..base import BaseInterface


def _include_filters(obj):
    for key in filters.__all__:
        if not hasattr(obj, key):
            setattr(obj, key, getattr(filters, key))


class GenericInterface(BaseInterface):

    filter_converter_class = filters.GenericFilterConverter

    def __init__(self, obj, session=None):
        _include_filters(self)
        self.session = session
        super(GenericInterface, self).__init__(obj)


    def query(self, filters=None, order_column='', order_direction='',
              page=None, page_size=None):

        query = self.session.query(self.obj)
        if filters:
            query = filters.apply_all(query)
        if order_column != '':
            query = query.order_by(order_column + ' ' + order_direction)
        if page:
            query = query.offset(page * page_size)
        if page_size:
            query = query.limit(page_size)
        return query.all()

    def is_string(self, col_name):
        return self.obj.properties[col_name].col_type == str

    def is_integer(self, col_name):
        return self.obj.properties[col_name].col_type == int

    def is_nullable(self, col_name):
        return self.obj.properties[col_name].nullable

    def is_unique(self, col_name):
        return self.obj.properties[col_name].unique

    def is_pk(self, col_name):
        return self.obj.properties[col_name].primary_key

    def get_columns_list(self):
        return self.obj.columns

    def get_search_columns_list(self):
        return self.obj.columns

    def get_order_columns_list(self, list_columns=None):
        if list_columns:
            return list_columns
        return self.obj.columns

    def get_keys(self, lst):
        """
            return a list of pk values from object list
        """
        pk_name = self.get_pk_name()
        return [getattr(item, pk_name) for item in lst]

    def get_pk_name(self):
        for col_name in self.obj.columns:
            if self.is_pk(col_name):
                return col_name

    def get(self, id, filters=None):
        # TODO: need to implement filters!
        return self.session.get(id)
