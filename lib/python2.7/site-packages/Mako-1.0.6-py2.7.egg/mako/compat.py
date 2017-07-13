import sys
import time

py3k = sys.version_info >= (3, 0)
py33 = sys.version_info >= (3, 3)
py2k = sys.version_info < (3,)
py26 = sys.version_info >= (2, 6)
py27 = sys.version_info >= (2, 7)
jython = sys.platform.startswith('java')
win32 = sys.platform.startswith('win')
pypy = hasattr(sys, 'pypy_version_info')

if py3k:
    # create a "getargspec" from getfullargspec(), which is not deprecated
    # in Py3K; getargspec() has started to emit warnings as of Py3.5.
    # As of Py3.4, now they are trying to move from getfullargspec()
    # to "signature()", but getfullargspec() is not deprecated, so stick
    # with that for now.

    import collections
    ArgSpec = collections.namedtuple(
        "ArgSpec",
        ["args", "varargs", "keywords", "defaults"])
    from inspect import getfullargspec as inspect_getfullargspec

    def inspect_getargspec(func):
        return ArgSpec(
            *inspect_getfullargspec(func)[0:4]
        )
else:
    from inspect import getargspec as inspect_getargspec  # noqa


if py3k:
    from io import StringIO
    import builtins as compat_builtins
    from urllib.parse import quote_plus, unquote_plus
    from html.entities import codepoint2name, name2codepoint
    string_types = str,
    binary_type = bytes
    text_type = str

    from io import BytesIO as byte_buffer

    def u(s):
        return s

    def b(s):
        return s.encode("latin-1")

    def octal(lit):
        return eval("0o" + lit)

else:
    import __builtin__ as compat_builtins  # noqa
    try:
        from cStringIO import StringIO
    except:
        from StringIO import StringIO

    byte_buffer = StringIO

    from urllib import quote_plus, unquote_plus  # noqa
    from htmlentitydefs import codepoint2name, name2codepoint  # noqa
    string_types = basestring,  # noqa
    binary_type = str
    text_type = unicode  # noqa

    def u(s):
        return unicode(s, "utf-8")  # noqa

    def b(s):
        return s

    def octal(lit):
        return eval("0" + lit)


if py33:
    from importlib import machinery

    def load_module(module_id, path):
        return machinery.SourceFileLoader(module_id, path).load_module()
else:
    import imp

    def load_module(module_id, path):
        fp = open(path, 'rb')
        try:
            return imp.load_source(module_id, path, fp)
        finally:
            fp.close()


if py3k:
    def reraise(tp, value, tb=None, cause=None):
        if cause is not None:
            value.__cause__ = cause
        if value.__traceback__ is not tb:
            raise value.with_traceback(tb)
        raise value
else:
    exec("def reraise(tp, value, tb=None, cause=None):\n"
         "    raise tp, value, tb\n")


def exception_as():
    return sys.exc_info()[1]

try:
    import threading
    if py3k:
        import _thread as thread
    else:
        import thread
except ImportError:
    import dummy_threading as threading  # noqa
    if py3k:
        import _dummy_thread as thread
    else:
        import dummy_thread as thread  # noqa

if win32 or jython:
    time_func = time.clock
else:
    time_func = time.time

try:
    from functools import partial
except:
    def partial(func, *args, **keywords):
        def newfunc(*fargs, **fkeywords):
            newkeywords = keywords.copy()
            newkeywords.update(fkeywords)
            return func(*(args + fargs), **newkeywords)
        return newfunc


all = all
import json  # noqa


def exception_name(exc):
    return exc.__class__.__name__

try:
    from inspect import CO_VARKEYWORDS, CO_VARARGS

    def inspect_func_args(fn):
        if py3k:
            co = fn.__code__
        else:
            co = fn.func_code

        nargs = co.co_argcount
        names = co.co_varnames
        args = list(names[:nargs])

        varargs = None
        if co.co_flags & CO_VARARGS:
            varargs = co.co_varnames[nargs]
            nargs = nargs + 1
        varkw = None
        if co.co_flags & CO_VARKEYWORDS:
            varkw = co.co_varnames[nargs]

        if py3k:
            return args, varargs, varkw, fn.__defaults__
        else:
            return args, varargs, varkw, fn.func_defaults
except ImportError:
    import inspect

    def inspect_func_args(fn):
        return inspect.getargspec(fn)

if py3k:
    def callable(fn):
        return hasattr(fn, '__call__')
else:
    callable = callable


################################################
# cross-compatible metaclass implementation
# Copyright (c) 2010-2012 Benjamin Peterson
def with_metaclass(meta, base=object):
    """Create a base class with a metaclass."""
    return meta("%sBase" % meta.__name__, (base,), {})
################################################


def arg_stringname(func_arg):
    """Gets the string name of a kwarg or vararg
    In Python3.4 a function's args are
    of _ast.arg type not _ast.name
    """
    if hasattr(func_arg, 'arg'):
        return func_arg.arg
    else:
        return str(func_arg)
