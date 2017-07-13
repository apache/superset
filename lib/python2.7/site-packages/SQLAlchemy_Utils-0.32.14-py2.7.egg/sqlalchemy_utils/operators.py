import sqlalchemy as sa


def inspect_type(mixed):
    if isinstance(mixed, sa.orm.attributes.InstrumentedAttribute):
        return mixed.property.columns[0].type
    elif isinstance(mixed, sa.orm.ColumnProperty):
        return mixed.columns[0].type
    elif isinstance(mixed, sa.Column):
        return mixed.type


def is_case_insensitive(mixed):
    try:
        return isinstance(
            inspect_type(mixed).comparator,
            CaseInsensitiveComparator
        )
    except AttributeError:
        try:
            return issubclass(
                inspect_type(mixed).comparator_factory,
                CaseInsensitiveComparator
            )
        except AttributeError:
            return False


class CaseInsensitiveComparator(sa.Unicode.Comparator):
    @classmethod
    def lowercase_arg(cls, func):
        def operation(self, other, **kwargs):
            operator = getattr(sa.Unicode.Comparator, func)
            if other is None:
                return operator(self, other, **kwargs)
            if not is_case_insensitive(other):
                other = sa.func.lower(other)
            return operator(self, other, **kwargs)
        return operation

    def in_(self, other):
        if isinstance(other, list) or isinstance(other, tuple):
            other = map(sa.func.lower, other)
        return sa.Unicode.Comparator.in_(self, other)

    def notin_(self, other):
        if isinstance(other, list) or isinstance(other, tuple):
            other = map(sa.func.lower, other)
        return sa.Unicode.Comparator.notin_(self, other)


string_operator_funcs = [
    '__eq__',
    '__ne__',
    '__lt__',
    '__le__',
    '__gt__',
    '__ge__',
    'concat',
    'contains',
    'ilike',
    'like',
    'notlike',
    'notilike',
    'startswith',
    'endswith',
]

for func in string_operator_funcs:
    setattr(
        CaseInsensitiveComparator,
        func,
        CaseInsensitiveComparator.lowercase_arg(func)
    )
