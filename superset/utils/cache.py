# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from typing import Callable, Optional

from flask import request

from superset.extensions import cache_manager


def view_cache_key(*_, **__) -> str:
    args_hash = hash(frozenset(request.args.items()))
    return "view/{}/{}".format(request.path, args_hash)


def memoized_func(
    key: Callable = view_cache_key, attribute_in_key: Optional[str] = None
) -> Callable:
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
        if cache_manager.tables_cache:

            def wrapped_f(self, *args, **kwargs):
                if not kwargs.get("cache", True):
                    return f(self, *args, **kwargs)

                if attribute_in_key:
                    cache_key = key(*args, **kwargs).format(
                        getattr(self, attribute_in_key)
                    )
                else:
                    cache_key = key(*args, **kwargs)
                o = cache_manager.tables_cache.get(cache_key)
                if not kwargs.get("force") and o is not None:
                    return o
                o = f(self, *args, **kwargs)
                cache_manager.tables_cache.set(
                    cache_key, o, timeout=kwargs.get("cache_timeout")
                )
                return o

        else:
            # noop
            def wrapped_f(self, *args, **kwargs):
                return f(self, *args, **kwargs)

        return wrapped_f

    return wrap
