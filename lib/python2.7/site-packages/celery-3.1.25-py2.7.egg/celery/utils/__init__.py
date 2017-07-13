# -*- coding: utf-8 -*-
"""
    celery.utils
    ~~~~~~~~~~~~

    Utility functions.

"""
from __future__ import absolute_import, print_function

import numbers
import os
import re
import socket
import sys
import traceback
import warnings
import datetime

from collections import Callable
from functools import partial, wraps
from inspect import getargspec
from pprint import pprint

from kombu.entity import Exchange, Queue

from celery.exceptions import CPendingDeprecationWarning, CDeprecationWarning
from celery.five import WhateverIO, items, reraise, string_t

__all__ = ['worker_direct', 'warn_deprecated', 'deprecated', 'lpmerge',
           'is_iterable', 'isatty', 'cry', 'maybe_reraise', 'strtobool',
           'jsonify', 'gen_task_name', 'nodename', 'nodesplit',
           'cached_property']

PY3 = sys.version_info[0] == 3


PENDING_DEPRECATION_FMT = """
    {description} is scheduled for deprecation in \
    version {deprecation} and removal in version v{removal}. \
    {alternative}
"""

DEPRECATION_FMT = """
    {description} is deprecated and scheduled for removal in
    version {removal}. {alternative}
"""

UNKNOWN_SIMPLE_FORMAT_KEY = """
Unknown format %{0} in string {1!r}.
Possible causes: Did you forget to escape the expand sign (use '%%{0!r}'),
or did you escape and the value was expanded twice? (%%N -> %N -> %hostname)?
""".strip()

#: Billiard sets this when execv is enabled.
#: We use it to find out the name of the original ``__main__``
#: module, so that we can properly rewrite the name of the
#: task to be that of ``App.main``.
MP_MAIN_FILE = os.environ.get('MP_MAIN_FILE') or None

#: Exchange for worker direct queues.
WORKER_DIRECT_EXCHANGE = Exchange('C.dq')

#: Format for worker direct queue names.
WORKER_DIRECT_QUEUE_FORMAT = '{hostname}.dq'

#: Separator for worker node name and hostname.
NODENAME_SEP = '@'

NODENAME_DEFAULT = 'celery'
RE_FORMAT = re.compile(r'%(\w)')


def worker_direct(hostname):
    """Return :class:`kombu.Queue` that is a direct route to
    a worker by hostname.

    :param hostname: The fully qualified node name of a worker
                     (e.g. ``w1@example.com``).  If passed a
                     :class:`kombu.Queue` instance it will simply return
                     that instead.
    """
    if isinstance(hostname, Queue):
        return hostname
    return Queue(WORKER_DIRECT_QUEUE_FORMAT.format(hostname=hostname),
                 WORKER_DIRECT_EXCHANGE,
                 hostname, auto_delete=True)


def warn_deprecated(description=None, deprecation=None,
                    removal=None, alternative=None, stacklevel=2):
    ctx = {'description': description,
           'deprecation': deprecation, 'removal': removal,
           'alternative': alternative}
    if deprecation is not None:
        w = CPendingDeprecationWarning(PENDING_DEPRECATION_FMT.format(**ctx))
    else:
        w = CDeprecationWarning(DEPRECATION_FMT.format(**ctx))
    warnings.warn(w, stacklevel=stacklevel)


def deprecated(deprecation=None, removal=None,
               alternative=None, description=None):
    """Decorator for deprecated functions.

    A deprecation warning will be emitted when the function is called.

    :keyword deprecation: Version that marks first deprecation, if this
      argument is not set a ``PendingDeprecationWarning`` will be emitted
      instead.
    :keyword removal:  Future version when this feature will be removed.
    :keyword alternative:  Instructions for an alternative solution (if any).
    :keyword description: Description of what is being deprecated.

    """
    def _inner(fun):

        @wraps(fun)
        def __inner(*args, **kwargs):
            from .imports import qualname
            warn_deprecated(description=description or qualname(fun),
                            deprecation=deprecation,
                            removal=removal,
                            alternative=alternative,
                            stacklevel=3)
            return fun(*args, **kwargs)
        return __inner
    return _inner


