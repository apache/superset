# pylint: disable=C,R,W
from flask import request

from superset import cache, tables_cache


def view_cache_key(*unused_args, **unused_kwargs):
    args_hash = hash(frozenset(request.args.items()))
    return 'view/{}/{}'.format(request.path, args_hash)


def default_timeout(*unused_args, **unused_kwargs):
    return 5 * 60


def default_enable_cache(*unused_args, **unused_kwargs):
    return True


def memoized_func(timeout=default_timeout,
                  key=view_cache_key,
                  enable_cache=default_enable_cache,
                  use_tables_cache=False):
    """Use this decorator to cache functions that have predefined first arg.

    If enable_cache() is False,
        the function will never be cached.
    If enable_cache() is True,
        cache is adopted and will timeout in timeout() seconds.
        If force is True, cache will be refreshed.

    memoized_func uses simple_cache and stored the data in memory.
    Key is a callable function that takes function arguments and
    returns the caching key.
    """
    def wrap(f):
        selected_cache = None
        if use_tables_cache and tables_cache:
            selected_cache = tables_cache
        elif cache:
            selected_cache = cache

        if selected_cache:
            def wrapped_f(cls, *args, **kwargs):
                if not enable_cache(*args, **kwargs):
                    return f(cls, *args, **kwargs)

                cache_key = key(*args, **kwargs)
                o = selected_cache.get(cache_key)
                if not kwargs['force'] and o is not None:
                    return o
                o = f(cls, *args, **kwargs)
                selected_cache.set(cache_key, o, timeout=timeout(*args, **kwargs))
                return o
        else:
            # noop
            def wrapped_f(cls, *args, **kwargs):
                return f(cls, *args, **kwargs)
        return wrapped_f
    return wrap
