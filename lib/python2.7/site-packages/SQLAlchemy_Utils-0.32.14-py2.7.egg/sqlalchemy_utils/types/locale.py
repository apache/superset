import six
from sqlalchemy import types

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible

babel = None
try:
    import babel
except ImportError:
    pass


class LocaleType(types.TypeDecorator, ScalarCoercible):
    """
    LocaleType saves Babel_ Locale objects into database. The Locale objects
    are converted to string on the way in and back to object on the way out.

    In order to use LocaleType you need to install Babel_ first.

    .. _Babel: http://babel.pocoo.org/

    ::


        from sqlalchemy_utils import LocaleType
        from babel import Locale


        class User(Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, autoincrement=True)
            name = sa.Column(sa.Unicode(50))
            locale = sa.Column(LocaleType)


        user = User()
        user.locale = Locale('en_US')
        session.add(user)
        session.commit()


    Like many other types this type also supports scalar coercion:

    ::


        user.locale = 'de_DE'
        user.locale  # Locale('de', territory='DE')

    """

    impl = types.Unicode(10)

    def __init__(self):
        if babel is None:
            raise ImproperlyConfigured(
                'Babel packaged is required with LocaleType.'
            )

    def process_bind_param(self, value, dialect):
        if isinstance(value, babel.Locale):
            return six.text_type(value)

        if isinstance(value, six.string_types):
            return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return babel.Locale.parse(value)

    def _coerce(self, value):
        if value is not None and not isinstance(value, babel.Locale):
            return babel.Locale.parse(value)
        return value
