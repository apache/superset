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

from types import ModuleType
from typing import Any, Dict, Type, Union

from pydash.objects import merge as merge_dicts_recursive  # pylint: disable=W0611


def take_conf_keys_and_convert_to_dict(  # pylint: disable=C0103
    module: Union[ModuleType, Type[Any], Dict[Any, Any]]
) -> Dict[Any, Any]:
    raw_dict = module if isinstance(module, dict) else module.__dict__
    return {k: v for k, v in raw_dict.items() if k.isupper() and not k.startswith("_")}
