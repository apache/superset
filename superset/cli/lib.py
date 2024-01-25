#!/usr/bin/env python
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

from superset import config

logger = logging.getLogger(__name__)


feature_flags = config.DEFAULT_FEATURE_FLAGS.copy()
feature_flags.update(config.FEATURE_FLAGS)
feature_flags_func = config.GET_FEATURE_FLAGS_FUNC
if feature_flags_func:
    try:
        # pylint: disable=not-callable
        feature_flags = feature_flags_func(feature_flags)
    except Exception:  # pylint: disable=broad-except
        # bypass any feature flags that depend on context
        # that's not available
        pass


def normalize_token(token_name: str) -> str:
    """
    As of click>=7, underscores in function names are replaced by dashes.
    To avoid the need to rename all cli functions, e.g. load_examples to
    load-examples, this function is used to convert dashes back to
    underscores.

    :param token_name: token name possibly containing dashes
    :return: token name where dashes are replaced with underscores
    """
    return token_name.replace("_", "-")
