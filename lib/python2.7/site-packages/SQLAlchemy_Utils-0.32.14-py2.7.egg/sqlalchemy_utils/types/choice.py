import six
from sqlalchemy import types

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible

try:
    from enum import Enum
except ImportError:
    Enum = None


class Choice(object):
    def __init__(self, code, value):
        self.code = code
        self.value = value

    def __eq__(self, other):
        if isinstance(other, Choice):
            return self.code == other.code
        return other == self.code

    def __ne__(self, other):
        return not (self == other)

    def __unicode__(self):
        return six.text_type(self.value)

    def __repr__(self):
        return 'Choice(code={code}, value={value})'.format(
            code=self.code,
            value=self.value
        )


class ChoiceType(types.TypeDecorator, ScalarCoercible):
    """
    ChoiceType offers way of having fixed set of choices for given column. It
    could work with a list of tuple (a collection of key-value pairs), or
    integrate with :mod:`enum` in the standard library of Python 3.4+ (the
    enum34_ backported package on PyPI is compatible too for ``< 3.4``).

    .. _enum34: https://pypi.python.org/pypi/enum34

    Columns with ChoiceTypes are automatically coerced to Choice objects while
    a list of tuple been passed to the constructor. If a subclass of
    :class:`enum.Enum` is passed, columns will be coerced to :class:`enum.Enum`
    objects instead.

    ::

        class User(Base):
            TYPES = [
                (u'admin', u'Admin'),
                (u'regular-user', u'Regular user')
            ]

            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            type = sa.Column(ChoiceType(TYPES))


        user = User(type=u'admin')
        user.type  # Choice(type='admin', value=u'Admin')

    Or::

        import enum


        class UserType(enum.Enum):
            admin = 1
            regular = 2


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            type = sa.Column(ChoiceType(UserType, impl=sa.Integer()))


        user = User(type=1)
        user.type  # <UserType.admin: 1>


    ChoiceType is very useful when the rendered values change based on user's
    locale:

    ::

        from babel import lazy_gettext as _


        class User(Base):
            TYPES = [
                (u'admin', _(u'Admin')),
                (u'regular-user', _(u'Regular user'))
            ]

            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            type = sa.Column(ChoiceType(TYPES))


        user = User(type=u'admin')
        user.type  # Choice(type='admin', value=u'Admin')

        print user.type  # u'Admin'

    Or::

        from enum import Enum
        from babel import lazy_gettext as _


        class UserType(Enum):
            admin = 1
            regular = 2


        UserType.admin.label = _(u'Admin')
        UserType.regular.label = _(u'Regular user')


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            type = sa.Column(ChoiceType(UserType, impl=sa.Integer()))


        user = User(type=UserType.admin)
        user.type  # <UserType.admin: 1>

        print user.type.label  # u'Admin'
    """

    impl = types.Unicode(255)

    def __init__(self, choices, impl=None):
        self.choices = choices

        if (
            Enum is not None and
            isinstance(choices, type) and
            issubclass(choices, Enum)
        ):
            self.type_impl = EnumTypeImpl(enum_class=choices)
        else:
            self.type_impl = ChoiceTypeImpl(choices=choices)

        if impl:
            self.impl = impl

    @property
    def python_type(self):
        return self.impl.python_type

    def _coerce(self, value):
        return self.type_impl._coerce(value)

    def process_bind_param(self, value, dialect):
        return self.type_impl.process_bind_param(value, dialect)

    def process_result_value(self, value, dialect):
        return self.type_impl.process_result_value(value, dialect)


class ChoiceTypeImpl(object):
    """The implementation for the ``Choice`` usage."""

    def __init__(self, choices):
        if not choices:
            raise ImproperlyConfigured(
                'ChoiceType needs list of choices defined.'
            )
        self.choices_dict = dict(choices)

    def _coerce(self, value):
        if value is None:
            return value
        if isinstance(value, Choice):
            return value
        return Choice(value, self.choices_dict[value])

    def process_bind_param(self, value, dialect):
        if value and isinstance(value, Choice):
            return value.code
        return value

    def process_result_value(self, value, dialect):
        if value:
            return Choice(value, self.choices_dict[value])
        return value


class EnumTypeImpl(object):
    """The implementation for the ``Enum`` usage."""

    def __init__(self, enum_class):
        if Enum is None:
            raise ImproperlyConfigured(
                "'enum34' package is required to use 'EnumType' in Python "
                "< 3.4"
            )
        if not issubclass(enum_class, Enum):
            raise ImproperlyConfigured(
                "EnumType needs a class of enum defined."
            )

        self.enum_class = enum_class

    def _coerce(self, value):
        if value is None:
            return None
        return self.enum_class(value)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self.enum_class(value).value

    def process_result_value(self, value, dialect):
        return self._coerce(value)
