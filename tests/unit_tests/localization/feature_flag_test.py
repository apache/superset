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
"""Tests for ENABLE_CONTENT_LOCALIZATION feature flag registration."""

from superset.config import DEFAULT_FEATURE_FLAGS

FEATURE_FLAG_NAME = "ENABLE_CONTENT_LOCALIZATION"


def test_enable_content_localization_flag_exists_in_default_feature_flags() -> None:
    """
    Verify ENABLE_CONTENT_LOCALIZATION exists in DEFAULT_FEATURE_FLAGS.

    The flag must be explicitly defined in config.py to ensure:
    1. The feature is discoverable via configuration
    2. The default value is documented
    3. Environment variable override works
    """
    assert FEATURE_FLAG_NAME in DEFAULT_FEATURE_FLAGS, (
        f"Feature flag '{FEATURE_FLAG_NAME}' must be defined in DEFAULT_FEATURE_FLAGS. "
        f"Add it to superset/config.py in the appropriate lifecycle section."
    )
