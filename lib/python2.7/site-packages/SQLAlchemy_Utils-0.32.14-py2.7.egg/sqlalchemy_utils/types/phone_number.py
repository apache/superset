import six
from sqlalchemy import exc, types

from ..exceptions import ImproperlyConfigured
from ..utils import str_coercible
from .scalar_coercible import ScalarCoercible

try:
    import phonenumbers
    from phonenumbers.phonenumber import PhoneNumber as BasePhoneNumber
    from phonenumbers.phonenumberutil import NumberParseException
except ImportError:
    phonenumbers = None
    BasePhoneNumber = object
    NumberParseException = Exception


class PhoneNumberParseException(NumberParseException, exc.DontWrapMixin):
    '''
    Wraps exceptions from phonenumbers with SQLAlchemy's DontWrapMixin
    so we get more meaningful exceptions on validation failure instead of the
    StatementException

    Clients can catch this as either a PhoneNumberParseException or
    NumberParseException from the phonenumbers library.
    '''
    pass


@str_coercible
class PhoneNumber(BasePhoneNumber):
    '''
    Extends a PhoneNumber class from `Python phonenumbers library`_. Adds
    different phone number formats to attributes, so they can be easily used
    in templates. Phone number validation method is also implemented.

    Takes the raw phone number and country code as params and parses them
    into a PhoneNumber object.

    .. _Python phonenumbers library:
       https://github.com/daviddrysdale/python-phonenumbers


    ::

        from sqlalchemy_utils import PhoneNumber


        class User(self.Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, autoincrement=True, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            _phone_number = sa.Column(sa.Unicode(20))
            country_code = sa.Column(sa.Unicode(8))

            phonenumber = sa.orm.composite(
                PhoneNumber,
                _phone_number,
                country_code
            )


        user = User(phone_number=PhoneNumber('0401234567', 'FI'))

        user.phone_number.e164  # u'+358401234567'
        user.phone_number.international  # u'+358 40 1234567'
        user.phone_number.national  # u'040 1234567'
        user.country_code  # 'FI'


    :param raw_number:
        String representation of the phone number.
    :param region:
        Region of the phone number.
    '''
    def __init__(self, raw_number, region=None):
        # Bail if phonenumbers is not found.
        if phonenumbers is None:
            raise ImproperlyConfigured(
                "'phonenumbers' is required to use 'PhoneNumber'"
            )

        try:
            self._phone_number = phonenumbers.parse(raw_number, region)
        except NumberParseException as e:
            # Wrap exception so SQLAlchemy doesn't swallow it as a
            # StatementError
            #
            # Worth noting that if -1 shows up as the error_type
            # it's likely because the API has changed upstream and these
            # bindings need to be updated.
            raise PhoneNumberParseException(
                getattr(e, 'error_type', -1),
                six.text_type(e)
            )

        super(PhoneNumber, self).__init__(
            country_code=self._phone_number.country_code,
            national_number=self._phone_number.national_number,
            extension=self._phone_number.extension,
            italian_leading_zero=self._phone_number.italian_leading_zero,
            raw_input=self._phone_number.raw_input,
            country_code_source=self._phone_number.country_code_source,
            preferred_domestic_carrier_code=(
                self._phone_number.preferred_domestic_carrier_code
            )
        )
        self.region = region
        self.national = phonenumbers.format_number(
            self._phone_number,
            phonenumbers.PhoneNumberFormat.NATIONAL
        )
        self.international = phonenumbers.format_number(
            self._phone_number,
            phonenumbers.PhoneNumberFormat.INTERNATIONAL
        )
        self.e164 = phonenumbers.format_number(
            self._phone_number,
            phonenumbers.PhoneNumberFormat.E164
        )

    def __composite_values__(self):
        return self.national, self.region

    def is_valid_number(self):
        return phonenumbers.is_valid_number(self._phone_number)

    def __unicode__(self):
        return self.national


class PhoneNumberType(types.TypeDecorator, ScalarCoercible):
    """
    Changes PhoneNumber objects to a string representation on the way in and
    changes them back to PhoneNumber objects on the way out. If E164 is used
    as storing format, no country code is needed for parsing the database
    value to PhoneNumber object.

    ::

        class User(self.Base):
            __tablename__ = 'user'
            id = sa.Column(sa.Integer, autoincrement=True, primary_key=True)
            name = sa.Column(sa.Unicode(255))
            phone_number = sa.Column(PhoneNumberType())


        user = User(phone_number='+358401234567')

        user.phone_number.e164  # u'+358401234567'
        user.phone_number.international  # u'+358 40 1234567'
        user.phone_number.national  # u'040 1234567'
    """
    STORE_FORMAT = 'e164'
    impl = types.Unicode(20)
    python_type = PhoneNumber

    def __init__(self, region='US', max_length=20, *args, **kwargs):
        # Bail if phonenumbers is not found.
        if phonenumbers is None:
            raise ImproperlyConfigured(
                "'phonenumbers' is required to use 'PhoneNumberType'"
            )

        super(PhoneNumberType, self).__init__(*args, **kwargs)
        self.region = region
        self.impl = types.Unicode(max_length)

    def process_bind_param(self, value, dialect):
        if value:
            if not isinstance(value, PhoneNumber):
                value = PhoneNumber(value, region=self.region)

            if self.STORE_FORMAT == 'e164' and value.extension:
                return '%s;ext=%s' % (value.e164, value.extension)

            return getattr(value, self.STORE_FORMAT)

        return value

    def process_result_value(self, value, dialect):
        if value:
            return PhoneNumber(value, self.region)
        return value

    def _coerce(self, value):
        if value and not isinstance(value, PhoneNumber):
            value = PhoneNumber(value, region=self.region)

        return value or None
