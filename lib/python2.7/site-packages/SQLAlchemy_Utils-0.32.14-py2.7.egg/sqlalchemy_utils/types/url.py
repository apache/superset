import six
from sqlalchemy import types

from .scalar_coercible import ScalarCoercible

furl = None
try:
    from furl import furl
except ImportError:
    pass


class URLType(types.TypeDecorator, ScalarCoercible):
    """
    URLType stores furl_ objects into database.

    .. _furl: https://github.com/gruns/furl

    ::

        from sqlalchemy_utils import URLType
        from furl import furl


        class User(Base):
            __tablename__ = 'user'

            id = sa.Column(sa.Integer, primary_key=True)
            website = sa.Column(URLType)


        user = User(website=u'www.example.com')

        # website is coerced to furl object, hence all nice furl operations
        # come available
        user.website.args['some_argument'] = '12'

        print user.website
        # www.example.com?some_argument=12
    """

    impl = types.UnicodeText

    def process_bind_param(self, value, dialect):
        if furl is not None and isinstance(value, furl):
            return six.text_type(value)

        if isinstance(value, six.string_types):
            return value

    def process_result_value(self, value, dialect):
        if furl is None:
            return value

        if value is not None:
            return furl(value)

    def _coerce(self, value):
        if furl is None:
            return value

        if value is not None and not isinstance(value, furl):
            return furl(value)
        return value

    @property
    def python_type(self):
        return self.impl.type.python_type
