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

from typing import Any, Callable, Dict, Generator, List, Optional, Type

import backoff


def retry_call(
    func: Callable[..., Any],
    *args: Any,
    strategy: Callable[..., Generator[int, None, None]] = backoff.constant,
    exception: Type[Exception] = Exception,
    fargs: Optional[List[Any]] = None,
    fkwargs: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Any:
    """
    Retry a given call.
    """
    decorated = backoff.on_exception(strategy, exception, *args, **kwargs)(func)
    fargs = fargs or []
    fkwargs = fkwargs or {}
    return decorated(*fargs, **fkwargs)
