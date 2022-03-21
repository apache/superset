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
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING, Union

from flask import current_app as app, request
from flask_caching import Cache
from flask_caching.backends import NullCache
from werkzeug.wrappers.etag import ETagResponseMixin

from superset import db
from superset.extensions import cache_manager
from superset.models.cache import CacheKey
from superset.utils.core import json_int_dttm_ser
from superset.utils.hashing import md5_sha_from_dict

if TYPE_CHECKING:
    from superset.stats_logger import BaseStatsLogger

config = app.config
stats_logger: BaseStatsLogger = config["STATS_LOGGER"]
logger = logging.getLogger(__name__)


def generate_cache_key(values_dict: Dict[str, Any], key_prefix: str = "") -> str:
    hash_str = md5_sha_from_dict(values_dict, default=json_int_dttm_ser)
    return f"{key_prefix}{hash_str}"


def set_and_log_cache(
    cache_instance: Cache,
    cache_key: str,
    cache_value: Dict[str, Any],
    cache_timeout: Optional[int] = None,
    datasource_uid: Optional[str] = None,
) -> None:
    if isinstance(cache_instance.cache, NullCache):
        return

    timeout = (
        cache_timeout
        if cache_timeout is not None
        else app.config["CACHE_DEFAULT_TIMEOUT"]
    )
    try:
        dttm = datetime.utcnow().isoformat().split(".")[0]
        value = {**cache_value, "dttm": dttm}
        cache_instance.set(cache_key, value, timeout=timeout)
        stats_logger.incr("set_cache_key")

        if datasource_uid and config["STORE_CACHE_KEYS_IN_METADATA_DB"]:
            ck = CacheKey(
                cache_key=cache_key,
                cache_timeout=cache_timeout,
                datasource_uid=datasource_uid,
            )
            db.session.add(ck)
    except Exception as ex:  # pylint: disable=broad-except
        # cache.set call can fail if the backend is down or if
        # the key is too large or whatever other reasons
        logger.warning("Could not cache key %s", cache_key)
        logger.exception(ex)


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
    cache: Cache = cache_manager.cache,
    get_last_modified: Optional[Callable[..., datetime]] = None,
    max_age: Optional[Union[int, float]] = None,
    raise_for_access: Optional[Callable[..., Any]] = None,
    skip: Optional[Callable[..., bool]] = None,
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
            # Check if the user can access the resource
            if raise_for_access:
                try:
                    raise_for_access(*args, **kwargs)
                except Exception:  # pylint: disable=broad-except
                    # If there's no access, bypass the cache and let the function
                    # handle the response.
                    return f(*args, **kwargs)

            # for POST requests we can't set cache headers, use the response
            # cache nor use conditional requests; this will still use the
            # dataframe cache in `superset/viz.py`, though.
            if request.method == "POST" or (skip and skip(*args, **kwargs)):
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

            # Check if the cache is stale. Default the content_changed_time to now
            # if we don't know when it was last modified.
            content_changed_time = datetime.utcnow()
            if get_last_modified:
                content_changed_time = get_last_modified(*args, **kwargs)
                if (
                    response
                    and response.last_modified
                    and response.last_modified.timestamp()
                    < content_changed_time.timestamp()
                ):
                    # Bypass the cache if the response is stale
                    response = None

            # if no response was cached, compute it using the wrapped function
            if response is None:
                response = f(*args, **kwargs)

                # add headers for caching: Last Modified, Expires and ETag
                # always revalidate the cache if we're checking permissions or
                # if the response was modified
                if get_last_modified or raise_for_access:
                    # `Cache-Control: no-cache` asks the browser to always store
                    # the cache, but also must validate it with the server.
                    response.cache_control.no_cache = True
                else:
                    # `Cache-Control: Public` asks the browser to always store
                    # the cache.
                    response.cache_control.public = True

                response.last_modified = content_changed_time
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
