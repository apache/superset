from flask import request

from superset import tables_cache


def view_cache_key(*unused_args, **unused_kwargs):
    args_hash = hash(frozenset(request.args.items()))
    return 'view/{}/{}'.format(request.path, args_hash)


def memoized_func(timeout=5 * 60, key=view_cache_key):
    """Use this decorator to cache functions that have predefined first arg.

    memoized_func uses simple_cache and stored the data in memory.
    Key is a callable function that takes function arguments and
    returns the caching key.
    """
    def wrap(f):
        if tables_cache:
            def wrapped_f(cls, *args, **kwargs):
                cache_key = key(*args, **kwargs)
                o = tables_cache.get(cache_key)
                if not kwargs['force'] and o is not None:
                    return o
                o = f(cls, *args, **kwargs)
                tables_cache.set(cache_key, o, timeout=timeout)
                return o
        else:
            # noop
            def wrapped_f(cls, *args, **kwargs):
                return f(cls, *args, **kwargs)
        return wrapped_f
    return wrap
