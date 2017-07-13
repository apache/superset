import logging, sys
from flask import flash
from . import filters
from ..base import BaseInterface
from ..._compat import as_unicode
from ...const import LOGMSG_ERR_DBI_ADD_GENERIC, LOGMSG_ERR_DBI_EDIT_GENERIC, LOGMSG_ERR_DBI_DEL_GENERIC, \
                     LOGMSG_WAR_DBI_ADD_INTEGRITY, LOGMSG_WAR_DBI_EDIT_INTEGRITY, LOGMSG_WAR_DBI_DEL_INTEGRITY
from mongoengine.fields import StringField, IntField, BooleanField, FloatField, \
    DateTimeField, ReferenceField, ListField, FileField, ImageField, ObjectIdField

log = logging.getLogger(__name__)


def _include_filters(obj):
    for key in filters.__all__:
        if not hasattr(obj, key):
            setattr(obj, key, getattr(filters, key))


class MongoEngineInterface(BaseInterface):

    filter_converter_class = filters.MongoEngineFilterConverter

    def __init__(self, obj, session=None):
        self.session = session
        _include_filters(self)
        super(MongoEngineInterface, self).__init__(obj)

    @property
    def model_name(self):
        """
            Returns the models class name
            useful for auto title on views
        """
        return self.obj.__name__

    def query(self, filters=None, order_column='', order_direction='',
              page=None, page_size=None):

        # base query : all objects
        objs = self.obj.objects

        # apply filters first if given
        if filters:
            objs = filters.apply_all(objs)

        # get the count of all items, either filtered or unfiltered
        count = objs.count()

        # order the data
        if order_column != '':
            if hasattr(getattr(self.obj, order_column), '_col_name'):
                order_column = getattr(getattr(self.obj, order_column),'_col_name')
            if order_direction == 'asc':
                objs = objs.order_by('-{0}'.format(order_column))
            else:
                objs = objs.order_by('+{0}'.format(order_column))

        if page_size is None: # error checking and warnings
            if page is not None:
                log.error('Attempting to get page %s but page_size is undefined' % page)
            if count > 100:
                log.warn('Retrieving %s %s items from DB' % (count, str(self.obj)))
        else: # get data segment for paginated page
            offset = (page or 0) * page_size
            objs = objs[offset : offset + page_size]

        return count, objs

    def is_object_id(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], ObjectIdField)
        except:
            return False

    def is_string(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], StringField)
        except:
            return False

    def is_integer(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], IntField)
        except:
            return False

    def is_float(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], FloatField)
        except:
            return False

    def is_boolean(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], BooleanField)
        except:
            return False

    def is_datetime(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], DateTimeField)
        except:
            return False

    def is_gridfs_file(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], FileField)
        except:
            return False

    def is_gridfs_image(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], ImageField)
        except:
            return False

    def is_relation(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], ReferenceField) or \
                    isinstance(self.obj._fields[col_name], ListField)
        except:
            return False

    def is_relation_many_to_one(self, col_name):
        try:
            return isinstance(self.obj._fields[col_name], ReferenceField)
        except:
            return False

    def is_relation_many_to_many(self, col_name):
        try:
            field = self.obj._fields[col_name]
            return isinstance(field, ListField) and isinstance(field.field, ReferenceField)
        except:
            return False

    def is_relation_one_to_one(self, col_name):
        return False

    def is_relation_one_to_many(self, col_name):
        return False

    def is_nullable(self, col_name):
        return not self.obj._fields[col_name].required

    def is_unique(self, col_name):
        return self.obj._fields[col_name].unique

    def is_pk(self, col_name):
        return col_name == 'id'

    def get_max_length(self, col_name):
        try:
            col = self.obj._fields[col_name]
            if col.max_length:
                return col.max_length
            else:
                return -1
        except:
                return -1

    def get_min_length(self, col_name):
        try:
            col = self.obj._fields[col_name]
            if col.min_length:
                return col.min_length
            else:
                return -1
        except:
                return -1

    def add(self, item):
        try:
            item.save()
            self.message = (as_unicode(self.add_row_message), 'success')
            return True
        except Exception as e:
            self.message = (as_unicode(self.general_error_message + ' ' + str(sys.exc_info()[0])), 'danger')
            log.exception(LOGMSG_ERR_DBI_ADD_GENERIC.format(str(e)))
            return False

    def edit(self, item):
        try:
            item.save()
            self.message = (as_unicode(self.edit_row_message), 'success')
            return True
        except Exception as e:
            self.message = (as_unicode(self.general_error_message + ' ' + str(sys.exc_info()[0])), 'danger')
            log.exception(LOGMSG_ERR_DBI_EDIT_GENERIC.format(str(e)))
            return False

    def delete(self, item):
        try:
            item.delete()
            self.message = (as_unicode(self.delete_row_message), 'success')
            return True
        except Exception as e:
            self.message = (as_unicode(self.general_error_message + ' ' + str(sys.exc_info()[0])), 'danger')
            log.exception(LOGMSG_ERR_DBI_DEL_GENERIC.format(str(e)))
            return False

    def get_columns_list(self):
        """
        modified: removing the '_cls' column added by Mongoengine to support mongodb document inheritance
        cf. http://docs.mongoengine.org/apireference.html#documents:
        "A Document subclass may be itself subclassed, to create a specialised version of the document that will be
        stored in the same collection. To facilitate this behaviour a _cls field is added to documents (hidden though
        the MongoEngine interface). To disable this behaviour and remove the dependence on the presence of _cls set
        allow_inheritance to False in the meta dictionary."
        """
        columns = list(self.obj._fields.keys())
        if '_cls' in columns:
            columns.remove('_cls')
        return columns

    def get_search_columns_list(self):
        ret_lst = list()
        for col_name in self.get_columns_list():
            for conversion in self.filter_converter_class.conversion_table:
                if getattr(self, conversion[0])(col_name) and not self.is_object_id(col_name):
                    ret_lst.append(col_name)
        return ret_lst

    def get_user_columns_list(self):
        """
            Returns all model's columns except pk
        """
        return [col_name for col_name in self.get_columns_list() if not self.is_pk(col_name)]

    def get_order_columns_list(self, list_columns=None):
        """
            Returns the columns that can be ordered

            :param list_columns: optional list of columns name, if provided will
                use this list only.
        """
        ret_lst = list()
        list_columns = list_columns or self.get_columns_list()
        for col_name in list_columns:
            if hasattr(self.obj, col_name):
                if not hasattr(getattr(self.obj, col_name), '__call__'):
                    ret_lst.append(col_name)
            else:
                ret_lst.append(col_name)
        return ret_lst

    def get_related_model(self, col_name):
        field = self.obj._fields[col_name]
        if isinstance(field, ListField):
            return field.field.document_type
        else:
            return field.document_type

    def get_related_interface(self, col_name):
        return self.__class__(self.get_related_model(col_name))

    def get_related_obj(self, col_name, value):
        rel_model = self.get_related_model(col_name)
        return rel_model.objects(pk=value)[0]

    def get_keys(self, lst):
        """
            return a list of pk values from object list
        """
        pk_name = self.get_pk_name()
        return [getattr(item, pk_name) for item in lst]

    def get_related_fk(self, model):
        for col_name in self.get_columns_list():
            if self.is_relation(col_name):
                if model == self.get_related_model(col_name):
                    return col_name

    def get_pk_name(self):
        return 'id'

    def get(self, id, filters=None):
        if filters:
            objs = self.obj.objects
            objs = filters.apply_all(objs)
            return objs(pk=id).first()

        return self.obj.objects(pk=id).first()
