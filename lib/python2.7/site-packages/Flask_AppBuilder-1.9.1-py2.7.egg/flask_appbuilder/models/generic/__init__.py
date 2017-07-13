__author__ = 'dpgaspar'

import operator
import os
from ..._compat import with_metaclass
from datetime import date, datetime

#--------------------------------------
#        Exceptions
#--------------------------------------
class PKMissingException(Exception):
    def __init__(self, model_name=''):
        message = 'Please set one primary key on: {0}'.format(model_name)
        super(PKMissingException, self).__init__(self, message)


class GenericColumn(object):
    col_type = None
    primary_key = None
    unique = None
    nullable = None

    def __init__(self, col_type, primary_key=False, unique=False, nullable=False):
        self.col_type = col_type
        self.primary_key = primary_key
        self.unique = unique
        self.nullable = nullable

    def check_type(self, value):
        return isinstance(value, self.col_type)


class MetaGenericModel(type):
    """
        Meta class for GenericModel
        will change default properties:
        - instantiates internal '_col_defs' dict with
            all the defined columns.
        - Define pk property with the name of the primary key column
        - Define properties with a list of all column's properties
        - Define columns with a list of all column's name
    """

    pk = None
    properties = None
    columns = None

    def __new__(meta, name, bases, dct):
        obj = super(MetaGenericModel, meta).__new__(meta, name, bases, dct)
        obj._col_defs = dict()
        obj._name = name

        for prop in dct:
            if isinstance(dct[prop], GenericColumn):
                vol_col = dct[prop]
                obj._col_defs[prop] = vol_col
        obj.properties = obj._col_defs
        obj.columns = list(obj._col_defs.keys())
        for col in obj.columns:
            if obj._col_defs[col].primary_key:
                obj.pk = col
                break
        return obj


class GenericModel(with_metaclass(MetaGenericModel, object)):
    """
        Generic Model class to define generic purpose models to use
        with the framework.

        Use GenericSession much like SQLAlchemy's Session Class.
        Extend GenericSession to implement specific engine features.

        Define your models like::

            class MyGenericModel(GenericModel):
                id = GenericColumn(int, primary_key=True)
                age = GenericColumn(int)
                name = GenericColumn(str)

    """

    def __init__(self, **kwargs):
        if not self.pk:
            # if only one column, set it as pk
            if len(self.columns) == 1:
                self._col_defs[self.columns[0]].primary_key = True
            else:
                raise PKMissingException(self._name)
        for arg in kwargs:
            if arg in self._col_defs:
                value = kwargs.get(arg)
                setattr(self, arg, value)

    def get_col_type(self, col_name):
        return self._col_defs[col_name].col_type


    def __repr__(self):
        return str(self)

    def __str__(self):
        str = self.__class__.__name__ + '=('
        for col in self.columns:
            str += "{0}:{1};".format(col, getattr(self, col))
        str += ')\n'
        return str


