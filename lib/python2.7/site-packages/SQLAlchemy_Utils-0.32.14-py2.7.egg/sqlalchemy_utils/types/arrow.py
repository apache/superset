from __future__ import absolute_import

from collections import Iterable
from datetime import datetime

import six
from sqlalchemy import types

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible

arrow = None
try:
    import arrow
except:
    pass


class ArrowType(types.TypeDecorator, ScalarCoercible):
    """
    ArrowType provides way of saving Arrow_ objects into database. It
    automatically changes Arrow_ objects to datetime objects on the way in and
    datetime objects back to Arrow_ objects on the way out (when querying
    database). ArrowType needs Arrow_ library installed.

    .. _Arrow: http://crsmithdev.com/arrow/

    ::

        from datetime import datetime
        from sqlalchemy_utils import ArrowType
        import arrow


        class Article(Base):
            __tablename__ = 'article'
            id = sa.Column(sa.Integer, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            created_at = sa.Column(ArrowType)



        article = Article(created_at=arrow.utcnow())


    As you may expect all the arrow goodies come available:

    ::


        article.created_at = article.created_at.replace(hours=-1)

        article.created_at.humanize()
        # 'an hour ago'

    """
    impl = types.DateTime

    def __init__(self, *args, **kwargs):
        if not arrow:
            raise ImproperlyConfigured(
                "'arrow' package is required to use 'ArrowType'"
            )

        super(ArrowType, self).__init__(*args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value:
            utc_val = self._coerce(value).to('UTC')
            return utc_val.datetime if self.impl.timezone else utc_val.naive
        return value

    def process_result_value(self, value, dialect):
        if value:
            return arrow.get(value)
        return value

    def process_literal_param(self, value, dialect):
        return str(value)

    def _coerce(self, value):
        if value is None:
            return None
        elif isinstance(value, six.string_types):
            value = arrow.get(value)
        elif isinstance(value, Iterable):
            value = arrow.get(*value)
        elif isinstance(value, datetime):
            value = arrow.get(value)
        return value

    @property
    def python_type(self):
        return self.impl.type.python_type
