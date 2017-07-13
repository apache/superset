# -*- coding: utf-8 -*-
"""
    flask.ext.cache
    ~~~~~~~~~~~~~~

    Adds cache support to your application.

    :copyright: (c) 2010 by Thadeus Burgess.
    :license: BSD, see LICENSE for more details
"""

__version__ = '0.12'
__versionfull__ = __version__

import base64
import functools
import hashlib
import inspect
import logging
import string
import uuid
import warnings

from werkzeug import import_string
from flask import request, current_app

from ._compat import PY2

logger = logging.getLogger(__name__)

TEMPLATE_FRAGMENT_KEY_TEMPLATE = '_template_fragment_cache_%s%s'

# Used to remove control characters and whitespace from cache keys.
valid_chars = set(string.ascii_letters + string.digits + '_.')
delchars = ''.join(c for c in map(chr, range(256)) if c not in valid_chars)
if PY2:
    null_control = (None, delchars)
else:
    null_control = (dict((k,None) for k in delchars),)

def function_namespace(f, args=None, per_instance=False):
    """
    Attempts to returns unique namespace for function
    """
    m_args = inspect.getargspec(f)[0]
    tokens = []

    if len(m_args) and args:
        if m_args[0] == 'self':
            tokens.extend((f.__module__,
                           args[0].__class__.__name__,
                           f.__name__))
        elif m_args[0] == 'cls':
            tokens.extend((f.__module__,
                           args[0].__name__,
                           f.__name__))
        if tokens:
            if per_instance:
                tokens.append(repr(args[0]))

    if not tokens:
        if hasattr(f, '__func__'):
            tokens.extend((f.__module__,
                           f.__self__.__class__.__name__,
                           f.__name__))

            if per_instance:
                tokens.append(repr(f.__self__))

        elif hasattr(f, '__class__'):
            tokens.extend((f.__module__,
                           f.__class__.__name__,
                           f.__name__))
        else:
            tokens.extend((f.__module__,
                           f.__name__))

    ns = '.'.join((str(token).translate(*null_control) for token in tokens))

    return ns


def make_template_fragment_key(fragment_name, vary_on=[]):
    """
    Make a cache key for a specific fragment name
    """
    if vary_on:
        fragment_name = "%s_" % fragment_name
    return TEMPLATE_FRAGMENT_KEY_TEMPLATE % (fragment_name, "_".join(vary_on))


#: Cache Object
################

