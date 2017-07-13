# -*- coding: utf-8 -*-
"""
    celery.five
    ~~~~~~~~~~~

    Compatibility implementations of features
    only available in newer Python versions.


"""
from __future__ import absolute_import

import io
import operator
import sys

from importlib import import_module
from types import ModuleType

from kombu.five import monotonic

try:
    from collections import Counter
except ImportError:  # pragma: no cover
    from collections import defaultdict

    def Counter():  # noqa
        return defaultdict(int)

__all__ = ['Counter', 'reload', 'UserList', 'UserDict', 'Queue', 'Empty',
           'zip_longest', 'map', 'string', 'string_t',
           'long_t', 'text_t', 'range', 'int_types', 'items', 'keys', 'values',
           'nextfun', 'reraise', 'WhateverIO', 'with_metaclass',
           'OrderedDict', 'THREAD_TIMEOUT_MAX', 'format_d',
           'class_property', 'reclassmethod', 'create_module',
           'recreate_module', 'monotonic']

# ############# py3k #########################################################
PY3 = sys.version_info[0] == 3

try:
    reload = reload                         # noqa
except NameError:                           # pragma: no cover
    from imp import reload                  # noqa

try:
    from UserList import UserList           # noqa
except ImportError:                         # pragma: no cover
    from collections import UserList        # noqa

try:
    from UserDict import UserDict           # noqa
except ImportError:                         # pragma: no cover
    from collections import UserDict        # noqa


if PY3:  # pragma: no cover
    import builtins

    from queue import Queue, Empty
    from itertools import zip_longest

    map = map
    string = str
    string_t = str
    long_t = int
    text_t = str
    range = range
    int_types = (int, )
    _byte_t = bytes

    open_fqdn = 'builtins.open'

    def items(d):
        return d.items()

    def keys(d):
        return d.keys()

    def values(d):
        return d.values()

    def nextfun(it):
        return it.__next__

    exec_ = getattr(builtins, 'exec')

    def reraise(tp, value, tb=None):
        if value.__traceback__ is not tb:
            raise value.with_traceback(tb)
        raise value

else:
    import __builtin__ as builtins  # noqa
    from Queue import Queue, Empty  # noqa
    from itertools import imap as map, izip_longest as zip_longest  # noqa
    string = unicode                # noqa
    string_t = basestring           # noqa
    text_t = unicode                # noqa
    long_t = long                   # noqa
    range = xrange                  # noqa
    int_types = (int, long)         # noqa
    _byte_t = (str, bytes)          # noqa

    open_fqdn = '__builtin__.open'

    def items(d):                   # noqa
        return d.iteritems()

    def keys(d):                    # noqa
        return d.iterkeys()

    def values(d):                  # noqa
        return d.itervalues()

    def nextfun(it):                # noqa
        return it.next

    def exec_(code, globs=None, locs=None):  # pragma: no cover
        """Execute code in a namespace."""
        if globs is None:
            frame = sys._getframe(1)
            globs = frame.f_globals
            if locs is None:
                locs = frame.f_locals
            del frame
        elif locs is None:
            locs = globs
        exec("""exec code in globs, locs""")

    exec_("""def reraise(tp, value, tb=None): raise tp, value, tb""")


def with_metaclass(Type, skip_attrs=set(['__dict__', '__weakref__'])):
    """Class decorator to set metaclass.

    Works with both Python 2 and Python 3 and it does not add
    an extra class in the lookup order like ``six.with_metaclass`` does
    (that is -- it copies the original class instead of using inheritance).

    """

    def _clone_with_metaclass(Class):
        attrs = dict((key, value) for key, value in items(vars(Class))
                     if key not in skip_attrs)
        return Type(Class.__name__, Class.__bases__, attrs)

    return _clone_with_metaclass


# ############# collections.OrderedDict ######################################
# was moved to kombu
from kombu.utils.compat import OrderedDict  # noqa

# ############# threading.TIMEOUT_MAX ########################################
try:
    from threading import TIMEOUT_MAX as THREAD_TIMEOUT_MAX
except ImportError:
    THREAD_TIMEOUT_MAX = 1e10  # noqa

# ############# format(int, ',d') ############################################

if sys.version_info >= (2, 7):  # pragma: no cover
    def format_d(i):
        return format(i, ',d')
else:  # pragma: no cover
    def format_d(i):  # noqa
        s = '%d' % i
        groups = []
        while s and s[-1].isdigit():
            groups.append(s[-3:])
            s = s[:-3]
        return s + ','.join(reversed(groups))


# ############# Module Generation ############################################

# Utilities to dynamically
# recreate modules, either for lazy loading or
# to create old modules at runtime instead of
# having them litter the source tree.

# import fails in python 2.5. fallback to reduce in stdlib
try:
    from functools import reduce
except ImportError:
    pass

MODULE_DEPRECATED = """
The module %s is deprecated and will be removed in a future version.
"""

DEFAULT_ATTRS = set(['__file__', '__path__', '__doc__', '__all__'])

# im_func is no longer available in Py3.
# instead the unbound method itself can be used.
if sys.version_info[0] == 3:  # pragma: no cover
    def fun_of_method(method):
        return method
else:
    def fun_of_method(method):  # noqa
        return method.im_func


def getappattr(path):
    """Gets attribute from the current_app recursively,
    e.g. getappattr('amqp.get_task_consumer')``."""
    from celery import current_app
    return current_app._rgetattr(path)


def _compat_task_decorator(*args, **kwargs):
    from celery import current_app
    kwargs.setdefault('accept_magic_kwargs', True)
    return current_app.task(*args, **kwargs)


