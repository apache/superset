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
from typing import Any, Dict

from .loader import load_default_config_module, load_override_config_module
from .meta_configurations import union_values
from .utils import take_conf_keys_and_convert_to_dict

logger = logging.getLogger(__name__)


def init_config() -> Dict[Any, Any]:
    config = take_conf_keys_and_convert_to_dict(load_default_config_module())
    override_conf = take_conf_keys_and_convert_to_dict(load_override_config_module())
    return create_one_configuration_object(config, override_conf)


def create_one_configuration_object(
    left_config: Dict[str, Any], right_config: Dict[str, Any]
) -> Dict[str, Any]:
    left_config_keys = set(left_config.keys())
    right_config_keys = set(right_config.keys())
    keys_in_both = left_config_keys.intersection(right_config_keys)
    result_dict = left_config
    for key in right_config:
        if key not in keys_in_both:
            result_dict[key] = right_config[key]
        else:
            left_value = left_config[key]
            right_value = right_config[key]
            result_dict[key] = union_values(left_value, right_value, key)
    return result_dict
