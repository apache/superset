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
"""
Tests for ENABLE_CONTENT_LOCALIZATION feature flag.

This feature flag controls whether content localization is enabled.
When enabled, Dashboard and Slice models support translations for
user-generated content (titles, descriptions).
"""

from pytest_mock import MockerFixture

from superset import is_feature_enabled
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


def test_enable_content_localization_flag_default_is_false() -> None:
    """
    Verify ENABLE_CONTENT_LOCALIZATION defaults to False.

    The flag should be False by default because:
    1. Feature requires DB migration (translations column)
    2. Operators must explicitly opt-in after migration
    """
    assert DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_NAME] is False, (
        f"Feature flag '{FEATURE_FLAG_NAME}' must default to False. "
        f"This is a development feature that requires explicit opt-in."
    )


def test_is_feature_enabled_returns_false_when_flag_not_set(
    mocker: MockerFixture,
) -> None:
    """
    Verify is_feature_enabled returns False when flag is not in feature flags dict.

    This tests the fallback behavior when the flag is missing entirely.
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {},
        clear=True,
    )
    assert is_feature_enabled(FEATURE_FLAG_NAME) is False


def test_is_feature_enabled_returns_true_when_flag_enabled(
    mocker: MockerFixture,
) -> None:
    """
    Verify is_feature_enabled returns True when flag is explicitly enabled.

    This simulates an operator enabling the feature in their superset_config.py:
    FEATURE_FLAGS = {"ENABLE_CONTENT_LOCALIZATION": True}
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {FEATURE_FLAG_NAME: True},
        clear=True,
    )
    assert is_feature_enabled(FEATURE_FLAG_NAME) is True


def test_is_feature_enabled_returns_false_when_flag_disabled(
    mocker: MockerFixture,
) -> None:
    """
    Verify is_feature_enabled returns False when flag is explicitly disabled.

    This tests the case where the flag exists but is set to False.
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {FEATURE_FLAG_NAME: False},
        clear=True,
    )
    assert is_feature_enabled(FEATURE_FLAG_NAME) is False