class GenericSession(object):
    """
        This class is a base, you should subclass it
        to implement your own generic data source.

        Override at least the **all** method.

        **GenericSession** will implement filter and orders
        based on your data generation on the **all** method.
    """
    def __init__(self):
        self._order_by_cmd = None
        self._filters_cmd = list()
        self.store = dict()
        self.query_filters = list()
        self.query_class = ""
        self._offset = 0
        self._limit = 0

    def clear(self):
        """
            Deletes the entire store
        """
        self.store = dict()

    def delete_all(self, model_cls):
        """
            Deletes all objects of type model_cls
        """
        self.store[model_cls._name] = []

    def get(self, pk):
        """
            Returns the object for the key
            Override it for efficiency.
        """
        for item in self.store.get(self.query_class):
            # coverts pk value to correct type
            pk = item.properties[item.pk].col_type(pk)
            if getattr(item, item.pk) == pk:
                return item

    def query(self, model_cls):
        """
            SQLAlchemy query like method
        """
        self._filters_cmd = list()
        self.query_filters = list()
        self._order_by_cmd = None
        self._offset = 0
        self._limit = 0
        self.query_class = model_cls._name
        return self

    def order_by(self, order_cmd):
        self._order_by_cmd = order_cmd
        return self

    def _order_by(self, data, order_cmd):
        col_name, direction = order_cmd.split()
        reverse_flag = direction == 'desc'
        #patched as suggested by:
        #http://stackoverflow.com/questions/18411560/python-sort-list-with-none-at-the-end
        #and
        #http://stackoverflow.com/questions/5055942/sort-python-list-of-objects-by-date-when-some-are-none
        def col_name_if_not_none(data):
            '''
            - sqlite sets to null unfilled fields.
            - sqlalchemy cast this to None
            - this is a killer if the datum is of type datetime.date:
            - it breaks a simple key=operator.attrgetter(col_name)
            approach.

            this function tries to patch the issue
            '''
            op = operator.attrgetter(col_name)
            missing = (getattr(data,col_name) is not None)
            return (missing, getattr(data,col_name))

        return sorted(data, key=col_name_if_not_none, reverse=reverse_flag)

    def scalar(self):
        return 0

    #-----------------------------------------
    #           FUNCTIONS for FILTERS
    #-----------------------------------------

    def starts_with(self, col_name, value):
        self._filters_cmd.append((self._starts_with, col_name, value))
        return self

    def _starts_with(self, item, col_name, value):
        lw_col = getattr(item, col_name)
        try:
            lw_col = lw_col.lower()
        except:
            return None
        lw_value = value.lower()
        lw_value_list = lw_value.split(' ')

        for lw_item in lw_value_list:
            if not lw_col.startswith(lw_item):
                return None

        return col_name

    def greater(self, col_name, value):
        self._filters_cmd.append((self._greater, col_name, value))
        return self

    def _greater(self, item, col_name, value):
        source_value = getattr(item, col_name)

        try:
            #whatever we have to copare it will never match
            if source_value == None:
                return False

            #date has special constructor, tested only on sqlite
            elif isinstance(source_value, date):
                value = datetime.strptime(value, "%Y-%m-%d").date()

            #fallback to native python types
            else:            
                value = type(source_value)(value)

            return source_value > value
        except:
            #when everything fails silently report False
            return False

    def smaller(self, col_name, value):
        self._filters_cmd.append((self._smaller, col_name, value))
        return self

    def _smaller(self, item, col_name, value):
        source_value = getattr(item, col_name)

        try:
            #whatever we have to copare it will never match
            if source_value == None:
                return False

            #date has special constructor, tested only on sqlite
            elif isinstance(source_value, date):
                value = datetime.strptime(value, "%Y-%m-%d").date()

            #fallback to native python types
            else:            
                value = type(source_value)(value)

            return source_value < value
        except:
            #when everything fails silently report False
            return False

    def ilike(self, col_name, value):
        self._filters_cmd.append((self._ilike, col_name, value))
        return self

    def _ilike(self, item, col_name, value):
        lw_col = getattr(item, col_name)
        try:
            lw_col = lw_col.lower()
        except:
            return None
        lw_value = value.lower()
        lw_value_list = lw_value.split(' ')

        for lw_item in lw_value_list:
            if not lw_item in lw_col:
                return None

        return col_name

    def like(self, col_name, value):
        self._filters_cmd.append((self._like, col_name, value))
        return self

    def _like(self, item, col_name, value):
        lw_col = getattr(item, col_name)
        lw_value_list = value.split(' ')

        for lw_item in lw_value_list:
            if not lw_item in lw_col:
                return None

        return col_name

    def not_like(self, col_name, value):
        self._filters_cmd.append((self._not_like, col_name, value))
        return self

    def _not_like(self, item, col_name, value):
        return value not in getattr(item, col_name)

    def equal(self, col_name, value):
        self._filters_cmd.append((self._equal, col_name, value))
        return self

    def _equal(self, item, col_name, value):
        source_value = getattr(item, col_name)

        try:
            #whatever we have to copare it will never match
            if source_value == None:
                return False

            #date has special constructor, tested only on sqlite
            elif isinstance(source_value, date):
                value = datetime.strptime(value, "%Y-%m-%d").date()

            #fallback to native python types
            else:            
                value = type(source_value)(value)

            return source_value == value
        except:
            #when everything fails silently report False
            return False

    def not_equal(self, col_name, value):
        self._filters_cmd.append((self._not_equal, col_name, value))
        return self

    def _not_equal(self, item, col_name, value):
        return not self._equal(item, col_name, value)

    def offset(self, offset=0):
        self._offset = offset
        return self

    def limit(self, limit=0):
        self._limit = limit
        return self

    def all(self):
        """
            SQLA like 'all' method, will populate all rows and apply all
            filters and orders to it.
        """
        items = list()
        if not self._filters_cmd:
            items = self.store.get(self.query_class)
        else:
            for item in self.store.get(self.query_class):
                tmp_flag = True
                for filter_cmd in self._filters_cmd:
                    if not filter_cmd[0](item, filter_cmd[1], filter_cmd[2]):
                        tmp_flag = False
                        break
                if tmp_flag:
                    items.append(item)
        if self._order_by_cmd:
            items = self._order_by(items, self._order_by_cmd)
        total_length = len(items)
        if self._limit != 0:
            items = items[self._offset:self._offset + self._limit]
        return total_length, items

    def add(self, model):
        model_cls_name = model._name
        cls_list = self.store.get(model_cls_name)
        if not cls_list:
            self.store[model_cls_name] = []
        self.store[model_cls_name].append(model)


#-------------------------------------
#   Example of an Generic Data Source
#-------------------------------------
class PSModel(GenericModel):
    UID = GenericColumn(str)
    PID = GenericColumn(int, primary_key=True)
    PPID = GenericColumn(int)
    C = GenericColumn(int)
    STIME = GenericColumn(str)
    TTY = GenericColumn(str)
    TIME = GenericColumn(str)
    CMD = GenericColumn(str)


class PSSession(GenericSession):
    regexp = "(\w+) +(\w+) +(\w+) +(\w+) +(\w+:\w+|\w+) (\?|tty\w+) +(\w+:\w+:\w+) +(.+)\n"

    def add_object(self, line):
        import re

        group = re.findall(self.regexp, line)
        if group:
            model = PSModel()
            model.UID = group[0][0]
            model.PID = int(group[0][1])
            model.PPID = int(group[0][2])
            model.C = int(group[0][3])
            model.STIME = group[0][4]
            model.TTY = group[0][5]
            model.TIME = group[0][6]
            model.CMD = group[0][7]
            self.add(model)


    def get(self, pk):
        self.delete_all(PSModel())
        out = os.popen('ps -p {0} -f'.format(pk))
        for line in out.readlines():
            self.add_object(line)
        return super(PSSession, self).get(pk)


    def all(self):
        self.delete_all(PSModel())
        out = os.popen('ps -ef')
        for line in out.readlines():
            self.add_object(line)
        return super(PSSession, self).all()
