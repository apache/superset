from superset import simple_cache
from flask import request


def view_cache_key(*args, **kwargs):
    args_hash = hash(frozenset(request.args.items()))
    return 'view/{}/{}'.format(request.path, args_hash)


def memoized_func(timeout=5 * 60, key=view_cache_key):
    """Use this decorator to cache functions that have predefined first arg.

    memoized_func uses simple_cache and stored the data in memory.
    Key is a callable function that takes function arguments and
    returns the caching key.
    """
    def wrap(f):
        def wrapped_f(cls, *args, **kwargs):
            cache_key = key(*args, **kwargs)
            o = simple_cache.get(cache_key)
            if o is not None:
                return o
            o = f(cls, *args, **kwargs)
            print('cache_key: {}'.format(cache_key))
            simple_cache.set(cache_key, o, timeout=timeout)
            return o
        return wrapped_f
    return wrap
