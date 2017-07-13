# -*- coding: utf-8 -*-
"""
    babel.numbers
    ~~~~~~~~~~~~~

    Locale dependent formatting and parsing of numeric data.

    The default locale for the functions in this module is determined by the
    following environment variables, in that order:

     * ``LC_NUMERIC``,
     * ``LC_ALL``, and
     * ``LANG``

    :copyright: (c) 2013 by the Babel Team.
    :license: BSD, see LICENSE for more details.
"""
# TODO:
#  Padding and rounding increments in pattern:
#  - http://www.unicode.org/reports/tr35/ (Appendix G.6)
import re
from datetime import date as date_, datetime as datetime_

from babel.core import default_locale, Locale, get_global
from babel._compat import decimal


LC_NUMERIC = default_locale('LC_NUMERIC')


def get_currency_name(currency, count=None, locale=LC_NUMERIC):
    """Return the name used by the locale for the specified currency.

    >>> get_currency_name('USD', locale='en_US')
    u'US Dollar'

    .. versionadded:: 0.9.4

    :param currency: the currency code
    :param count: the optional count.  If provided the currency name
                  will be pluralized to that number if possible.
    :param locale: the `Locale` object or locale identifier
    """
    loc = Locale.parse(locale)
    if count is not None:
        plural_form = loc.plural_form(count)
        plural_names = loc._data['currency_names_plural']
        if currency in plural_names:
            return plural_names[currency][plural_form]
    return loc.currencies.get(currency, currency)


def get_currency_symbol(currency, locale=LC_NUMERIC):
    """Return the symbol used by the locale for the specified currency.

    >>> get_currency_symbol('USD', locale='en_US')
    u'$'

    :param currency: the currency code
    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).currency_symbols.get(currency, currency)


def get_territory_currencies(territory, start_date=None, end_date=None,
                             tender=True, non_tender=False,
                             include_details=False):
    """Returns the list of currencies for the given territory that are valid for
    the given date range.  In addition to that the currency database
    distinguishes between tender and non-tender currencies.  By default only
    tender currencies are returned.

    The return value is a list of all currencies roughly ordered by the time
    of when the currency became active.  The longer the currency is being in
    use the more to the left of the list it will be.

    The start date defaults to today.  If no end date is given it will be the
    same as the start date.  Otherwise a range can be defined.  For instance
    this can be used to find the currencies in use in Austria between 1995 and
    2011:

    >>> from datetime import date
    >>> get_territory_currencies('AT', date(1995, 1, 1), date(2011, 1, 1))
    ['ATS', 'EUR']

    Likewise it's also possible to find all the currencies in use on a
    single date:

    >>> get_territory_currencies('AT', date(1995, 1, 1))
    ['ATS']
    >>> get_territory_currencies('AT', date(2011, 1, 1))
    ['EUR']

    By default the return value only includes tender currencies.  This
    however can be changed:

    >>> get_territory_currencies('US')
    ['USD']
    >>> get_territory_currencies('US', tender=False, non_tender=True,
    ...                          start_date=date(2014, 1, 1))
    ['USN', 'USS']

    .. versionadded:: 2.0

    :param territory: the name of the territory to find the currency fo
    :param start_date: the start date.  If not given today is assumed.
    :param end_date: the end date.  If not given the start date is assumed.
    :param tender: controls whether tender currencies should be included.
    :param non_tender: controls whether non-tender currencies should be
                       included.
    :param include_details: if set to `True`, instead of returning currency
                            codes the return value will be dictionaries
                            with detail information.  In that case each
                            dictionary will have the keys ``'currency'``,
                            ``'from'``, ``'to'``, and ``'tender'``.
    """
    currencies = get_global('territory_currencies')
    if start_date is None:
        start_date = date_.today()
    elif isinstance(start_date, datetime_):
        start_date = start_date.date()
    if end_date is None:
        end_date = start_date
    elif isinstance(end_date, datetime_):
        end_date = end_date.date()

    curs = currencies.get(territory.upper(), ())
    # TODO: validate that the territory exists

    def _is_active(start, end):
        return (start is None or start <= end_date) and \
               (end is None or end >= start_date)

    result = []
    for currency_code, start, end, is_tender in curs:
        if start:
            start = date_(*start)
        if end:
            end = date_(*end)
        if ((is_tender and tender) or
                (not is_tender and non_tender)) and _is_active(start, end):
            if include_details:
                result.append({
                    'currency': currency_code,
                    'from': start,
                    'to': end,
                    'tender': is_tender,
                })
            else:
                result.append(currency_code)

    return result


def get_decimal_symbol(locale=LC_NUMERIC):
    """Return the symbol used by the locale to separate decimal fractions.

    >>> get_decimal_symbol('en_US')
    u'.'

    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).number_symbols.get('decimal', u'.')


