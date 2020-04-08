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

from contextlib2 import contextmanager
from flask import request

from superset import app, cache
from superset.utils.dates import now_as_float

# If a user sets `max_age` to 0, for long the browser should cache the
# resource? Flask-Caching will cache forever, but for the HTTP header we need
# to specify a "far future" date.
FAR_FUTURE = 365 * 24 * 60 * 60  # 1 year in seconds
logger = logging.getLogger(__name__)


@contextmanager
def stats_timing(stats_key, stats_logger):
    """Provide a transactional scope around a series of operations."""
    start_ts = now_as_float()
    try:
        yield start_ts
    except Exception as ex:
        raise ex
    finally:
        stats_logger.timing(stats_key, now_as_float() - start_ts)


def etag_cache(max_age, check_perms=bool):
    """
    A decorator for caching views and handling etag conditional requests.

    The decorator adds headers to GET requests that help with caching: Last-
    Modified, Expires and ETag. It also handles conditional requests, when the
    client send an If-Matches header.

    If a cache is set, the decorator will cache GET responses, bypassing the
    dataframe serialization. POST requests will still benefit from the
    dataframe cache for requests that produce the same SQL.

    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # check if the user can access the resource
            check_perms(*args, **kwargs)

            # for POST requests we can't set cache headers, use the response
            # cache nor use conditional requests; this will still use the
            # dataframe cache in `superset/viz.py`, though.
            if request.method == "POST":
                return f(*args, **kwargs)

            response = None
            if cache:
                try:
                    # build the cache key from the function arguments and any
                    # other additional GET arguments (like `form_data`, eg).
                    key_args = list(args)
                    key_kwargs = kwargs.copy()
                    key_kwargs.update(request.args)
                    cache_key = wrapper.make_cache_key(f, *key_args, **key_kwargs)
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
                expiration = max_age if max_age != 0 else FAR_FUTURE
                response.expires = response.last_modified + timedelta(
                    seconds=expiration
                )
                response.add_etag()

                # if we have a cache, store the response from the request
                if cache:
                    try:
                        cache.set(cache_key, response, timeout=max_age)
                    except Exception:  # pylint: disable=broad-except
                        if app.debug:
                            raise
                    logger.exception("Exception possibly due to cache backend.")

            return response.make_conditional(request)

        if cache:
            wrapper.uncached = f
            wrapper.cache_timeout = max_age
            wrapper.make_cache_key = cache._memoize_make_cache_key(  # pylint: disable=protected-access
                make_name=None, timeout=max_age
            )

        return wrapper

    return decorator
