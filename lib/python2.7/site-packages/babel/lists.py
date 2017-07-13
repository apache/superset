# -*- coding: utf-8 -*-
"""
    babel.lists
    ~~~~~~~~~~~

    Locale dependent formatting of lists.

    The default locale for the functions in this module is determined by the
    following environment variables, in that order:

     * ``LC_ALL``, and
     * ``LANG``

    :copyright: (c) 2015 by the Babel Team.
    :license: BSD, see LICENSE for more details.
"""

from babel.core import Locale, default_locale

DEFAULT_LOCALE = default_locale()


def format_list(lst, locale=DEFAULT_LOCALE):
    """
    Format the items in `lst` as a list.

    >>> format_list(['apples', 'oranges', 'pears'], 'en')
    u'apples, oranges, and pears'
    >>> format_list(['apples', 'oranges', 'pears'], 'zh')
    u'apples\u3001oranges\u548cpears'

    :param lst: a sequence of items to format in to a list
    :param locale: the locale
    """
    locale = Locale.parse(locale)
    if not lst:
        return ''
    if len(lst) == 1:
        return lst[0]
    if len(lst) == 2:
        return locale.list_patterns['2'].format(*lst)

    result = locale.list_patterns['start'].format(lst[0], lst[1])
    for elem in lst[2:-1]:
        result = locale.list_patterns['middle'].format(result, elem)
    result = locale.list_patterns['end'].format(result, lst[-1])

    return result
