import logging
from flask_babel import lazy_gettext
from ..filters import BaseFilter, FilterRelation, BaseFilterConverter

log = logging.getLogger(__name__)

__all__ = ['MongoEngineFilterConverter', 'FilterEqual', 'FilterContains', 'FilterNotContains',
           'FilterNotStartsWith', 'FilterStartsWith', 'FilterRelationOneToManyEqual', 'FilterRelationManyToManyEqual']


class FilterEqual(BaseFilter):
    name = lazy_gettext('Equal to')

    def apply(self, query, value):
        if self.datamodel.is_boolean(self.column_name):
            if value == 'y':
                value = True
        flt = {'%s' % self.column_name: value}
        return query.filter(**flt)


class FilterNotEqual(BaseFilter):
    name = lazy_gettext('Not Equal to')

    def apply(self, query, value):
        if self.datamodel.is_boolean(self.column_name):
            if value == 'y':
                value = True
        flt = {'%s__ne' % self.column_name: value}
        return query.filter(**flt)


class FilterGreater(BaseFilter):
    name = lazy_gettext('Greater than')

    def apply(self, query, value):
        flt = {'%s__gt' % self.column_name: value}
        return query.filter(**flt)


class FilterSmaller(BaseFilter):
    name = lazy_gettext('Smaller than')

    def apply(self, query, value):
        flt = {'%s__lt' % self.column_name: value}
        return query.filter(**flt)


class FilterStartsWith(BaseFilter):
    name = lazy_gettext('Starts with')

    def apply(self, query, value):
        flt = {'%s__%s' % (self.column_name, 'startswith'): value}
        return query.filter(**flt)


class FilterNotStartsWith(BaseFilter):
    name = lazy_gettext('Not Starts with')

    def apply(self, query, value):
        flt = {'%s__not__%s' % (self.column_name, 'startswith'): value}
        return query.filter(**flt)


class FilterContains(BaseFilter):
    name = lazy_gettext('Contains')

    def apply(self, query, value):
        flt = {'%s__%s' % (self.column_name, 'icontains'): value}
        return query.filter(**flt)


class FilterNotContains(BaseFilter):
    name = lazy_gettext('Not Contains')

    def apply(self, query, value):
        flt = {'%s__not__%s' % (self.column_name, 'icontains'): value}
        return query.filter(**flt)


class FilterRelationOneToManyEqual(FilterRelation):
    name = lazy_gettext('Relation')

    def apply(self, query, value):
        rel_obj = self.datamodel.get_related_obj(self.column_name, value)
        flt = {'%s' % self.column_name: rel_obj}
        return query.filter(**flt)


class FilterRelationManyToManyEqual(FilterRelation):
    name = lazy_gettext('Relation as Many')

    def apply(self, query, value):
        rel_obj = self.datamodel.get_related_obj(self.column_name, value)
        flt = {'%s__%s' % (self.column_name, 'icontains'): rel_obj}
        return query.filter(**flt)


class FilterEqualFunction(BaseFilter):
    name = "Filter view with a function"

    def apply(self, query, func):
        flt = {'%s' % self.column_name: func()}
        return query.filter(**flt)


class MongoEngineFilterConverter(BaseFilterConverter):
    """
        Class for converting columns into a supported list of filters
        specific for SQLAlchemy.

    """
    conversion_table = (('is_relation_many_to_one', [FilterRelationOneToManyEqual]),
                        ('is_relation_one_to_one', [FilterRelationOneToManyEqual]),
                        ('is_relation_many_to_many', [FilterRelationManyToManyEqual]),
                        ('is_relation_one_to_many', [FilterRelationManyToManyEqual]),
                        ('is_object_id', [FilterEqual]),
                        ('is_string', [FilterEqual,
                                       FilterNotEqual,
                                       FilterStartsWith,
                                       FilterNotStartsWith,
                                       FilterContains,
                                       FilterNotContains]),
                        ('is_boolean', [FilterEqual,
                                        FilterNotEqual]),
                        ('is_datetime', [FilterEqual,
                                         FilterNotEqual,
                                         FilterGreater,
                                         FilterSmaller]),
                        ('is_integer', [FilterEqual,
                                         FilterNotEqual,
                                         FilterGreater,
                                         FilterSmaller]),
                        ('is_float', [FilterEqual,
                                         FilterNotEqual,
                                         FilterGreater,
                                         FilterSmaller]))
