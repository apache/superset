import six
from sqlalchemy import types

from .. import i18n
from ..exceptions import ImproperlyConfigured
from ..primitives import WeekDay, WeekDays
from .bit import BitType
from .scalar_coercible import ScalarCoercible


class WeekDaysType(types.TypeDecorator, ScalarCoercible):
    """
    WeekDaysType offers way of saving WeekDays objects into database. The
    WeekDays objects are converted to bit strings on the way in and back to
    WeekDays objects on the way out.

    In order to use WeekDaysType you need to install Babel_ first.

    .. _Babel: http://babel.pocoo.org/

    ::


        from sqlalchemy_utils import WeekDaysType, WeekDays
        from babel import Locale


        class Schedule(Base):
            __tablename__ = 'schedule'
            id = sa.Column(sa.Integer, autoincrement=True)
            working_days = sa.Column(WeekDaysType)


        schedule = Schedule()
        schedule.working_days = WeekDays('0001111')
        session.add(schedule)
        session.commit()

        print schedule.working_days  # Thursday, Friday, Saturday, Sunday


    WeekDaysType also supports scalar coercion:

    ::


        schedule.working_days = '1110000'
        schedule.working_days  # WeekDays object

    """

    impl = BitType(WeekDay.NUM_WEEK_DAYS)

    def __init__(self, *args, **kwargs):
        if i18n.babel is None:
            raise ImproperlyConfigured(
                "'babel' package is required to use 'WeekDaysType'"
            )

        super(WeekDaysType, self).__init__(*args, **kwargs)

    @property
    def comparator_factory(self):
        return self.impl.comparator_factory

    def process_bind_param(self, value, dialect):
        if isinstance(value, WeekDays):
            value = value.as_bit_string()

        if dialect.name == 'mysql':
            func = bytes if six.PY3 else bytearray
            return func(value, 'utf8')
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return WeekDays(value)

    def _coerce(self, value):
        if value is not None and not isinstance(value, WeekDays):
            return WeekDays(value)
        return value
