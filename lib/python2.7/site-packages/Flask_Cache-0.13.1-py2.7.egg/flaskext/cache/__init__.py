# -*- coding: utf-8 -*-
"""
    flaskext.cache
    ~~~~~~~~~~~~~~

    Adds cache support to your application.

    :copyright: (c) 2010 by Thadeus Burgess.
    :license: BSD, see LICENSE for more details
"""

__version__ = '0.7.1'
__versionfull__ = __version__

import uuid
import hashlib
import inspect
import warnings
import exceptions

from types import NoneType
from functools import wraps

from werkzeug import import_string
from werkzeug.contrib.cache import BaseCache, NullCache
from flask import request, current_app

JINJA_CACHE_ATTR_NAME = '_template_fragment_cache'

from flaskext.cache.jinja2ext import CacheExtension

def function_namespace(f):
    """
    Attempts to returns unique namespace for function
    """

    if hasattr(f, 'im_func'):
        return '%s.%s.%s' % (f.__module__, f.im_class.__name__, f.__name__)
    else:
        return '%s.%s' % (f.__module__, f.__name__)

#: Cache Object
################

class Cache(object):
    """
    This class is used to control the cache objects.
    """

    def __init__(self, app=None, with_jinja2_ext=True, config=None):
        self.with_jinja2_ext = with_jinja2_ext
        self.config = config

        self.cache = None

        if app is not None:
            self.init_app(app)
        else:
            self.app = None

        self._memoized = []

    def init_app(self, app, config=None):
        "This is used to initialize cache with your app object"

        if config is not None:
            self.config = config
        elif self.config is None:
            self.config = app.config

        if not isinstance(self.config, (NoneType, dict)):
            raise ValueError("`config` must be an instance of dict or NoneType")

        self.config.setdefault('CACHE_DEFAULT_TIMEOUT', 300)
        self.config.setdefault('CACHE_THRESHOLD', 500)
        self.config.setdefault('CACHE_KEY_PREFIX', None)
        self.config.setdefault('CACHE_MEMCACHED_SERVERS', None)
        self.config.setdefault('CACHE_DIR', None)
        self.config.setdefault('CACHE_OPTIONS', None)
        self.config.setdefault('CACHE_ARGS', [])
        self.config.setdefault('CACHE_TYPE', 'null')

        if self.with_jinja2_ext:
            setattr(app.jinja_env, JINJA_CACHE_ATTR_NAME, self)

            app.jinja_env.add_extension(CacheExtension)

        self.app = app

        self._set_cache()

    def _set_cache(self):
        import_me = self.config['CACHE_TYPE']
        if '.' not in import_me:
            import_me = 'flaskext.cache.backends.' + \
                        import_me

        cache_obj = import_string(import_me)
        cache_args = self.config['CACHE_ARGS'][:]
        cache_options = dict(default_timeout= \
                             self.config['CACHE_DEFAULT_TIMEOUT'])

        if self.config['CACHE_OPTIONS']:
            cache_options.update(self.config['CACHE_OPTIONS'])

        self.cache = cache_obj(self.app, self.config, cache_args, cache_options)

        if not isinstance(self.cache, BaseCache):
            raise TypeError("Cache object must subclass "
                            "werkzeug.contrib.cache.BaseCache")

    def get(self, *args, **kwargs):
        "Proxy function for internal cache object."
        return self.cache.get(*args, **kwargs)

    def set(self, *args, **kwargs):
        "Proxy function for internal cache object."
        self.cache.set(*args, **kwargs)

    def add(self, *args, **kwargs):
        "Proxy function for internal cache object."
        self.cache.add(*args, **kwargs)

    def delete(self, *args, **kwargs):
        "Proxy function for internal cache object."
        self.cache.delete(*args, **kwargs)

    def delete_many(self, *args, **kwargs):
        "Proxy function for internal cache object."
        self.cache.delete_many(*args, **kwargs)

    def cached(self, timeout=None, key_prefix='view/%s', unless=None):
        """
        Decorator. Use this to cache a function. By default the cache key
        is `view/request.path`. You are able to use this decorator with any
        function by changing the `key_prefix`. If the token `%s` is located
        within the `key_prefix` then it will replace that with `request.path`

        Example::

            # An example view function
            @cache.cached(timeout=50)
            def big_foo():
                return big_bar_calc()

            # An example misc function to cache.
            @cache.cached(key_prefix='MyCachedList')
            def get_list():
                return [random.randrange(0, 1) for i in range(50000)]

            my_list = get_list()

        .. note::

            You MUST have a request context to actually called any functions
            that are cached.

        .. versionadded:: 0.4
            The returned decorated function now has three function attributes
            assigned to it. These attributes are readable/writable.

                **uncached**
                    The original undecorated function

                **cache_timeout**
                    The cache timeout value for this function. For a custom value
                    to take affect, this must be set before the function is called.

                **make_cache_key**
                    A function used in generating the cache_key used.

        :param timeout: Default None. If set to an integer, will cache for that
                        amount of time. Unit of time is in seconds.
        :param key_prefix: Default 'view/%(request.path)s'. Beginning key to .
                           use for the cache key.

                           .. versionadded:: 0.3.4
                               Can optionally be a callable which takes no arguments
                               but returns a string that will be used as the cache_key.

        :param unless: Default None. Cache will *always* execute the caching
                       facilities unless this callable is true.
                       This will bypass the caching entirely.
        """

        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                #: Bypass the cache entirely.
                if callable(unless) and unless() is True:
                    return f(*args, **kwargs)

                cache_key = decorated_function.make_cache_key(*args, **kwargs)

                rv = self.cache.get(cache_key)
                if rv is None:
                    rv = f(*args, **kwargs)
                    self.cache.set(cache_key, rv,
                                   timeout=decorated_function.cache_timeout)
                return rv

            def make_cache_key(*args, **kwargs):
                if callable(key_prefix):
                    cache_key = key_prefix()
                elif '%s' in key_prefix:
                    cache_key = key_prefix % request.path
                else:
                    cache_key = key_prefix

                cache_key = cache_key.encode('utf-8')

                return cache_key

            decorated_function.uncached = f
            decorated_function.cache_timeout = timeout
            decorated_function.make_cache_key = make_cache_key

            return decorated_function
        return decorator

    def _memvname(self, funcname):
        return funcname + '_memver'

    def memoize_make_version_hash(self):
        return uuid.uuid4().bytes.encode('base64')[:6]

    def memoize_make_cache_key(self, fname, make_name=None):
        """
        Function used to create the cache_key for memoized functions.
        """
        def make_cache_key(f, *args, **kwargs):
            version_key = self._memvname(fname)
            version_data = self.cache.get(version_key)

            if version_data is None:
                version_data = self.memoize_make_version_hash()
                self.cache.set(version_key, version_data)

            cache_key = hashlib.md5()

            #: this should have to be after version_data, so that it
            #: does not break the delete_memoized functionality.
            if callable(make_name):
                altfname = make_name(fname)
            else:
                altfname = fname

            if callable(f):
                args, kwargs = self.memoize_kwargs_to_args(f, *args, **kwargs)

            try:
                updated = "{0}{1}{2}".format(altfname, args, kwargs)
            except AttributeError:
                updated = "%s%s%s" % (altfname, args, kwargs)

            cache_key.update(updated)
            cache_key = cache_key.digest().encode('base64')[:16]
            cache_key += version_data

            return cache_key
        return make_cache_key

    def memoize_kwargs_to_args(self, f, *args, **kwargs):
        #: Inspect the arguments to the function
        #: This allows the memoization to be the same
        #: whether the function was called with
        #: 1, b=2 is equivilant to a=1, b=2, etc.
        new_args = []
        arg_num = 0
        m_args = inspect.getargspec(f)[0]

        for i in range(len(m_args)):
            if i == 0 and m_args[i] in ('self', 'cls'):
                continue

            if m_args[i] in kwargs:
                new_args.append(kwargs[m_args[i]])
            elif arg_num < len(args):
                new_args.append(args[arg_num])
                arg_num += 1

        return tuple(new_args), {}

    def memoize(self, timeout=None, make_name=None, unless=None):
        """
        Use this to cache the result of a function, taking its arguments into
        account in the cache key.

        Information on
        `Memoization <http://en.wikipedia.org/wiki/Memoization>`_.

        Example::

            @cache.memoize(timeout=50)
            def big_foo(a, b):
                return a + b + random.randrange(0, 1000)

        .. code-block:: pycon

            >>> big_foo(5, 2)
            753
            >>> big_foo(5, 3)
            234
            >>> big_foo(5, 2)
            753

        .. versionadded:: 0.4
            The returned decorated function now has three function attributes
            assigned to it.

                **uncached**
                    The original undecorated function. readable only

                **cache_timeout**
                    The cache timeout value for this function. For a custom value
                    to take affect, this must be set before the function is called.

                    readable and writable

                **make_cache_key**
                    A function used in generating the cache_key used.

                    readable and writable


        :param timeout: Default None. If set to an integer, will cache for that
                        amount of time. Unit of time is in seconds.
        :param make_name: Default None. If set this is a function that accepts
                          a single argument, the function name, and returns a
                          new string to be used as the function name. If not set
                          then the function name is used.
        :param unless: Default None. Cache will *always* execute the caching
                       facilities unelss this callable is true.
                       This will bypass the caching entirely.

        .. versionadded:: 0.5
            params ``make_name``, ``unless``
        """

        def memoize(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                #: bypass cache
                if callable(unless) and unless() is True:
                    return f(*args, **kwargs)

                cache_key = decorated_function.make_cache_key(f, *args, **kwargs)

                rv = self.cache.get(cache_key)
                if rv is None:
                    rv = f(*args, **kwargs)
                    self.cache.set(cache_key, rv,
                                   timeout=decorated_function.cache_timeout)
                return rv

            fname = function_namespace(f)

            decorated_function.uncached = f
            decorated_function.cache_timeout = timeout
            decorated_function.make_cache_key = self.memoize_make_cache_key(fname,
                                                                            make_name)
            decorated_function.delete_memoized = lambda: self.delete_memoized(f)

            return decorated_function
        return memoize

    def delete_memoized(self, fname, *args, **kwargs):
        """
        Deletes the specified functions caches, based by given parameters.
        If parameters are given, only the functions that were memoized with them
        will be erased. Otherwise all the versions of the caches will be deleted.

        Example::

            @cache.memoize(50)
            def random_func():
                return random.randrange(1, 50)

            @cache.memoize()
            def param_func(a, b):
                return a+b+random.randrange(1, 50)

        .. code-block:: pycon

            >>> random_func()
            43
            >>> random_func()
            43
            >>> cache.delete_memoized('random_func')
            >>> random_func()
            16
            >>> param_func(1, 2)
            32
            >>> param_func(1, 2)
            32
            >>> param_func(2, 2)
            47
            >>> cache.delete_memoized('param_func', 1, 2)
            >>> param_func(1, 2)
            13
            >>> param_func(2, 2)
            47


        :param fname: Name of the memoized function, or a reference to the function.
        :param \*args: A list of positional parameters used with memoized function.
        :param \**kwargs: A dict of named parameters used with memoized function.

        .. note::

            Flask-Cache uses inspect to order kwargs into positional args when
            the function is memoized. If you pass a function reference into ``fname``
            instead of the function name, Flask-Cache will be able to place
            the args/kwargs in the proper order, and delete the positional cache.

            However, if ``delete_memozied`` is just called with the name of the
            function, be sure to pass in potential arguments in the same order
            as defined in your function as args only, otherwise Flask-Cache
            will not be able to compute the same cache key.

        .. note::

            Flask-Cache maintains an internal random version hash for the function.
            Using delete_memoized will only swap out the version hash, causing
            the memoize function to recompute results and put them into another key.

            This leaves any computed caches for this memoized function within the
            caching backend.

            It is recommended to use a very high timeout with memoize if using
            this function, so that when the version has is swapped, the old cached
            results would eventually be reclaimed by the caching backend.
        """
        if callable(fname):
            assert hasattr(fname, 'uncached')
            f = fname.uncached
            _fname = function_namespace(f)
        else:
            f = None
            _fname = fname

            #: print import_string(_fname)

            raise exceptions.DeprecationWarning("Deleting messages by relative name is no longer"
                          " reliable, please switch to a function reference"
                          " or use the full function import name")

        if not args and not kwargs:
            version_key = self._memvname(_fname)
            version_data = self.memoize_make_version_hash()
            self.cache.set(version_key, version_data)
        else:
            cache_key = fname.make_cache_key(f, *args, **kwargs)
            self.cache.delete(cache_key)
