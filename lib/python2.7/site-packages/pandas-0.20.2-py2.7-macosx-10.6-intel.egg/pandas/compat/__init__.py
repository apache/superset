"""
compat
======

Cross-compatible functions for Python 2 and 3.

Key items to import for 2/3 compatible code:
* iterators: range(), map(), zip(), filter(), reduce()
* lists: lrange(), lmap(), lzip(), lfilter()
* unicode: u() [u"" is a syntax error in Python 3.0-3.2]
* longs: long (int in Python 3)
* callable
* iterable method compatibility: iteritems, iterkeys, itervalues
  * Uses the original method if available, otherwise uses items, keys, values.
* types:
    * text_type: unicode in Python 2, str in Python 3
    * binary_type: str in Python 2, bytes in Python 3
    * string_types: basestring in Python 2, str in Python 3
* bind_method: binds functions to classes
* add_metaclass(metaclass) - class decorator that recreates class with with the
  given metaclass instead (and avoids intermediary class creation)

Other items:
* OrderedDefaultDict
* platform checker
"""
# pylint disable=W0611
# flake8: noqa

import functools
import itertools
from distutils.version import LooseVersion
from itertools import product
import sys
import types
from unicodedata import east_asian_width
import struct
import inspect
from collections import namedtuple

PY2 = sys.version_info[0] == 2
PY3 = (sys.version_info[0] >= 3)
PY35 = (sys.version_info >= (3, 5))
PY36 = (sys.version_info >= (3, 6))

try:
    import __builtin__ as builtins
    # not writeable when instantiated with string, doesn't handle unicode well
    from cStringIO import StringIO as cStringIO
    # always writeable
    from StringIO import StringIO
    BytesIO = StringIO
    import cPickle
    import httplib
except ImportError:
    import builtins
    from io import StringIO, BytesIO
    cStringIO = StringIO
    import pickle as cPickle
    import http.client as httplib

from pandas.compat.chainmap import DeepChainMap


if PY3:
    def isidentifier(s):
        return s.isidentifier()

    def str_to_bytes(s, encoding=None):
        return s.encode(encoding or 'ascii')

    def bytes_to_str(b, encoding=None):
        return b.decode(encoding or 'utf-8')

    # The signature version below is directly copied from Django,
    # https://github.com/django/django/pull/4846
    def signature(f):
        sig = inspect.signature(f)
        args = [
            p.name for p in sig.parameters.values()
            if p.kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
        ]
        varargs = [
            p.name for p in sig.parameters.values()
            if p.kind == inspect.Parameter.VAR_POSITIONAL
        ]
        varargs = varargs[0] if varargs else None
        keywords = [
            p.name for p in sig.parameters.values()
            if p.kind == inspect.Parameter.VAR_KEYWORD
        ]
        keywords = keywords[0] if keywords else None
        defaults = [
            p.default for p in sig.parameters.values()
            if p.kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
            and p.default is not p.empty
        ] or None
        argspec = namedtuple('Signature', ['args', 'defaults',
                                           'varargs', 'keywords'])
        return argspec(args, defaults, varargs, keywords)

    # have to explicitly put builtins into the namespace
    range = range
    map = map
    zip = zip
    filter = filter
    intern = sys.intern
    reduce = functools.reduce
    long = int
    unichr = chr

    # This was introduced in Python 3.3, but we don't support
    # Python 3.x < 3.4, so checking PY3 is safe.
    FileNotFoundError = FileNotFoundError

    # list-producing versions of the major Python iterating functions
    def lrange(*args, **kwargs):
        return list(range(*args, **kwargs))

    def lzip(*args, **kwargs):
        return list(zip(*args, **kwargs))

    def lmap(*args, **kwargs):
        return list(map(*args, **kwargs))

    def lfilter(*args, **kwargs):
        return list(filter(*args, **kwargs))

else:
    # Python 2
    import re
    _name_re = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]*$")

    FileNotFoundError = IOError

    def isidentifier(s, dotted=False):
        return bool(_name_re.match(s))

    def str_to_bytes(s, encoding='ascii'):
        return s

    def bytes_to_str(b, encoding='ascii'):
        return b

    def signature(f):
        return inspect.getargspec(f)

    # import iterator versions of these functions
    range = xrange
    intern = intern
    zip = itertools.izip
    filter = itertools.ifilter
    map = itertools.imap
    reduce = reduce
    long = long
    unichr = unichr

    # Python 2-builtin ranges produce lists
    lrange = builtins.range
    lzip = builtins.zip
    lmap = builtins.map
    lfilter = builtins.filter


if PY2:
    def iteritems(obj, **kw):
        return obj.iteritems(**kw)

    def iterkeys(obj, **kw):
        return obj.iterkeys(**kw)

    def itervalues(obj, **kw):
        return obj.itervalues(**kw)

    next = lambda it: it.next()
else:
    def iteritems(obj, **kw):
        return iter(obj.items(**kw))

    def iterkeys(obj, **kw):
        return iter(obj.keys(**kw))

    def itervalues(obj, **kw):
        return iter(obj.values(**kw))

    next = next


def bind_method(cls, name, func):
    """Bind a method to class, python 2 and python 3 compatible.

    Parameters
    ----------

    cls : type
        class to receive bound method
    name : basestring
        name of method on class instance
    func : function
        function to be bound as method


    Returns
    -------
    None
    """
    # only python 2 has bound/unbound method issue
    if not PY3:
        setattr(cls, name, types.MethodType(func, None, cls))
    else:
        setattr(cls, name, func)
# ----------------------------------------------------------------------------
# functions largely based / taken from the six module

