from flask_babel import lazy_gettext
from ..filters import BaseFilter, FilterRelation, BaseFilterConverter


__all__ = ['GenericFilterConverter', 'FilterNotContains', 'FilterEqual', 'FilterContains', 'FilterIContains',
           'FilterNotEqual', 'FilterGreater', 'FilterSmaller', 'FilterStartsWith']


class FilterContains(BaseFilter):
    name = lazy_gettext('Contains')

    def apply(self, query, value):
        return query.like(self.column_name, value)

class FilterIContains(BaseFilter):
    '''
    case insensitive like
    '''
    name = lazy_gettext('Contains (insensitive)')

    def apply(self, query, value):
        return query.ilike(self.column_name, value)

class FilterNotContains(BaseFilter):
    name = lazy_gettext('Not Contains')

    def apply(self, query, value):
        return query.not_like(self.column_name, value)

class FilterEqual(BaseFilter):
    name = lazy_gettext('Equal to')

    def apply(self, query, value):
        return query.equal(self.column_name, value)

class FilterNotEqual(BaseFilter):
    name = lazy_gettext('Not Equal to')

    def apply(self, query, value):
        return query.not_equal(self.column_name, value)

class FilterGreater(BaseFilter):
    name = lazy_gettext('Greater than')

    def apply(self, query, value):
        return query.greater(self.column_name, value)

class FilterSmaller(BaseFilter):
    name = lazy_gettext('Smaller than')

    def apply(self, query, value):
        return query.smaller(self.column_name, value)

class FilterStartsWith(BaseFilter):
    name = lazy_gettext('Start with')

    def apply(self, query, value):
        return query.starts_with(self.column_name, value)

class GenericFilterConverter(BaseFilterConverter):
    """
        Class for converting columns into a supported list of filters
        specific for SQLAlchemy.

    """
    conversion_table = (('is_text', [FilterContains,
                                     FilterIContains,
                                     FilterNotContains,
                                     FilterEqual,
                                     FilterNotEqual,
                                     FilterStartsWith]
                                     ),
                        ('is_string', [FilterContains,
                                       FilterIContains,
                                       FilterNotContains,
                                       FilterEqual,
                                       FilterNotEqual,
                                       FilterStartsWith]),
                        ('is_integer', [FilterEqual,
                                        FilterNotEqual,
                                        FilterGreater,
                                        FilterSmaller]),
                        ('is_date', [FilterEqual,
                                        FilterNotEqual,
                                        FilterGreater,
                                        FilterSmaller]),
                        )
