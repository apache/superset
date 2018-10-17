# pylint: disable=C,R,W
from flask import request

from superset import cache, tables_cache


def view_cache_key(*unused_args, **unused_kwargs):
    args_hash = hash(frozenset(request.args.items()))
    return 'view/{}/{}'.format(request.path, args_hash)


def memoized_func(key=view_cache_key, use_tables_cache=False):
    """Use this decorator to cache functions that have predefined first arg.

    enable_cache is treated as True by default,
    except enable_cache = False is passed to the decorated function.

    force means whether to force refresh the cache and is treated as False by default,
    except force = True is passed to the decorated function.

    timeout of cache is set to 600 seconds by default,
    except cache_timeout = {timeout in seconds} is passed to the decorated function.

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
                if not kwargs.get('enable_cache', True):
                    return f(cls, *args, **kwargs)

                cache_key = key(*args, **kwargs)
                o = selected_cache.get(cache_key)
                if not kwargs.get('force') and o is not None:
                    return o
                o = f(cls, *args, **kwargs)
                selected_cache.set(cache_key, o,
                                   timeout=kwargs.get('cache_timeout', 600))
                return o
        else:
            # noop
            def wrapped_f(cls, *args, **kwargs):
                return f(cls, *args, **kwargs)
        return wrapped_f
    return wrap
