# -*- coding: utf-8 -*-
"""
    celery.utils.serialization
    ~~~~~~~~~~~~~~~~~~~~~~~~~~

    Utilities for safely pickling exceptions.

"""
from __future__ import absolute_import

from inspect import getmro
from itertools import takewhile

try:
    import cPickle as pickle
except ImportError:
    import pickle  # noqa

from .encoding import safe_repr

__all__ = ['UnpickleableExceptionWrapper', 'subclass_exception',
           'find_pickleable_exception', 'create_exception_cls',
           'get_pickleable_exception', 'get_pickleable_etype',
           'get_pickled_exception']

#: List of base classes we probably don't want to reduce to.
try:
    unwanted_base_classes = (StandardError, Exception, BaseException, object)
except NameError:  # pragma: no cover
    unwanted_base_classes = (Exception, BaseException, object)  # py3k


def subclass_exception(name, parent, module):  # noqa
    return type(name, (parent, ), {'__module__': module})


def find_pickleable_exception(exc, loads=pickle.loads,
                              dumps=pickle.dumps):
    """With an exception instance, iterate over its super classes (by mro)
    and find the first super exception that is pickleable.  It does
    not go below :exc:`Exception` (i.e. it skips :exc:`Exception`,
    :class:`BaseException` and :class:`object`).  If that happens
    you should use :exc:`UnpickleableException` instead.

    :param exc: An exception instance.

    Will return the nearest pickleable parent exception class
    (except :exc:`Exception` and parents), or if the exception is
    pickleable it will return :const:`None`.

    :rtype :exc:`Exception`:

    """
    exc_args = getattr(exc, 'args', [])
    for supercls in itermro(exc.__class__, unwanted_base_classes):
        try:
            superexc = supercls(*exc_args)
            loads(dumps(superexc))
        except:
            pass
        else:
            return superexc
find_nearest_pickleable_exception = find_pickleable_exception  # XXX compat


def itermro(cls, stop):
    return takewhile(lambda sup: sup not in stop, getmro(cls))


def create_exception_cls(name, module, parent=None):
    """Dynamically create an exception class."""
    if not parent:
        parent = Exception
    return subclass_exception(name, parent, module)


class UnpickleableExceptionWrapper(Exception):
    """Wraps unpickleable exceptions.

    :param exc_module: see :attr:`exc_module`.
    :param exc_cls_name: see :attr:`exc_cls_name`.
    :param exc_args: see :attr:`exc_args`

    **Example**

    .. code-block:: python

        >>> def pickle_it(raising_function):
        ...     try:
        ...         raising_function()
        ...     except Exception as e:
        ...         exc = UnpickleableExceptionWrapper(
        ...             e.__class__.__module__,
        ...             e.__class__.__name__,
        ...             e.args,
        ...         )
        ...         pickle.dumps(exc)  # Works fine.

    """

    #: The module of the original exception.
    exc_module = None

    #: The name of the original exception class.
    exc_cls_name = None

    #: The arguments for the original exception.
    exc_args = None

    def __init__(self, exc_module, exc_cls_name, exc_args, text=None):
        safe_exc_args = []
        for arg in exc_args:
            try:
                pickle.dumps(arg)
                safe_exc_args.append(arg)
            except Exception:
                safe_exc_args.append(safe_repr(arg))
        self.exc_module = exc_module
        self.exc_cls_name = exc_cls_name
        self.exc_args = safe_exc_args
        self.text = text
        Exception.__init__(self, exc_module, exc_cls_name, safe_exc_args, text)

    def restore(self):
        return create_exception_cls(self.exc_cls_name,
                                    self.exc_module)(*self.exc_args)

    def __str__(self):
        return self.text

    @classmethod
    def from_exception(cls, exc):
        return cls(exc.__class__.__module__,
                   exc.__class__.__name__,
                   getattr(exc, 'args', []),
                   safe_repr(exc))


def get_pickleable_exception(exc):
    """Make sure exception is pickleable."""
    try:
        pickle.loads(pickle.dumps(exc))
    except Exception:
        pass
    else:
        return exc
    nearest = find_pickleable_exception(exc)
    if nearest:
        return nearest
    return UnpickleableExceptionWrapper.from_exception(exc)


def get_pickleable_etype(cls, loads=pickle.loads, dumps=pickle.dumps):
    try:
        loads(dumps(cls))
    except:
        return Exception
    else:
        return cls


def get_pickled_exception(exc):
    """Get original exception from exception pickled using
    :meth:`get_pickleable_exception`."""
    if isinstance(exc, UnpickleableExceptionWrapper):
        return exc.restore()
    return exc
