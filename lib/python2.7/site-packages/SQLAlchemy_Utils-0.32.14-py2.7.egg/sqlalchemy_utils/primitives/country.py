import six

from .. import i18n
from ..utils import str_coercible


@str_coercible
class Country(object):
    """
    Country class wraps a 2 to 3 letter country code. It provides various
    convenience properties and methods.

    ::

        from babel import Locale
        from sqlalchemy_utils import Country, i18n


        # First lets add a locale getter for testing purposes
        i18n.get_locale = lambda: Locale('en')


        Country('FI').name  # Finland
        Country('FI').code  # FI

        Country(Country('FI')).code  # 'FI'

    Country always validates the given code.

    ::

        Country(None)  # raises TypeError

        Country('UnknownCode')  # raises ValueError


    Country supports equality operators.

    ::

        Country('FI') == Country('FI')
        Country('FI') != Country('US')


    Country objects are hashable.


    ::

        assert hash(Country('FI')) == hash('FI')

    """
    def __init__(self, code_or_country):
        if isinstance(code_or_country, Country):
            self.code = code_or_country.code
        elif isinstance(code_or_country, six.string_types):
            self.validate(code_or_country)
            self.code = code_or_country
        else:
            raise TypeError(
                "Country() argument must be a string or a country, not '{0}'"
                .format(
                    type(code_or_country).__name__
                )
            )

    @property
    def name(self):
        return i18n.get_locale().territories[self.code]

    @classmethod
    def validate(self, code):
        try:
            i18n.babel.Locale('en').territories[code]
        except KeyError:
            raise ValueError(
                'Could not convert string to country code: {0}'.format(code)
            )

    def __eq__(self, other):
        if isinstance(other, Country):
            return self.code == other.code
        elif isinstance(other, six.string_types):
            return self.code == other
        else:
            return NotImplemented

    def __hash__(self):
        return hash(self.code)

    def __ne__(self, other):
        return not (self == other)

    def __repr__(self):
        return '%s(%r)' % (self.__class__.__name__, self.code)

    def __unicode__(self):
        return self.name
