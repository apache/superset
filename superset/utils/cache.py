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
import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Optional, Union

from flask import current_app as app, request
from flask_caching import Cache
from werkzeug.wrappers.etag import ETagResponseMixin

from superset.extensions import cache_manager

# If a user sets `max_age` to 0, for long the browser should cache the
# resource? Flask-Caching will cache forever, but for the HTTP header we need
# to specify a "far future" date.
ONE_YEAR = 365 * 24 * 60 * 60  # 1 year in seconds

logger = logging.getLogger(__name__)


def view_cache_key(*args: Any, **kwargs: Any) -> str:  # pylint: disable=unused-argument
    args_hash = hash(frozenset(request.args.items()))
    return "view/{}/{}".format(request.path, args_hash)


def memoized_func(
    key: Callable[..., str] = view_cache_key, cache: Cache = cache_manager.cache,
) -> Callable[..., Any]:
    """Use this decorator to cache functions that have predefined first arg.

    enable_cache is treated as True by default,
    except enable_cache = False is passed to the decorated function.

    force means whether to force refresh the cache and is treated as False by default,
    except force = True is passed to the decorated function.

    timeout of cache is set to 600 seconds by default,
    except cache_timeout = {timeout in seconds} is passed to the decorated function.

    :param key: a callable function that takes function arguments and returns
                the caching key.
    :param cache: a FlaskCache instance that will store the cache.
    """

    def wrap(f: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped_f(self: Any, *args: Any, **kwargs: Any) -> Any:
            if not kwargs.get("cache", True):
                return f(self, *args, **kwargs)

            cache_key = key(self, *args, **kwargs)
            obj = cache.get(cache_key)
            if not kwargs.get("force") and obj is not None:
                return obj
            obj = f(self, *args, **kwargs)
            cache.set(cache_key, obj, timeout=kwargs.get("cache_timeout"))
            return obj

        return wrapped_f

    return wrap


def etag_cache(
    check_perms: Callable[..., Any],
    cache: Cache = cache_manager.cache,
    max_age: Optional[Union[int, float]] = None,
) -> Callable[..., Any]:
    """
    A decorator for caching views and handling etag conditional requests.

    The decorator adds headers to GET requests that help with caching: Last-
    Modified, Expires and ETag. It also handles conditional requests, when the
    client send an If-Matches header.

    If a cache is set, the decorator will cache GET responses, bypassing the
    dataframe serialization. POST requests will still benefit from the
    dataframe cache for requests that produce the same SQL.

    """
    if max_age is None:
        max_age = app.config["CACHE_DEFAULT_TIMEOUT"]

    def decorator(f: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(f)
        def wrapper(*args: Any, **kwargs: Any) -> ETagResponseMixin:
            # check if the user can access the resource
            check_perms(*args, **kwargs)

            # for POST requests we can't set cache headers, use the response
            # cache nor use conditional requests; this will still use the
            # dataframe cache in `superset/viz.py`, though.
            if request.method == "POST":
                return f(*args, **kwargs)

            response = None
            try:
                # build the cache key from the function arguments and any
                # other additional GET arguments (like `form_data`, eg).
                key_args = list(args)
                key_kwargs = kwargs.copy()
                key_kwargs.update(request.args)
                cache_key = wrapper.make_cache_key(  # type: ignore
                    f, *key_args, **key_kwargs
                )
                response = cache.get(cache_key)
            except Exception:  # pylint: disable=broad-except
                if app.debug:
                    raise
                logger.exception("Exception possibly due to cache backend.")

            # if no response was cached, compute it using the wrapped function
            if response is None:
                response = f(*args, **kwargs)

                # add headers for caching: Last Modified, Expires and ETag
                response.cache_control.public = True
                response.last_modified = datetime.utcnow()
                expiration = max_age or ONE_YEAR  # max_age=0 also means far future
                response.expires = response.last_modified + timedelta(
                    seconds=expiration
                )
                response.add_etag()

                # if we have a cache, store the response from the request
                try:
                    cache.set(cache_key, response, timeout=max_age)
                except Exception:  # pylint: disable=broad-except
                    if app.debug:
                        raise
                    logger.exception("Exception possibly due to cache backend.")

            return response.make_conditional(request)

        wrapper.uncached = f  # type: ignore
        wrapper.cache_timeout = max_age  # type: ignore
        wrapper.make_cache_key = cache._memoize_make_cache_key(  # type: ignore # pylint: disable=protected-access
            make_name=None, timeout=max_age
        )

        return wrapper

    return decorator
