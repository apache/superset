import six
from sqlalchemy import types

from ..exceptions import ImproperlyConfigured
from .scalar_coercible import ScalarCoercible


class TimezoneType(types.TypeDecorator, ScalarCoercible):
    """
    TimezoneType provides a way for saving timezones (from either the pytz or
    the dateutil package) objects into database. TimezoneType saves timezone
    objects as strings on the way in and converts them back to objects when
    querying the database.


    ::

        from sqlalchemy_utils import TimezoneType

        class User(Base):
            __tablename__ = 'user'

            # Pass backend='pytz' to change it to use pytz (dateutil by
            # default)
            timezone = sa.Column(TimezoneType(backend='pytz'))
    """

    impl = types.Unicode(50)

    python_type = None

    def __init__(self, backend='dateutil'):
        """
        :param backend: Whether to use 'dateutil' or 'pytz' for timezones.
        """

        self.backend = backend
        if backend == 'dateutil':
            try:
                from dateutil.tz import tzfile
                from dateutil.zoneinfo import gettz

                self.python_type = tzfile
                self._to = gettz
                self._from = lambda x: six.text_type(x._filename)

            except ImportError:
                raise ImproperlyConfigured(
                    "'python-dateutil' is required to use the "
                    "'dateutil' backend for 'TimezoneType'"
                )

        elif backend == 'pytz':
            try:
                from pytz import timezone
                from pytz.tzinfo import BaseTzInfo

                self.python_type = BaseTzInfo
                self._to = timezone
                self._from = six.text_type

            except ImportError:
                raise ImproperlyConfigured(
                    "'pytz' is required to use the 'pytz' backend "
                    "for 'TimezoneType'"
                )

        else:
            raise ImproperlyConfigured(
                "'pytz' or 'dateutil' are the backends supported for "
                "'TimezoneType'"
            )

    def _coerce(self, value):
        if value is not None and not isinstance(value, self.python_type):
            obj = self._to(value)
            if obj is None:
                raise ValueError("unknown time zone '%s'" % value)
            return obj
        return value

    def process_bind_param(self, value, dialect):
        return self._from(self._coerce(value)) if value else None

    def process_result_value(self, value, dialect):
        return self._to(value) if value else None
