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
from contextlib2 import contextmanager
from datetime import datetime, timedelta
from functools import wraps
import logging

from flask import request

from superset import cache
from superset.utils.dates import now_as_float


@contextmanager
def stats_timing(stats_key, stats_logger):
    """Provide a transactional scope around a series of operations."""
    start_ts = now_as_float()
    try:
        yield start_ts
    except Exception as e:
        raise e
    finally:
        stats_logger.timing(stats_key, now_as_float() - start_ts)


def etag_cache(max_age, *additional_args):
    """
    A decorator for caching views and handling etag conditional requests.

    The decorator caches the response, returning headers for etag and last
    modified. If the client makes a request that matches, the server will
    return a "304 Not Mofified" status.

    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                # build the cache key from the function arguments and any other
                # additional GET arguments (like `form_data`, eg).
                key_args = list(args[1:])
                key_args.extend(request.args.get(arg) for arg in additional_args)
                cache_key = wrapper.make_cache_key(f, key_args, **kwargs)
                response = cache.get(cache_key)
            except Exception:
                logging.exception('Exception possibly due to cache backend.')
                return f(*args, **kwargs)

            if response is None or request.method == 'POST':
                response = f(*args, **kwargs)
                response.cache_control.max_age = max_age
                response.cache_control.public = True
                response.last_modified = datetime.utcnow()
                response.expires = response.last_modified + timedelta(seconds=max_age)
                response.add_etag()
                try:
                    cache.set(cache_key, response, timeout=max_age)
                except Exception:
                    logging.exception("Exception possibly due to cache backend.")

            return response.make_conditional(request)

        wrapper.uncached = f
        wrapper.cache_timeout = max_age
        wrapper.make_cache_key = cache._memoize_make_cache_key(make_name=None, timeout=max_age)
        return wrapper

    return decorator
