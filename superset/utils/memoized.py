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
from typing import Any, Callable, Dict, Optional, Tuple, Type


class _memoized:
    """Decorator that caches a function's return value each time it is called

    If called later with the same arguments, the cached value is returned, and
    not re-evaluated.

    Define ``watch`` as a tuple of attribute names if this Decorator
    should account for instance variable changes.
    """

    def __init__(
        self, func: Callable[..., Any], watch: Optional[Tuple[str, ...]] = None
    ) -> None:
        self.func = func
        self.cache: Dict[Any, Any] = {}
        self.is_method = False
        self.watch = watch or ()

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        key = [args, frozenset(kwargs.items())]
        if self.is_method:
            key.append(tuple([getattr(args[0], v, None) for v in self.watch]))
        key = tuple(key)  # type: ignore
        if key in self.cache:
            return self.cache[key]
        try:
            value = self.func(*args, **kwargs)
            self.cache[key] = value
            return value
        except TypeError:
            # uncachable -- for instance, passing a list as an argument.
            # Better to not cache than to blow up entirely.
            return self.func(*args, **kwargs)

    def __repr__(self) -> str:
        """Return the function's docstring."""
        return self.func.__doc__ or ""

    def __get__(
        self, obj: Any, objtype: Type[Any]
    ) -> functools.partial:  # type: ignore
        if not self.is_method:
            self.is_method = True
        # Support instance methods.
        return functools.partial(self.__call__, obj)


def memoized(
    func: Optional[Callable[..., Any]] = None, watch: Optional[Tuple[str, ...]] = None
) -> Callable[..., Any]:
    if func:
        return _memoized(func)

    def wrapper(f: Callable[..., Any]) -> Callable[..., Any]:
        return _memoized(f, watch)

    return wrapper