# Much of the code in this module comes from Benjamin Peterson's six library.
# The license for this library can be found in LICENSES/SIX and the code can be
# found at https://bitbucket.org/gutworth/six

# Definition of East Asian Width
# http://unicode.org/reports/tr11/
# Ambiguous width can be changed by option
_EAW_MAP = {'Na': 1, 'N': 1, 'W': 2, 'F': 2, 'H': 1}

if PY3:
    string_types = str,
    integer_types = int,
    class_types = type,
    text_type = str
    binary_type = bytes

    def u(s):
        return s

    def u_safe(s):
        return s

    def strlen(data, encoding=None):
        # encoding is for compat with PY2
        return len(data)

    def east_asian_len(data, encoding=None, ambiguous_width=1):
        """
        Calculate display width considering unicode East Asian Width
        """
        if isinstance(data, text_type):
            return sum([_EAW_MAP.get(east_asian_width(c), ambiguous_width) for c in data])
        else:
            return len(data)

    def import_lzma():
        """ import lzma from the std library """
        import lzma
        return lzma

    def set_function_name(f, name, cls):
        """ Bind the name/qualname attributes of the function """
        f.__name__ = name
        f.__qualname__ = '{klass}.{name}'.format(
            klass=cls.__name__,
            name=name)
        f.__module__ = cls.__module__
        return f

    ResourceWarning = ResourceWarning

else:
    string_types = basestring,
    integer_types = (int, long)
    class_types = (type, types.ClassType)
    text_type = unicode
    binary_type = str

    def u(s):
        return unicode(s, "unicode_escape")

    def u_safe(s):
        try:
            return unicode(s, "unicode_escape")
        except:
            return s

    def strlen(data, encoding=None):
        try:
            data = data.decode(encoding)
        except UnicodeError:
            pass
        return len(data)

    def east_asian_len(data, encoding=None, ambiguous_width=1):
        """
        Calculate display width considering unicode East Asian Width
        """
        if isinstance(data, text_type):
            try:
                data = data.decode(encoding)
            except UnicodeError:
                pass
            return sum([_EAW_MAP.get(east_asian_width(c), ambiguous_width) for c in data])
        else:
            return len(data)

    def import_lzma():
        """ import the backported lzma library
        or raise ImportError if not available """
        from backports import lzma
        return lzma

    def set_function_name(f, name, cls):
        """ Bind the name attributes of the function """
        f.__name__ = name
        return f

    class ResourceWarning(Warning):
        pass

string_and_binary_types = string_types + (binary_type,)


try:
    # callable reintroduced in later versions of Python
    callable = callable
except NameError:
    def callable(obj):
        return any("__call__" in klass.__dict__ for klass in type(obj).__mro__)


def add_metaclass(metaclass):
    """Class decorator for creating a class with a metaclass."""
    def wrapper(cls):
        orig_vars = cls.__dict__.copy()
        orig_vars.pop('__dict__', None)
        orig_vars.pop('__weakref__', None)
        for slots_var in orig_vars.get('__slots__', ()):
            orig_vars.pop(slots_var)
        return metaclass(cls.__name__, cls.__bases__, orig_vars)
    return wrapper

from collections import OrderedDict, Counter

if PY3:
    def raise_with_traceback(exc, traceback=Ellipsis):
        if traceback == Ellipsis:
            _, _, traceback = sys.exc_info()
        raise exc.with_traceback(traceback)
else:
    # this version of raise is a syntax error in Python 3
    exec("""
def raise_with_traceback(exc, traceback=Ellipsis):
    if traceback == Ellipsis:
        _, _, traceback = sys.exc_info()
    raise exc, None, traceback
""")

raise_with_traceback.__doc__ = """Raise exception with existing traceback.
If traceback is not passed, uses sys.exc_info() to get traceback."""


# http://stackoverflow.com/questions/4126348
# Thanks to @martineau at SO

from dateutil import parser as _date_parser
import dateutil
if LooseVersion(dateutil.__version__) < '2.0':
    @functools.wraps(_date_parser.parse)
    def parse_date(timestr, *args, **kwargs):
        timestr = bytes(timestr)
        return _date_parser.parse(timestr, *args, **kwargs)
elif PY2 and LooseVersion(dateutil.__version__) == '2.0':
    # dateutil brokenness
    raise Exception('dateutil 2.0 incompatible with Python 2.x, you must '
                    'install version 1.5 or 2.1+!')
else:
    parse_date = _date_parser.parse


class OrderedDefaultdict(OrderedDict):

    def __init__(self, *args, **kwargs):
        newdefault = None
        newargs = ()
        if args:
            newdefault = args[0]
            if not (newdefault is None or callable(newdefault)):
                raise TypeError('first argument must be callable or None')
            newargs = args[1:]
        self.default_factory = newdefault
        super(self.__class__, self).__init__(*newargs, **kwargs)

    def __missing__(self, key):
        if self.default_factory is None:
            raise KeyError(key)
        self[key] = value = self.default_factory()
        return value

    def __reduce__(self):  # optional, for pickle support
        args = self.default_factory if self.default_factory else tuple()
        return type(self), args, None, None, list(self.items())


# https://github.com/pandas-dev/pandas/pull/9123
def is_platform_little_endian():
    """ am I little endian """
    return sys.byteorder == 'little'


def is_platform_windows():
    return sys.platform == 'win32' or sys.platform == 'cygwin'


def is_platform_linux():
    return sys.platform == 'linux2'


def is_platform_mac():
    return sys.platform == 'darwin'


def is_platform_32bit():
    return struct.calcsize("P") * 8 < 64