def deprecated_property(deprecation=None, removal=None,
                        alternative=None, description=None):
    def _inner(fun):
        return _deprecated_property(
            fun, deprecation=deprecation, removal=removal,
            alternative=alternative, description=description or fun.__name__)
    return _inner


class _deprecated_property(object):

    def __init__(self, fget=None, fset=None, fdel=None, doc=None, **depreinfo):
        self.__get = fget
        self.__set = fset
        self.__del = fdel
        self.__name__, self.__module__, self.__doc__ = (
            fget.__name__, fget.__module__, fget.__doc__,
        )
        self.depreinfo = depreinfo
        self.depreinfo.setdefault('stacklevel', 3)

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        warn_deprecated(**self.depreinfo)
        return self.__get(obj)

    def __set__(self, obj, value):
        if obj is None:
            return self
        if self.__set is None:
            raise AttributeError('cannot set attribute')
        warn_deprecated(**self.depreinfo)
        self.__set(obj, value)

    def __delete__(self, obj):
        if obj is None:
            return self
        if self.__del is None:
            raise AttributeError('cannot delete attribute')
        warn_deprecated(**self.depreinfo)
        self.__del(obj)

    def setter(self, fset):
        return self.__class__(self.__get, fset, self.__del, **self.depreinfo)

    def deleter(self, fdel):
        return self.__class__(self.__get, self.__set, fdel, **self.depreinfo)


def lpmerge(L, R):
    """In place left precedent dictionary merge.

    Keeps values from `L`, if the value in `R` is :const:`None`."""
    set = L.__setitem__
    [set(k, v) for k, v in items(R) if v is not None]
    return L


def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    return True


def fun_takes_kwargs(fun, kwlist=[]):
    # deprecated
    S = getattr(fun, 'argspec', getargspec(fun))
    if S.keywords is not None:
        return kwlist
    return [kw for kw in kwlist if kw in S.args]


def isatty(fh):
    try:
        return fh.isatty()
    except AttributeError:
        pass


def cry(out=None, sepchr='=', seplen=49):  # pragma: no cover
    """Return stacktrace of all active threads,
    taken from https://gist.github.com/737056."""
    import threading

    out = WhateverIO() if out is None else out
    P = partial(print, file=out)

    # get a map of threads by their ID so we can print their names
    # during the traceback dump
    tmap = dict((t.ident, t) for t in threading.enumerate())

    sep = sepchr * seplen
    for tid, frame in items(sys._current_frames()):
        thread = tmap.get(tid)
        if not thread:
            # skip old junk (left-overs from a fork)
            continue
        P('{0.name}'.format(thread))
        P(sep)
        traceback.print_stack(frame, file=out)
        P(sep)
        P('LOCAL VARIABLES')
        P(sep)
        pprint(frame.f_locals, stream=out)
        P('\n')
    return out.getvalue()


def maybe_reraise():
    """Re-raise if an exception is currently being handled, or return
    otherwise."""
    exc_info = sys.exc_info()
    try:
        if exc_info[2]:
            reraise(exc_info[0], exc_info[1], exc_info[2])
    finally:
        # see http://docs.python.org/library/sys.html#sys.exc_info
        del(exc_info)


def strtobool(term, table={'false': False, 'no': False, '0': False,
                           'true': True, 'yes': True, '1': True,
                           'on': True, 'off': False}):
    """Convert common terms for true/false to bool
    (true/false/yes/no/on/off/1/0)."""
    if isinstance(term, string_t):
        try:
            return table[term.lower()]
        except KeyError:
            raise TypeError('Cannot coerce {0!r} to type bool'.format(term))
    return term