class Cache(object):
    """
    This class is used to control the cache objects.
    """

    def __init__(self, app=None, with_jinja2_ext=True, config=None):
        self.with_jinja2_ext = with_jinja2_ext
        self.config = config

        self.app = app
        if app is not None:
            self.init_app(app, config)

    def init_app(self, app, config=None):
        "This is used to initialize cache with your app object"
        if not (config is None or isinstance(config, dict)):
            raise ValueError("`config` must be an instance of dict or None")

        if config is None:
            config = self.config
        if config is None:
            config = app.config

        config.setdefault('CACHE_DEFAULT_TIMEOUT', 300)
        config.setdefault('CACHE_THRESHOLD', 500)
        config.setdefault('CACHE_KEY_PREFIX', 'flask_cache_')
        config.setdefault('CACHE_MEMCACHED_SERVERS', None)
        config.setdefault('CACHE_DIR', None)
        config.setdefault('CACHE_OPTIONS', None)
        config.setdefault('CACHE_ARGS', [])
        config.setdefault('CACHE_TYPE', 'null')
        config.setdefault('CACHE_NO_NULL_WARNING', False)

        if config['CACHE_TYPE'] == 'null' and not config['CACHE_NO_NULL_WARNING']:
            warnings.warn("Flask-Cache: CACHE_TYPE is set to null, "
                          "caching is effectively disabled.")

        if self.with_jinja2_ext:
            from .jinja2ext import CacheExtension, JINJA_CACHE_ATTR_NAME

            setattr(app.jinja_env, JINJA_CACHE_ATTR_NAME, self)
            app.jinja_env.add_extension(CacheExtension)

        self._set_cache(app, config)

    def _set_cache(self, app, config):
        import_me = config['CACHE_TYPE']
        if '.' not in import_me:
            from . import backends

            try:
                cache_obj = getattr(backends, import_me)
            except AttributeError:
                raise ImportError("%s is not a valid FlaskCache backend" % (
                                  import_me))
        else:
            cache_obj = import_string(import_me)

        cache_args = config['CACHE_ARGS'][:]
        cache_options = {'default_timeout': config['CACHE_DEFAULT_TIMEOUT']}

        if config['CACHE_OPTIONS']:
            cache_options.update(config['CACHE_OPTIONS'])

        if not hasattr(app, 'extensions'):
            app.extensions = {}

        app.extensions.setdefault('cache', {})
        app.extensions['cache'][self] = cache_obj(
                app, config, cache_args, cache_options)

    @property
    def cache(self):
        app = self.app or current_app
        return app.extensions['cache'][self]

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

    def clear(self):
        "Proxy function for internal cache object."
        self.cache.clear()

    def get_many(self, *args, **kwargs):
        "Proxy function for internal cache object."
        return self.cache.get_many(*args, **kwargs)

    def set_many(self, *args, **kwargs):
        "Proxy function for internal cache object."
        self.cache.set_many(*args, **kwargs)

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
            @functools.wraps(f)
            def decorated_function(*args, **kwargs):
                #: Bypass the cache entirely.
                if callable(unless) and unless() is True:
                    return f(*args, **kwargs)

                try:
                    cache_key = decorated_function.make_cache_key(*args, **kwargs)
                    rv = self.cache.get(cache_key)
                except Exception:
                    if current_app.debug:
                        raise
                    logger.exception("Exception possibly due to cache backend.")
                    return f(*args, **kwargs)

                if rv is None:
                    rv = f(*args, **kwargs)
                    try:
                        self.cache.set(cache_key, rv,
                                   timeout=decorated_function.cache_timeout)
                    except Exception:
                        if current_app.debug:
                            raise
                        logger.exception("Exception possibly due to cache backend.")
                        return f(*args, **kwargs)
                return rv

            def make_cache_key(*args, **kwargs):
                if callable(key_prefix):
                    cache_key = key_prefix()
                elif '%s' in key_prefix:
                    cache_key = key_prefix % request.path
                else:
                    cache_key = key_prefix

                cache_key = cache_key.encode('ascii')

                return cache_key

            decorated_function.uncached = f
            decorated_function.cache_timeout = timeout
            decorated_function.make_cache_key = make_cache_key

            return decorated_function
        return decorator

    def _memvname(self, funcname):
        return funcname + '_memver'

    def _memoize_make_version_hash(self):
        return base64.b64encode(uuid.uuid4().bytes)[:6].decode('ascii')

    def _memoize_version(self, f, args, per_instance=False,
                         reset=False, delete=False):
        """
        Updates the hash version associated with a memoized function or method.
        """
        fname = function_namespace(f, args)
        version_key = self._memvname(fname)
        fetch_keys = [version_key]

        if per_instance:
            fname = function_namespace(f, args, per_instance=True)
            instance_version_key = self._memvname(fname)
            fetch_keys.append(instance_version_key)

        # Only delete the per-instance version key or per-function version
        # key but not both.
        if delete:
            self.cache.delete_many(fetch_keys[-1])
            return fname, None

        version_data_list = self.cache.get_many(*fetch_keys)
        dirty = False

        if version_data_list[0] is None:
            version_data_list[0] = self._memoize_make_version_hash()
            dirty = True

        if per_instance and version_data_list[1] is None:
            version_data_list[1] = self._memoize_make_version_hash()
            dirty = True

        # Only reset the per-instance version or the per-function version
        # but not both.
        if reset:
            fetch_keys = fetch_keys[-1:]
            version_data_list = [self._memoize_make_version_hash()]
            dirty = True

        if dirty:
            self.cache.set_many(dict(zip(fetch_keys, version_data_list)))

        return fname, ''.join(version_data_list)

    def _memoize_make_cache_key(self, make_name=None, per_instance=False):
        """
        Function used to create the cache_key for memoized functions.
        """
        def make_cache_key(f, *args, **kwargs):
            fname, version_data = self._memoize_version(
                f, args, per_instance=per_instance)

            #: this should have to be after version_data, so that it
            #: does not break the delete_memoized functionality.
            if callable(make_name):
                altfname = make_name(fname)
            else:
                altfname = fname

            if callable(f):
                keyargs, keykwargs = self._memoize_kwargs_to_args(
                    f, *args, **kwargs)
            else:
                keyargs, keykwargs = args, kwargs

            try:
                updated = "{0}{1}{2}".format(altfname, keyargs, keykwargs)
            except AttributeError:
                updated = "%s%s%s" % (altfname, keyargs, keykwargs)

            cache_key = hashlib.md5()
            cache_key.update(updated.encode('ascii'))
            cache_key = base64.b64encode(cache_key.digest())[:16]
            cache_key = cache_key.decode('ascii')
            cache_key += version_data

            return cache_key
        return make_cache_key

    def _memoize_kwargs_to_args(self, f, *args, **kwargs):
        #: Inspect the arguments to the function
        #: This allows the memoization to be the same
        #: whether the function was called with
        #: 1, b=2 is equivilant to a=1, b=2, etc.
        new_args = []
        arg_num = 0
        argspec = inspect.getargspec(f)

        args_len = len(argspec.args)
        for i in range(args_len):
            if i == 0 and argspec.args[i] in ('self', 'cls'):
                #: use the repr of the class instance
                #: this supports instance methods for
                #: the memoized functions, giving more
                #: flexibility to developers
                arg = repr(args[0])
                arg_num += 1
            elif argspec.args[i] in kwargs:
                arg = kwargs[argspec.args[i]]
            elif arg_num < len(args):
                arg = args[arg_num]
                arg_num += 1
            elif abs(i-args_len) <= len(argspec.defaults):
                arg = argspec.defaults[i-args_len]
                arg_num += 1
            else:
                arg = None
                arg_num += 1

            #: Attempt to convert all arguments to a
            #: hash/id or a representation?
            #: Not sure if this is necessary, since
            #: using objects as keys gets tricky quickly.
            # if hasattr(arg, '__class__'):
            #     try:
            #         arg = hash(arg)
            #     except:
            #         arg = repr(arg)

            #: Or what about a special __cacherepr__ function
            #: on an object, this allows objects to act normal
            #: upon inspection, yet they can define a representation
            #: that can be used to make the object unique in the
            #: cache key. Given that a case comes across that
            #: an object "must" be used as a cache key
            # if hasattr(arg, '__cacherepr__'):
            #     arg = arg.__cacherepr__

            new_args.append(arg)

        return tuple(new_args), {}

    def memoize(self, timeout=None, make_name=None, unless=None,
                per_instance=False):
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

                **per_instance**
                    True when the cache versions for this function will be
                    scoped to the objects it is bound to.

                    readable only


        :param timeout: Default None. If set to an integer, will cache for that
                        amount of time. Unit of time is in seconds.
        :param make_name: Default None. If set this is a function that accepts
                          a single argument, the function name, and returns a
                          new string to be used as the function name. If not set
                          then the function name is used.
        :param unless: Default None. Cache will *always* execute the caching
                       facilities unelss this callable is true.
                       This will bypass the caching entirely.
        :param per_instance: Default False. If set to True, the cache key
                             versioning used will be scoped to the function's
                             first argument (i.e., a method's bound object).
                             This lets you cache many different calls to one
                             memoized function for a single object (like a
                             user) and later clear all data cached for that
                             object with a single call to delete_memoized.

        .. versionadded:: 0.5
            params ``make_name``, ``unless``
        """

        def memoize(f):
            @functools.wraps(f)
            def decorated_function(*args, **kwargs):
                #: bypass cache
                if callable(unless) and unless() is True:
                    return f(*args, **kwargs)

                try:
                    cache_key = decorated_function.make_cache_key(f, *args, **kwargs)
                    rv = self.cache.get(cache_key)
                except Exception:
                    if current_app.debug:
                        raise
                    logger.exception("Exception possibly due to cache backend.")
                    return f(*args, **kwargs)

                if rv is None:
                    rv = f(*args, **kwargs)
                    try:
                        self.cache.set(cache_key, rv,
                                   timeout=decorated_function.cache_timeout)
                    except Exception:
                        if current_app.debug:
                            raise
                        logger.exception("Exception possibly due to cache backend.")
                        return f(*args, **kwargs)
                return rv

            decorated_function.uncached = f
            decorated_function.cache_timeout = timeout
            decorated_function.per_instance = per_instance
            decorated_function.make_cache_key = self._memoize_make_cache_key(
                make_name=make_name, per_instance=per_instance)

            return decorated_function
        return memoize

    def delete_memoized(self, f, *args, **kwargs):
        """
        Deletes the specified functions caches, based by given parameters.
        If parameters are given, only the functions that were memoized with them
        will be erased. Otherwise all versions of the caches will be forgotten.

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

            If the memoized function has the ``per_instance`` option, then
            only the cache items for the object (as first argument or bound to
            the method) will be cleared. To clear all cache items for a
            function for all objects, pass the unbound method (from the class).

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
            this function, rather than no timeout at all, so that when the
            version has is swapped, the old cached results would eventually be
            reclaimed by the caching backend.
        """
        if not callable(f):
            raise DeprecationWarning("Deleting messages by relative name is no longer"
                          " reliable, please switch to a function reference")

        try:
            if f.per_instance and (
                    getattr(f, '__self__', None) or len(args) == 1):
                self._memoize_version(f, args, per_instance=True, reset=True)
            elif not args and not kwargs:
                self._memoize_version(f, args, reset=True)
            else:
                cache_key = f.make_cache_key(f.uncached, *args, **kwargs)
                self.cache.delete(cache_key)
        except Exception:
            if current_app.debug:
                raise
            logger.exception("Exception possibly due to cache backend.")

    def delete_memoized_verhash(self, f, *args):
        """
        Delete the version hash associated with the function.

        ..warning::

            Performing this operation could leave keys behind that have
            been created with this version hash. It is up to the application
            to make sure that all keys that may have been created with this
            version hash at least have timeouts so they will not sit orphaned
            in the cache backend.
        """
        if not callable(f):
            raise DeprecationWarning("Deleting messages by relative name is no longer"
                          " reliable, please use a function reference")

        per_instance = (
            f.per_instance and (getattr(f, '__self__', None) or len(args) == 1))

        try:
            self._memoize_version(f, args, delete=True,
                                  per_instance=per_instance)
        except Exception:
            if current_app.debug:
                raise
            logger.exception("Exception possibly due to cache backend.")
