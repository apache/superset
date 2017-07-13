import six
from sqlalchemy import types

from ..primitives import Country
from .scalar_coercible import ScalarCoercible


class CountryType(types.TypeDecorator, ScalarCoercible):
    """
    Changes :class:`.Country` objects to a string representation on the way in
    and changes them back to :class:`.Country objects on the way out.

    In order to use CountryType you need to install Babel_ first.

    .. _Babel: http://babel.pocoo.org/

    ::


        from sqlalchemy_utils import CountryType, Country


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, autoincrement=True)
            name = sa.Column(sa.Unicode(255))
            country = sa.Column(CountryType)


        user = User()
        user.country = Country('FI')
        session.add(user)
        session.commit()

        user.country  # Country('FI')
        user.country.name  # Finland

        print user.country  # Finland


    CountryType is scalar coercible::


        user.country = 'US'
        user.country  # Country('US')
    """
    impl = types.String(2)
    python_type = Country

    def process_bind_param(self, value, dialect):
        if isinstance(value, Country):
            return value.code

        if isinstance(value, six.string_types):
            return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return Country(value)

    def _coerce(self, value):
        if value is not None and not isinstance(value, Country):
            return Country(value)
        return value