def _compat_periodic_task_decorator(*args, **kwargs):
    from celery.task import periodic_task
    kwargs.setdefault('accept_magic_kwargs', True)
    return periodic_task(*args, **kwargs)


COMPAT_MODULES = {
    'celery': {
        'execute': {
            'send_task': 'send_task',
        },
        'decorators': {
            'task': _compat_task_decorator,
            'periodic_task': _compat_periodic_task_decorator,
        },
        'log': {
            'get_default_logger': 'log.get_default_logger',
            'setup_logger': 'log.setup_logger',
            'setup_logging_subsystem': 'log.setup_logging_subsystem',
            'redirect_stdouts_to_logger': 'log.redirect_stdouts_to_logger',
        },
        'messaging': {
            'TaskPublisher': 'amqp.TaskPublisher',
            'TaskConsumer': 'amqp.TaskConsumer',
            'establish_connection': 'connection',
            'get_consumer_set': 'amqp.TaskConsumer',
        },
        'registry': {
            'tasks': 'tasks',
        },
    },
    'celery.task': {
        'control': {
            'broadcast': 'control.broadcast',
            'rate_limit': 'control.rate_limit',
            'time_limit': 'control.time_limit',
            'ping': 'control.ping',
            'revoke': 'control.revoke',
            'discard_all': 'control.purge',
            'inspect': 'control.inspect',
        },
        'schedules': 'celery.schedules',
        'chords': 'celery.canvas',
    }
}


class class_property(object):

    def __init__(self, getter=None, setter=None):
        if getter is not None and not isinstance(getter, classmethod):
            getter = classmethod(getter)
        if setter is not None and not isinstance(setter, classmethod):
            setter = classmethod(setter)
        self.__get = getter
        self.__set = setter

        info = getter.__get__(object)  # just need the info attrs.
        self.__doc__ = info.__doc__
        self.__name__ = info.__name__
        self.__module__ = info.__module__

    def __get__(self, obj, type=None):
        if obj and type is None:
            type = obj.__class__
        return self.__get.__get__(obj, type)()

    def __set__(self, obj, value):
        if obj is None:
            return self
        return self.__set.__get__(obj)(value)

    def setter(self, setter):
        return self.__class__(self.__get, setter)


def reclassmethod(method):
    return classmethod(fun_of_method(method))


class LazyModule(ModuleType):
    _compat_modules = ()
    _all_by_module = {}
    _direct = {}
    _object_origins = {}

    def __getattr__(self, name):
        if name in self._object_origins:
            module = __import__(self._object_origins[name], None, None, [name])
            for item in self._all_by_module[module.__name__]:
                setattr(self, item, getattr(module, item))
            return getattr(module, name)
        elif name in self._direct:  # pragma: no cover
            module = __import__(self._direct[name], None, None, [name])
            setattr(self, name, module)
            return module
        return ModuleType.__getattribute__(self, name)

    def __dir__(self):
        return list(set(self.__all__) | DEFAULT_ATTRS)

    def __reduce__(self):
        return import_module, (self.__name__, )


def create_module(name, attrs, cls_attrs=None, pkg=None,
                  base=LazyModule, prepare_attr=None):
    fqdn = '.'.join([pkg.__name__, name]) if pkg else name
    cls_attrs = {} if cls_attrs is None else cls_attrs
    pkg, _, modname = name.rpartition('.')
    cls_attrs['__module__'] = pkg

    attrs = dict((attr_name, prepare_attr(attr) if prepare_attr else attr)
                 for attr_name, attr in items(attrs))
    module = sys.modules[fqdn] = type(modname, (base, ), cls_attrs)(fqdn)
    module.__dict__.update(attrs)
    return module


def recreate_module(name, compat_modules=(), by_module={}, direct={},
                    base=LazyModule, **attrs):
    old_module = sys.modules[name]
    origins = get_origins(by_module)
    compat_modules = COMPAT_MODULES.get(name, ())

    cattrs = dict(
        _compat_modules=compat_modules,
        _all_by_module=by_module, _direct=direct,
        _object_origins=origins,
        __all__=tuple(set(reduce(
            operator.add,
            [tuple(v) for v in [compat_modules, origins, direct, attrs]],
        ))),
    )
    new_module = create_module(name, attrs, cls_attrs=cattrs, base=base)
    new_module.__dict__.update(dict((mod, get_compat_module(new_module, mod))
                               for mod in compat_modules))
    return old_module, new_module


def get_compat_module(pkg, name):
    from .local import Proxy

    def prepare(attr):
        if isinstance(attr, string_t):
            return Proxy(getappattr, (attr, ))
        return attr

    attrs = COMPAT_MODULES[pkg.__name__][name]
    if isinstance(attrs, string_t):
        fqdn = '.'.join([pkg.__name__, name])
        module = sys.modules[fqdn] = import_module(attrs)
        return module
    attrs['__all__'] = list(attrs)
    return create_module(name, dict(attrs), pkg=pkg, prepare_attr=prepare)


def get_origins(defs):
    origins = {}
    for module, attrs in items(defs):
        origins.update(dict((attr, module) for attr in attrs))
    return origins


_SIO_write = io.StringIO.write
_SIO_init = io.StringIO.__init__


class WhateverIO(io.StringIO):

    def __init__(self, v=None, *a, **kw):
        _SIO_init(self, v.decode() if isinstance(v, _byte_t) else v, *a, **kw)

    def write(self, data):
        _SIO_write(self, data.decode() if isinstance(data, _byte_t) else data)