def get_plus_sign_symbol(locale=LC_NUMERIC):
    """Return the plus sign symbol used by the current locale.

    >>> get_plus_sign_symbol('en_US')
    u'+'

    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).number_symbols.get('plusSign', u'+')


def get_minus_sign_symbol(locale=LC_NUMERIC):
    """Return the plus sign symbol used by the current locale.

    >>> get_minus_sign_symbol('en_US')
    u'-'

    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).number_symbols.get('minusSign', u'-')


def get_exponential_symbol(locale=LC_NUMERIC):
    """Return the symbol used by the locale to separate mantissa and exponent.

    >>> get_exponential_symbol('en_US')
    u'E'

    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).number_symbols.get('exponential', u'E')


def get_group_symbol(locale=LC_NUMERIC):
    """Return the symbol used by the locale to separate groups of thousands.

    >>> get_group_symbol('en_US')
    u','

    :param locale: the `Locale` object or locale identifier
    """
    return Locale.parse(locale).number_symbols.get('group', u',')


def format_number(number, locale=LC_NUMERIC):
    u"""Return the given number formatted for a specific locale.

    >>> format_number(1099, locale='en_US')
    u'1,099'
    >>> format_number(1099, locale='de_DE')
    u'1.099'


    :param number: the number to format
    :param locale: the `Locale` object or locale identifier
    """
    # Do we really need this one?
    return format_decimal(number, locale=locale)


def format_decimal(number, format=None, locale=LC_NUMERIC):
    u"""Return the given decimal number formatted for a specific locale.

    >>> format_decimal(1.2345, locale='en_US')
    u'1.234'
    >>> format_decimal(1.2346, locale='en_US')
    u'1.235'
    >>> format_decimal(-1.2346, locale='en_US')
    u'-1.235'
    >>> format_decimal(1.2345, locale='sv_SE')
    u'1,234'
    >>> format_decimal(1.2345, locale='de')
    u'1,234'

    The appropriate thousands grouping and the decimal separator are used for
    each locale:

    >>> format_decimal(12345.5, locale='en_US')
    u'12,345.5'

    :param number: the number to format
    :param format:
    :param locale: the `Locale` object or locale identifier
    """
    locale = Locale.parse(locale)
    if not format:
        format = locale.decimal_formats.get(format)
    pattern = parse_pattern(format)
    return pattern.apply(number, locale)


class UnknownCurrencyFormatError(KeyError):
    """Exception raised when an unknown currency format is requested."""


def format_currency(number, currency, format=None, locale=LC_NUMERIC,
                    currency_digits=True, format_type='standard'):
    u"""Return formatted currency value.

    >>> format_currency(1099.98, 'USD', locale='en_US')
    u'$1,099.98'
    >>> format_currency(1099.98, 'USD', locale='es_CO')
    u'US$\\xa01.099,98'
    >>> format_currency(1099.98, 'EUR', locale='de_DE')
    u'1.099,98\\xa0\\u20ac'

    The format can also be specified explicitly.  The currency is
    placed with the '¤' sign.  As the sign gets repeated the format
    expands (¤ being the symbol, ¤¤ is the currency abbreviation and
    ¤¤¤ is the full name of the currency):

    >>> format_currency(1099.98, 'EUR', u'\xa4\xa4 #,##0.00', locale='en_US')
    u'EUR 1,099.98'
    >>> format_currency(1099.98, 'EUR', u'#,##0.00 \xa4\xa4\xa4', locale='en_US')
    u'1,099.98 euros'

    Currencies usually have a specific number of decimal digits. This function
    favours that information over the given format:

    >>> format_currency(1099.98, 'JPY', locale='en_US')
    u'\\xa51,100'
    >>> format_currency(1099.98, 'COP', u'#,##0.00', locale='es_ES')
    u'1.100'

    However, the number of decimal digits can be overriden from the currency
    information, by setting the last parameter to ``False``:

    >>> format_currency(1099.98, 'JPY', locale='en_US', currency_digits=False)
    u'\\xa51,099.98'
    >>> format_currency(1099.98, 'COP', u'#,##0.00', locale='es_ES', currency_digits=False)
    u'1.099,98'

    If a format is not specified the type of currency format to use
    from the locale can be specified:

    >>> format_currency(1099.98, 'EUR', locale='en_US', format_type='standard')
    u'\\u20ac1,099.98'

    When the given currency format type is not available, an exception is
    raised:

    >>> format_currency('1099.98', 'EUR', locale='root', format_type='unknown')
    Traceback (most recent call last):
        ...
    UnknownCurrencyFormatError: "'unknown' is not a known currency format type"

    :param number: the number to format
    :param currency: the currency code
    :param format: the format string to use
    :param locale: the `Locale` object or locale identifier
    :param currency_digits: use the currency's number of decimal digits
    :param format_type: the currency format type to use
    """
    locale = Locale.parse(locale)
    if format:
        pattern = parse_pattern(format)
    else:
        try:
            pattern = locale.currency_formats[format_type]
        except KeyError:
            raise UnknownCurrencyFormatError("%r is not a known currency format"
                                             " type" % format_type)
    if currency_digits:
        fractions = get_global('currency_fractions')
        try:
            digits = fractions[currency][0]
        except KeyError:
            digits = fractions['DEFAULT'][0]
        frac = (digits, digits)
    else:
        frac = None
    return pattern.apply(number, locale, currency=currency, force_frac=frac)


def format_percent(number, format=None, locale=LC_NUMERIC):
    """Return formatted percent value for a specific locale.

    >>> format_percent(0.34, locale='en_US')
    u'34%'
    >>> format_percent(25.1234, locale='en_US')
    u'2,512%'
    >>> format_percent(25.1234, locale='sv_SE')
    u'2\\xa0512\\xa0%'

    The format pattern can also be specified explicitly:

    >>> format_percent(25.1234, u'#,##0\u2030', locale='en_US')
    u'25,123\u2030'

    :param number: the percent number to format
    :param format:
    :param locale: the `Locale` object or locale identifier
    """
    locale = Locale.parse(locale)
    if not format:
        format = locale.percent_formats.get(format)
    pattern = parse_pattern(format)
    return pattern.apply(number, locale)


def format_scientific(number, format=None, locale=LC_NUMERIC):
    """Return value formatted in scientific notation for a specific locale.

    >>> format_scientific(10000, locale='en_US')
    u'1E4'

    The format pattern can also be specified explicitly:

    >>> format_scientific(1234567, u'##0E00', locale='en_US')
    u'1.23E06'

    :param number: the number to format
    :param format:
    :param locale: the `Locale` object or locale identifier
    """
    locale = Locale.parse(locale)
    if not format:
        format = locale.scientific_formats.get(format)
    pattern = parse_pattern(format)
    return pattern.apply(number, locale)


class NumberFormatError(ValueError):
    """Exception raised when a string cannot be parsed into a number."""


def parse_number(string, locale=LC_NUMERIC):
    """Parse localized number string into an integer.

    >>> parse_number('1,099', locale='en_US')
    1099
    >>> parse_number('1.099', locale='de_DE')
    1099

    When the given string cannot be parsed, an exception is raised:

    >>> parse_number('1.099,98', locale='de')
    Traceback (most recent call last):
        ...
    NumberFormatError: '1.099,98' is not a valid number

    :param string: the string to parse
    :param locale: the `Locale` object or locale identifier
    :return: the parsed number
    :raise `NumberFormatError`: if the string can not be converted to a number
    """
    try:
        return int(string.replace(get_group_symbol(locale), ''))
    except ValueError:
        raise NumberFormatError('%r is not a valid number' % string)


def parse_decimal(string, locale=LC_NUMERIC):
    """Parse localized decimal string into a decimal.

    >>> parse_decimal('1,099.98', locale='en_US')
    Decimal('1099.98')
    >>> parse_decimal('1.099,98', locale='de')
    Decimal('1099.98')

    When the given string cannot be parsed, an exception is raised:

    >>> parse_decimal('2,109,998', locale='de')
    Traceback (most recent call last):
        ...
    NumberFormatError: '2,109,998' is not a valid decimal number

    :param string: the string to parse
    :param locale: the `Locale` object or locale identifier
    :raise NumberFormatError: if the string can not be converted to a
                              decimal number
    """
    locale = Locale.parse(locale)
    try:
        return decimal.Decimal(string.replace(get_group_symbol(locale), '')
                               .replace(get_decimal_symbol(locale), '.'))
    except decimal.InvalidOperation:
        raise NumberFormatError('%r is not a valid decimal number' % string)


PREFIX_END = r'[^0-9@#.,]'
NUMBER_TOKEN = r'[0-9@#.,E+]'

PREFIX_PATTERN = r"(?P<prefix>(?:'[^']*'|%s)*)" % PREFIX_END
NUMBER_PATTERN = r"(?P<number>%s+)" % NUMBER_TOKEN
SUFFIX_PATTERN = r"(?P<suffix>.*)"

number_re = re.compile(r"%s%s%s" % (PREFIX_PATTERN, NUMBER_PATTERN,
                                    SUFFIX_PATTERN))


def parse_grouping(p):
    """Parse primary and secondary digit grouping

    >>> parse_grouping('##')
    (1000, 1000)
    >>> parse_grouping('#,###')
    (3, 3)
    >>> parse_grouping('#,####,###')
    (3, 4)
    """
    width = len(p)
    g1 = p.rfind(',')
    if g1 == -1:
        return 1000, 1000
    g1 = width - g1 - 1
    g2 = p[:-g1 - 1].rfind(',')
    if g2 == -1:
        return g1, g1
    g2 = width - g1 - g2 - 2
    return g1, g2


def parse_pattern(pattern):
    """Parse number format patterns"""
    if isinstance(pattern, NumberPattern):
        return pattern

    def _match_number(pattern):
        rv = number_re.search(pattern)
        if rv is None:
            raise ValueError('Invalid number pattern %r' % pattern)
        return rv.groups()

    pos_pattern = pattern

    # Do we have a negative subpattern?
    if ';' in pattern:
        pos_pattern, neg_pattern = pattern.split(';', 1)
        pos_prefix, number, pos_suffix = _match_number(pos_pattern)
        neg_prefix, _, neg_suffix = _match_number(neg_pattern)
    else:
        pos_prefix, number, pos_suffix = _match_number(pos_pattern)
        neg_prefix = '-' + pos_prefix
        neg_suffix = pos_suffix
    if 'E' in number:
        number, exp = number.split('E', 1)
    else:
        exp = None
    if '@' in number:
        if '.' in number and '0' in number:
            raise ValueError('Significant digit patterns can not contain '
                             '"@" or "0"')
    if '.' in number:
        integer, fraction = number.rsplit('.', 1)
    else:
        integer = number
        fraction = ''

    def parse_precision(p):
        """Calculate the min and max allowed digits"""
        min = max = 0
        for c in p:
            if c in '@0':
                min += 1
                max += 1
            elif c == '#':
                max += 1
            elif c == ',':
                continue
            else:
                break
        return min, max

    int_prec = parse_precision(integer)
    frac_prec = parse_precision(fraction)
    if exp:
        frac_prec = parse_precision(integer + fraction)
        exp_plus = exp.startswith('+')
        exp = exp.lstrip('+')
        exp_prec = parse_precision(exp)
    else:
        exp_plus = None
        exp_prec = None
    grouping = parse_grouping(integer)
    return NumberPattern(pattern, (pos_prefix, neg_prefix),
                         (pos_suffix, neg_suffix), grouping,
                         int_prec, frac_prec,
                         exp_prec, exp_plus)


class NumberPattern(object):

    def __init__(self, pattern, prefix, suffix, grouping,
                 int_prec, frac_prec, exp_prec, exp_plus):
        self.pattern = pattern
        self.prefix = prefix
        self.suffix = suffix
        self.grouping = grouping
        self.int_prec = int_prec
        self.frac_prec = frac_prec
        self.exp_prec = exp_prec
        self.exp_plus = exp_plus
        if '%' in ''.join(self.prefix + self.suffix):
            self.scale = 2
        elif u'‰' in ''.join(self.prefix + self.suffix):
            self.scale = 3
        else:
            self.scale = 0

    def __repr__(self):
        return '<%s %r>' % (type(self).__name__, self.pattern)

    def apply(self, value, locale, currency=None, force_frac=None):
        frac_prec = force_frac or self.frac_prec
        if not isinstance(value, decimal.Decimal):
            value = decimal.Decimal(str(value))
        value = value.scaleb(self.scale)
        is_negative = int(value.is_signed())
        if self.exp_prec:  # Scientific notation
            exp = value.adjusted()
            value = abs(value)
            # Minimum number of integer digits
            if self.int_prec[0] == self.int_prec[1]:
                exp -= self.int_prec[0] - 1
            # Exponent grouping
            elif self.int_prec[1]:
                exp = int(exp / self.int_prec[1]) * self.int_prec[1]
            if exp < 0:
                value = value * 10**(-exp)
            else:
                value = value / 10**exp
            exp_sign = ''
            if exp < 0:
                exp_sign = get_minus_sign_symbol(locale)
            elif self.exp_plus:
                exp_sign = get_plus_sign_symbol(locale)
            exp = abs(exp)
            number = u'%s%s%s%s' % \
                (self._format_significant(value, frac_prec[0], frac_prec[1]),
                 get_exponential_symbol(locale), exp_sign,
                 self._format_int(str(exp), self.exp_prec[0],
                                  self.exp_prec[1], locale))
        elif '@' in self.pattern:  # Is it a siginificant digits pattern?
            text = self._format_significant(abs(value),
                                            self.int_prec[0],
                                            self.int_prec[1])
            a, sep, b = text.partition(".")
            number = self._format_int(a, 0, 1000, locale)
            if sep:
                number += get_decimal_symbol(locale) + b
        else:  # A normal number pattern
            precision = decimal.Decimal('1.' + '1' * frac_prec[1])
            rounded = value.quantize(precision)
            a, sep, b = str(abs(rounded)).partition(".")
            number = (self._format_int(a, self.int_prec[0],
                                       self.int_prec[1], locale) +
                      self._format_frac(b or '0', locale, force_frac))
        retval = u'%s%s%s' % (self.prefix[is_negative], number,
                              self.suffix[is_negative])
        if u'¤' in retval:
            retval = retval.replace(u'¤¤¤',
                                    get_currency_name(currency, value, locale))
            retval = retval.replace(u'¤¤', currency.upper())
            retval = retval.replace(u'¤', get_currency_symbol(currency, locale))
        return retval

    #
    # This is one tricky piece of code.  The idea is to rely as much as possible
    # on the decimal module to minimize the amount of code.
    #
    # Conceptually, the implementation of this method can be summarized in the
    # following steps:
    #
    #   - Move or shift the decimal point (i.e. the exponent) so the maximum
    #     amount of significant digits fall into the integer part (i.e. to the
    #     left of the decimal point)
    #
    #   - Round the number to the nearest integer, discarding all the fractional
    #     part which contained extra digits to be eliminated
    #
    #   - Convert the rounded integer to a string, that will contain the final
    #     sequence of significant digits already trimmed to the maximum
    #
    #   - Restore the original position of the decimal point, potentially
    #     padding with zeroes on either side
    #
    def _format_significant(self, value, minimum, maximum):
        exp = value.adjusted()
        scale = maximum - 1 - exp
        digits = str(value.scaleb(scale).quantize(decimal.Decimal(1)))
        if scale <= 0:
            result = digits + '0' * -scale
        else:
            intpart = digits[:-scale]
            i = len(intpart)
            j = i + max(minimum - i, 0)
            result = "{intpart}.{pad:0<{fill}}{fracpart}{fracextra}".format(
                intpart=intpart or '0',
                pad='',
                fill=-min(exp + 1, 0),
                fracpart=digits[i:j],
                fracextra=digits[j:].rstrip('0'),
            ).rstrip('.')
        return result

    def _format_int(self, value, min, max, locale):
        width = len(value)
        if width < min:
            value = '0' * (min - width) + value
        gsize = self.grouping[0]
        ret = ''
        symbol = get_group_symbol(locale)
        while len(value) > gsize:
            ret = symbol + value[-gsize:] + ret
            value = value[:-gsize]
            gsize = self.grouping[1]
        return value + ret

    def _format_frac(self, value, locale, force_frac=None):
        min, max = force_frac or self.frac_prec
        if len(value) < min:
            value += ('0' * (min - len(value)))
        if max == 0 or (min == 0 and int(value) == 0):
            return ''
        while len(value) > min and value[-1] == '0':
            value = value[:-1]
        return get_decimal_symbol(locale) + value