def jsonify(obj,
            builtin_types=(numbers.Real, string_t), key=None,
            keyfilter=None,
            unknown_type_filter=None):
    """Transforms object making it suitable for json serialization"""
    from kombu.abstract import Object as KombuDictType
    _jsonify = partial(jsonify, builtin_types=builtin_types, key=key,
                       keyfilter=keyfilter,
                       unknown_type_filter=unknown_type_filter)

    if isinstance(obj, KombuDictType):
        obj = obj.as_dict(recurse=True)

    if obj is None or isinstance(obj, builtin_types):
        return obj
    elif isinstance(obj, (tuple, list)):
        return [_jsonify(v) for v in obj]
    elif isinstance(obj, dict):
        return dict((k, _jsonify(v, key=k))
                    for k, v in items(obj)
                    if (keyfilter(k) if keyfilter else 1))
    elif isinstance(obj, datetime.datetime):
        # See "Date Time String Format" in the ECMA-262 specification.
        r = obj.isoformat()
        if obj.microsecond:
            r = r[:23] + r[26:]
        if r.endswith('+00:00'):
            r = r[:-6] + 'Z'
        return r
    elif isinstance(obj, datetime.date):
        return obj.isoformat()
    elif isinstance(obj, datetime.time):
        r = obj.isoformat()
        if obj.microsecond:
            r = r[:12]
        return r
    elif isinstance(obj, datetime.timedelta):
        return str(obj)
    else:
        if unknown_type_filter is None:
            raise ValueError(
                'Unsupported type: {0!r} {1!r} (parent: {2})'.format(
                    type(obj), obj, key))
        return unknown_type_filter(obj)


def gen_task_name(app, name, module_name):
    """Generate task name from name/module pair."""
    try:
        module = sys.modules[module_name]
    except KeyError:
        # Fix for manage.py shell_plus (Issue #366)
        module = None

    if module is not None:
        module_name = module.__name__
        # - If the task module is used as the __main__ script
        # - we need to rewrite the module part of the task name
        # - to match App.main.
        if MP_MAIN_FILE and module.__file__ == MP_MAIN_FILE:
            # - see comment about :envvar:`MP_MAIN_FILE` above.
            module_name = '__main__'
    if module_name == '__main__' and app.main:
        return '.'.join([app.main, name])
    return '.'.join(p for p in (module_name, name) if p)


def nodename(name, hostname):
    """Create node name from name/hostname pair."""
    return NODENAME_SEP.join((name, hostname))


def anon_nodename(hostname=None, prefix='gen'):
    return nodename(''.join([prefix, str(os.getpid())]),
                    hostname or socket.gethostname())


def nodesplit(nodename):
    """Split node name into tuple of name/hostname."""
    parts = nodename.split(NODENAME_SEP, 1)
    if len(parts) == 1:
        return None, parts[0]
    return parts


def default_nodename(hostname):
    name, host = nodesplit(hostname or '')
    return nodename(name or NODENAME_DEFAULT, host or socket.gethostname())


def node_format(s, nodename, **extra):
    name, host = nodesplit(nodename)
    return host_format(
        s, host, n=name or NODENAME_DEFAULT, **extra)


def _fmt_process_index(prefix='', default='0'):
    from .log import current_process_index
    index = current_process_index()
    return '{0}{1}'.format(prefix, index) if index else default
_fmt_process_index_with_prefix = partial(_fmt_process_index, '-', '')


def host_format(s, host=None, **extra):
    host = host or socket.gethostname()
    name, _, domain = host.partition('.')
    keys = dict({
        'h': host, 'n': name, 'd': domain,
        'i': _fmt_process_index, 'I': _fmt_process_index_with_prefix,
    }, **extra)
    return simple_format(s, keys)


def simple_format(s, keys, pattern=RE_FORMAT, expand=r'\1'):
    if s:
        keys.setdefault('%', '%')

        def resolve(match):
            key = match.expand(expand)
            try:
                resolver = keys[key]
            except KeyError:
                raise ValueError(UNKNOWN_SIMPLE_FORMAT_KEY.format(key, s))
            if isinstance(resolver, Callable):
                return resolver()
            return resolver

        return pattern.sub(resolve, s)
    return s


# ------------------------------------------------------------------------ #
# > XXX Compat
from .log import LOG_LEVELS     # noqa
from .imports import (          # noqa
    qualname as get_full_cls_name, symbol_by_name as get_cls_by_name,
    instantiate, import_from_cwd
)
from .functional import chunks, noop                    # noqa
from kombu.utils import cached_property, kwdict, uuid   # noqa
gen_unique_id = uuid
