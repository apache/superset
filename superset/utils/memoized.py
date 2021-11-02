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
import functools
from datetime import datetime, timedelta
from typing import Any, Callable


def _memoized(seconds: int = 24 * 60 * 60, maxsize: int = 1024,) -> Callable[..., Any]:
    """
    A simple wrapper of functools.lru_cache, encapsulated for thread safety
    :param seconds: LRU expired time, seconds
    :param maxsize: LRU size
    :return: a wrapped function by LRU
    """

    def wrapper_cache(func: Callable[..., Any]) -> Callable[..., Any]:
        lru: Any = functools.lru_cache(maxsize=maxsize)(func)
        lru.lifetime = timedelta(seconds=seconds)
        lru.expiration = datetime.utcnow() + lru.lifetime

        @functools.wraps(func)
        def wrapped_func(*args: Any, **kwargs: Any) -> Callable[..., Any]:
            if datetime.utcnow() >= lru.expiration:
                lru.cache_clear()
                lru.expiration = datetime.utcnow() + lru.lifetime
            return lru(*args, **kwargs)

        return wrapped_func

    return wrapper_cache


memoized = _memoized()
