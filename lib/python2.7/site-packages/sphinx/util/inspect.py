# -*- coding: utf-8 -*-
"""
    sphinx.util.inspect
    ~~~~~~~~~~~~~~~~~~~

    Helpers for inspecting Python modules.

    :copyright: Copyright 2007-2017 by the Sphinx team, see AUTHORS.
    :license: BSD, see LICENSE for details.
"""

import re

from six import PY3, binary_type
from six.moves import builtins

from sphinx.util import force_decode

if False:
    # For type annotation
    from typing import Any, Callable, List, Tuple, Type  # NOQA

# this imports the standard library inspect module without resorting to
# relatively import this module
inspect = __import__('inspect')

memory_address_re = re.compile(r' at 0x[0-9a-f]{8,16}(?=>)', re.IGNORECASE)


if PY3:
    # Copied from the definition of inspect.getfullargspec from Python master,
    # and modified to remove the use of special flags that break decorated
    # callables and bound methods in the name of backwards compatibility. Used
    # under the terms of PSF license v2, which requires the above statement
    # and the following:
    #
    #   Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,
    #   2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017 Python Software
    #   Foundation; All Rights Reserved
    def getargspec(func):
        """Like inspect.getfullargspec but supports bound methods, and wrapped
        methods."""
        # On 3.5+, signature(int) or similar raises ValueError. On 3.4, it
        # succeeds with a bogus signature. We want a TypeError uniformly, to
        # match historical behavior.
        if (isinstance(func, type) and
                is_builtin_class_method(func, "__new__") and
                is_builtin_class_method(func, "__init__")):
            raise TypeError(
                "can't compute signature for built-in type {}".format(func))

        sig = inspect.signature(func)

        args = []
        varargs = None
        varkw = None
        kwonlyargs = []
        defaults = ()
        annotations = {}
        defaults = ()
        kwdefaults = {}

        if sig.return_annotation is not sig.empty:
            annotations['return'] = sig.return_annotation

        for param in sig.parameters.values():
            kind = param.kind
            name = param.name

            if kind is inspect.Parameter.POSITIONAL_ONLY:
                args.append(name)
            elif kind is inspect.Parameter.POSITIONAL_OR_KEYWORD:
                args.append(name)
                if param.default is not param.empty:
                    defaults += (param.default,)
            elif kind is inspect.Parameter.VAR_POSITIONAL:
                varargs = name
            elif kind is inspect.Parameter.KEYWORD_ONLY:
                kwonlyargs.append(name)
                if param.default is not param.empty:
                    kwdefaults[name] = param.default
            elif kind is inspect.Parameter.VAR_KEYWORD:
                varkw = name

            if param.annotation is not param.empty:
                annotations[name] = param.annotation

        if not kwdefaults:
            # compatibility with 'func.__kwdefaults__'
            kwdefaults = None

        if not defaults:
            # compatibility with 'func.__defaults__'
            defaults = None

        return inspect.FullArgSpec(args, varargs, varkw, defaults,
                                   kwonlyargs, kwdefaults, annotations)

else:  # 2.7
    from functools import partial

    def getargspec(func):
        # type: (Any) -> Any
        """Like inspect.getargspec but supports functools.partial as well."""
        if inspect.ismethod(func):
            func = func.__func__
        parts = 0, ()  # type: Tuple[int, Tuple[unicode, ...]]
        if type(func) is partial:
            keywords = func.keywords
            if keywords is None:
                keywords = {}
            parts = len(func.args), keywords.keys()
            func = func.func
        if not inspect.isfunction(func):
            raise TypeError('%r is not a Python function' % func)
        args, varargs, varkw = inspect.getargs(func.__code__)
        func_defaults = func.__defaults__
        if func_defaults is None:
            func_defaults = []
        else:
            func_defaults = list(func_defaults)
        if parts[0]:
            args = args[parts[0]:]
        if parts[1]:
            for arg in parts[1]:
                i = args.index(arg) - len(args)
                del args[i]
                try:
                    del func_defaults[i]
                except IndexError:
                    pass
        return inspect.ArgSpec(args, varargs, varkw, func_defaults)

try:
    import enum
except ImportError:
    enum = None


def isenumclass(x):
    # type: (Type) -> bool
    """Check if the object is subclass of enum."""
    if enum is None:
        return False
    return inspect.isclass(x) and issubclass(x, enum.Enum)


def isenumattribute(x):
    # type: (Any) -> bool
    """Check if the object is attribute of enum."""
    if enum is None:
        return False
    return isinstance(x, enum.Enum)


def isdescriptor(x):
    # type: (Any) -> bool
    """Check if the object is some kind of descriptor."""
    for item in '__get__', '__set__', '__delete__':
        if hasattr(safe_getattr(x, item, None), '__call__'):
            return True
    return False


def safe_getattr(obj, name, *defargs):
    # type: (Any, unicode, unicode) -> object
    """A getattr() that turns all exceptions into AttributeErrors."""
    try:
        return getattr(obj, name, *defargs)
    except Exception:
        # sometimes accessing a property raises an exception (e.g.
        # NotImplementedError), so let's try to read the attribute directly
        try:
            # In case the object does weird things with attribute access
            # such that accessing `obj.__dict__` may raise an exception
            return obj.__dict__[name]
        except Exception:
            pass

        # this is a catch-all for all the weird things that some modules do
        # with attribute access
        if defargs:
            return defargs[0]

        raise AttributeError(name)


def safe_getmembers(object, predicate=None, attr_getter=safe_getattr):
    # type: (Any, Callable[[unicode], bool], Callable) -> List[Tuple[unicode, Any]]
    """A version of inspect.getmembers() that uses safe_getattr()."""
    results = []  # type: List[Tuple[unicode, Any]]
    for key in dir(object):
        try:
            value = attr_getter(object, key, None)
        except AttributeError:
            continue
        if not predicate or predicate(value):
            results.append((key, value))
    results.sort()
    return results


def object_description(object):
    # type: (Any) -> unicode
    """A repr() implementation that returns text safe to use in reST context."""
    try:
        s = repr(object)
    except Exception:
        raise ValueError
    if isinstance(s, binary_type):
        s = force_decode(s, None)  # type: ignore
    # Strip non-deterministic memory addresses such as
    # ``<__main__.A at 0x7f68cb685710>``
    s = memory_address_re.sub('', s)
    return s.replace('\n', ' ')


def is_builtin_class_method(obj, attr_name):
    # type: (Any, unicode) -> bool
    """If attr_name is implemented at builtin class, return True.

        >>> is_builtin_class_method(int, '__init__')
        True

    Why this function needed? CPython implements int.__init__ by Descriptor
    but PyPy implements it by pure Python code.
    """
    classes = [c for c in inspect.getmro(obj) if attr_name in c.__dict__]
    cls = classes[0] if classes else object

    if not hasattr(builtins, safe_getattr(cls, '__name__', '')):  # type: ignore
        return False
    return getattr(builtins, safe_getattr(cls, '__name__', '')) is cls  # type: ignore
