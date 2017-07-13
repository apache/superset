# -*- coding: utf-8 -*-
"""
    celery.utils.text
    ~~~~~~~~~~~~~~~~~

    Text formatting utilities

"""
from __future__ import absolute_import

from textwrap import fill

from pprint import pformat

__all__ = ['dedent_initial', 'dedent', 'fill_paragraphs', 'join',
           'ensure_2lines', 'abbr', 'abbrtask', 'indent', 'truncate',
           'pluralize', 'pretty']


def dedent_initial(s, n=4):
    return s[n:] if s[:n] == ' ' * n else s


def dedent(s, n=4, sep='\n'):
    return sep.join(dedent_initial(l) for l in s.splitlines())


def fill_paragraphs(s, width, sep='\n'):
    return sep.join(fill(p, width) for p in s.split(sep))


def join(l, sep='\n'):
    return sep.join(v for v in l if v)


def ensure_2lines(s, sep='\n'):
    if len(s.splitlines()) <= 2:
        return s + sep
    return s


def abbr(S, max, ellipsis='...'):
    if S is None:
        return '???'
    if len(S) > max:
        return ellipsis and (S[:max - len(ellipsis)] + ellipsis) or S[:max]
    return S


def abbrtask(S, max):
    if S is None:
        return '???'
    if len(S) > max:
        module, _, cls = S.rpartition('.')
        module = abbr(module, max - len(cls) - 3, False)
        return module + '[.]' + cls
    return S


def indent(t, indent=0, sep='\n'):
    """Indent text."""
    return sep.join(' ' * indent + p for p in t.split(sep))


def truncate(text, maxlen=128, suffix='...'):
    """Truncates text to a maximum number of characters."""
    if len(text) >= maxlen:
        return text[:maxlen].rsplit(' ', 1)[0] + suffix
    return text


def pluralize(n, text, suffix='s'):
    if n > 1:
        return text + suffix
    return text


def pretty(value, width=80, nl_width=80, sep='\n', **kw):
    if isinstance(value, dict):
        return '{{{0} {1}'.format(sep, pformat(value, 4, nl_width)[1:])
    elif isinstance(value, tuple):
        return '{0}{1}{2}'.format(
            sep, ' ' * 4, pformat(value, width=nl_width, **kw),
        )
    else:
        return pformat(value, width=width, **kw)
