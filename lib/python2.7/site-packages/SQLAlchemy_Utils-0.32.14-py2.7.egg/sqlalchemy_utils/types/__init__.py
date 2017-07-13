from functools import wraps

from sqlalchemy.orm.collections import InstrumentedList as _InstrumentedList

from .arrow import ArrowType  # noqa
from .choice import Choice, ChoiceType  # noqa
from .color import ColorType  # noqa
from .country import CountryType  # noqa
from .currency import CurrencyType  # noqa
from .email import EmailType  # noqa
from .encrypted import EncryptedType  # noqa
from .ip_address import IPAddressType  # noqa
from .json import JSONType  # noqa
from .locale import LocaleType  # noqa
from .ltree import LtreeType  # noqa
from .password import Password, PasswordType  # noqa
from .pg_composite import (  # noqa
    CompositeArray,
    CompositeType,
    register_composites,
    remove_composite_listeners
)
from .phone_number import (  # noqa
    PhoneNumber,
    PhoneNumberParseException,
    PhoneNumberType
)
from .range import (  # noqa
    DateRangeType,
    DateTimeRangeType,
    IntRangeType,
    NumericRangeType
)
from .scalar_list import ScalarListException, ScalarListType  # noqa
from .timezone import TimezoneType  # noqa
from .ts_vector import TSVectorType  # noqa
from .url import URLType  # noqa
from .uuid import UUIDType  # noqa
from .weekdays import WeekDaysType  # noqa


class InstrumentedList(_InstrumentedList):
    """Enhanced version of SQLAlchemy InstrumentedList. Provides some
    additional functionality."""

    def any(self, attr):
        return any(getattr(item, attr) for item in self)

    def all(self, attr):
        return all(getattr(item, attr) for item in self)


def instrumented_list(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        return InstrumentedList([item for item in f(*args, **kwargs)])
    return wrapper
