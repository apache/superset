# -*- coding: utf-8 -*-
"""
    sphinx.locale
    ~~~~~~~~~~~~~

    Locale utilities.

    :copyright: Copyright 2007-2016 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import gettext

from six import PY3, text_type
from six.moves import UserString

if False:
    # For type annotation
    from typing import Any, Callable, Dict, Iterator, List, Tuple  # NOQA


class _TranslationProxy(UserString, object):
    """
    Class for proxy strings from gettext translations.  This is a helper for the
    lazy_* functions from this module.

    The proxy implementation attempts to be as complete as possible, so that
    the lazy objects should mostly work as expected, for example for sorting.

    This inherits from UserString because some docutils versions use UserString
    for their Text nodes, which then checks its argument for being either a
    basestring or UserString, otherwise calls str() -- not unicode() -- on it.
    This also inherits from object to make the __new__ method work.
    """
    __slots__ = ('_func', '_args')

    def __new__(cls, func, *args):
        # type: (Callable, unicode) -> object
        if not args:
            # not called with "function" and "arguments", but a plain string
            return text_type(func)
        return object.__new__(cls)  # type: ignore

    def __getnewargs__(self):
        # type: () -> Tuple
        return (self._func,) + self._args  # type: ignore

    def __init__(self, func, *args):
        # type: (Callable, unicode) -> None
        self._func = func
        self._args = args

    @property
    def data(self):
        # type: () -> unicode
        return self._func(*self._args)

    # replace function from UserString; it instantiates a self.__class__
    # for the encoding result

    def encode(self, encoding=None, errors=None):
        # type: (unicode, unicode) -> str
        if encoding:
            if errors:
                return self.data.encode(encoding, errors)
            else:
                return self.data.encode(encoding)
        else:
            return self.data.encode()

    def __contains__(self, key):
        # type: (Any) -> bool
        return key in self.data

    def __bool__(self):
        # type: () -> bool
        return bool(self.data)
    __nonzero__ = __bool__  # for python2 compatibility

    def __dir__(self):
        # type: () -> List[str]
        return dir(text_type)

    def __iter__(self):
        # type: () -> Iterator[unicode]
        return iter(self.data)

    def __len__(self):
        # type: () -> int
        return len(self.data)

    def __str__(self):
        # type: () -> str
        return str(self.data)

    def __unicode__(self):
        # type: () -> unicode
        return text_type(self.data)

    def __add__(self, other):
        # type: (unicode) -> unicode
        return self.data + other

    def __radd__(self, other):
        # type: (unicode) -> unicode
        return other + self.data

    def __mod__(self, other):
        # type: (unicode) -> unicode
        return self.data % other

    def __rmod__(self, other):
        # type: (unicode) -> unicode
        return other % self.data

    def __mul__(self, other):
        # type: (Any) -> unicode
        return self.data * other

    def __rmul__(self, other):
        # type: (Any) -> unicode
        return other * self.data

    def __lt__(self, other):
        # type: (unicode) -> bool
        return self.data < other

    def __le__(self, other):
        # type: (unicode) -> bool
        return self.data <= other

    def __eq__(self, other):
        # type: (Any) -> bool
        return self.data == other

    def __ne__(self, other):
        # type: (Any) -> bool
        return self.data != other

    def __gt__(self, other):
        # type: (unicode) -> bool
        return self.data > other

    def __ge__(self, other):
        # type: (unicode) -> bool
        return self.data >= other

    def __getattr__(self, name):
        # type: (unicode) -> Any
        if name == '__members__':
            return self.__dir__()
        return getattr(self.data, name)

    def __getstate__(self):
        # type: () -> Tuple[Callable, Tuple[unicode, ...]]
        return self._func, self._args

    def __setstate__(self, tup):
        # type: (Tuple[Callable, Tuple[unicode]]) -> None
        self._func, self._args = tup

    def __getitem__(self, key):
        # type: (Any) -> unicode
        return self.data[key]

    def __copy__(self):
        # type: () -> _TranslationProxy
        return self

    def __repr__(self):
        # type: () -> str
        try:
            return 'i' + repr(text_type(self.data))
        except:
            return '<%s broken>' % self.__class__.__name__


def mygettext(string):
    # type: (unicode) -> unicode
    """Used instead of _ when creating TranslationProxies, because _ is
    not bound yet at that time.
    """
    return _(string)


def lazy_gettext(string):
    # type: (unicode) -> unicode
    """A lazy version of `gettext`."""
    # if isinstance(string, _TranslationProxy):
    #     return string
    return _TranslationProxy(mygettext, string)  # type: ignore


l_ = lazy_gettext


admonitionlabels = {
    'attention': l_('Attention'),
    'caution':   l_('Caution'),
    'danger':    l_('Danger'),
    'error':     l_('Error'),
    'hint':      l_('Hint'),
    'important': l_('Important'),
    'note':      l_('Note'),
    'seealso':   l_('See also'),
    'tip':       l_('Tip'),
    'warning':   l_('Warning'),
}  # type: Dict[unicode, unicode]

versionlabels = {
    'versionadded':   l_('New in version %s'),
    'versionchanged': l_('Changed in version %s'),
    'deprecated':     l_('Deprecated since version %s'),
}  # type: Dict[unicode, unicode]

# XXX Python specific
pairindextypes = {
    'module':    l_('module'),
    'keyword':   l_('keyword'),
    'operator':  l_('operator'),
    'object':    l_('object'),
    'exception': l_('exception'),
    'statement': l_('statement'),
    'builtin':   l_('built-in function'),
}  # Dict[unicode, _TranslationProxy]

translators = {}  # type: Dict[unicode, Any]

if PY3:
    def _(message):
        # type: (unicode) -> unicode
        try:
            return translators['sphinx'].gettext(message)
        except KeyError:
            return message
else:
    def _(message):
        # type: (unicode) -> unicode
        try:
            return translators['sphinx'].ugettext(message)
        except KeyError:
            return message


def init(locale_dirs, language, catalog='sphinx'):
    # type: (List, unicode, unicode) -> Tuple[Any, bool]
    """Look for message catalogs in `locale_dirs` and *ensure* that there is at
    least a NullTranslations catalog set in `translators`.  If called multiple
    times or if several ``.mo`` files are found, their contents are merged
    together (thus making ``init`` reentrable).
    """
    global translators
    translator = translators.get(catalog)
    # ignore previously failed attempts to find message catalogs
    if isinstance(translator, gettext.NullTranslations):
        translator = None
    # the None entry is the system's default locale path
    has_translation = True

    # loading
    for dir_ in locale_dirs:
        try:
            trans = gettext.translation(catalog, localedir=dir_,  # type: ignore
                                        languages=[language])  # type: ignore
            if translator is None:
                translator = trans
            else:
                translator._catalog.update(trans._catalog)  # type: ignore
        except Exception:
            # Language couldn't be found in the specified path
            pass
    # guarantee translators[catalog] exists
    if translator is None:
        translator = gettext.NullTranslations()
        has_translation = False
    translators[catalog] = translator
    if hasattr(translator, 'ugettext'):
        translator.gettext = translator.ugettext
    return translator, has_translation


def get_translator(catalog='sphinx'):
    # type: (unicode) -> gettext.NullTranslations
    global translators
    translator = translators.get(catalog)
    if translator is None:
        translator = gettext.NullTranslations()
    if hasattr(translator, 'ugettext'):
        translator.gettext = translator.ugettext
    return translator
