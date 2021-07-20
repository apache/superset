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
import hashlib
from typing import Any, Callable, Dict, Optional

import simplejson as json


def md5_sha_from_str(val: str) -> str:
    return hashlib.md5(val.encode("utf-8")).hexdigest()


def md5_sha_from_dict(
    obj: Dict[Any, Any],
    ignore_nan: bool = False,
    default: Optional[Callable[[Any], Any]] = None,
) -> str:
    json_data = json.dumps(obj, sort_keys=True, ignore_nan=ignore_nan, default=default)

    return md5_sha_from_str(json_data)
