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
from pytest_mock import MockerFixture

from superset import is_feature_enabled


def dummy_is_feature_enabled(feature_flag_name: str, default: bool = True) -> bool:
    return True if feature_flag_name.startswith("True_") else default


def test_existing_feature_flags(mocker: MockerFixture) -> None:
    """
    Test that ``is_feature_enabled`` reads flags correctly.
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"FOO": True},
        clear=True,
    )
    assert is_feature_enabled("FOO") is True


def test_nonexistent_feature_flags(mocker: MockerFixture) -> None:
    """
    Test that ``is_feature_enabled`` returns ``False`` when flag not set.
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags", {}, clear=True
    )
    assert is_feature_enabled("FOO") is False


def test_is_feature_enabled(mocker: MockerFixture) -> None:
    """
    Test ``_is_feature_enabled_func``.
    """
    mocker.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"True_Flag1": False, "True_Flag2": True, "Flag3": False, "Flag4": True},
        clear=True,
    )
    mocker.patch(
        "superset.extensions.feature_flag_manager._is_feature_enabled_func",
        dummy_is_feature_enabled,
    )

    assert is_feature_enabled("True_Flag1") is True
    assert is_feature_enabled("True_Flag2") is True
    assert is_feature_enabled("Flag3") is False
    assert is_feature_enabled("Flag4") is True


def _make_app(feature_flags: dict[str, bool], get_func=None, is_func=None):
    """Minimal object exposing the config keys FeatureFlagManager.init_app reads."""

    class _App:
        config = {
            "GET_FEATURE_FLAGS_FUNC": get_func,
            "IS_FEATURE_ENABLED_FUNC": is_func,
            "DEFAULT_FEATURE_FLAGS": {},
            "FEATURE_FLAGS": feature_flags,
        }

    return _App()


def test_global_async_queries_force_enables_gtf() -> None:
    """GLOBAL_ASYNC_QUERIES force-enables GLOBAL_TASK_FRAMEWORK (async runs on GTF)."""
    from superset.utils.feature_flag_manager import FeatureFlagManager

    manager = FeatureFlagManager()
    manager.init_app(_make_app({"GLOBAL_ASYNC_QUERIES": True}))
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK") is True


def test_gtf_not_enabled_without_global_async_queries() -> None:
    from superset.utils.feature_flag_manager import FeatureFlagManager

    manager = FeatureFlagManager()
    manager.init_app(_make_app({"GLOBAL_ASYNC_QUERIES": False}))
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK") is False


def test_gaq_implies_gtf_via_is_feature_enabled_func() -> None:
    """The derived GAQ→GTF rule holds even when IS_FEATURE_ENABLED_FUNC resolves
    GAQ on but GTF off — otherwise async chart requests would schedule work that
    .schedule() rejects."""
    from superset.utils.feature_flag_manager import FeatureFlagManager

    def is_func(name: str, default: bool) -> bool:
        return name == "GLOBAL_ASYNC_QUERIES"  # GAQ on, everything else (GTF) off

    manager = FeatureFlagManager()
    manager.init_app(
        _make_app(
            {"GLOBAL_ASYNC_QUERIES": False, "GLOBAL_TASK_FRAMEWORK": False},
            is_func=is_func,
        )
    )
    assert manager.is_feature_enabled("GLOBAL_ASYNC_QUERIES") is True
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK") is True
    assert manager.get_feature_flags()["GLOBAL_TASK_FRAMEWORK"] is True


def test_gaq_implies_gtf_via_get_feature_flags_func() -> None:
    """Same derived rule when GET_FEATURE_FLAGS_FUNC returns GAQ on / GTF off."""
    from superset.utils.feature_flag_manager import FeatureFlagManager

    def get_func(defaults: dict[str, bool]) -> dict[str, bool]:
        return {"GLOBAL_ASYNC_QUERIES": True, "GLOBAL_TASK_FRAMEWORK": False}

    manager = FeatureFlagManager()
    manager.init_app(_make_app({}, get_func=get_func))
    assert manager.get_feature_flags()["GLOBAL_TASK_FRAMEWORK"] is True
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK") is True


def test_callback_gtf_stays_off_when_gaq_off() -> None:
    """The derived rule only fires when GAQ is on; it never turns GTF on otherwise."""
    from superset.utils.feature_flag_manager import FeatureFlagManager

    def is_func(name: str, default: bool) -> bool:
        return False  # everything off

    manager = FeatureFlagManager()
    manager.init_app(
        _make_app(
            {"GLOBAL_ASYNC_QUERIES": False, "GLOBAL_TASK_FRAMEWORK": False},
            is_func=is_func,
        )
    )
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK") is False
