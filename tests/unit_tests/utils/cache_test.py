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

# pylint: disable=import-outside-toplevel, unused-argument

from typing import Any
from unittest.mock import MagicMock

from pytest_mock import MockerFixture


def test_memoized_func(mocker: MockerFixture) -> None:
    """
    Test the ``memoized_func`` decorator.
    """
    from superset.utils.cache import memoized_func

    cache = mocker.MagicMock()

    decorator = memoized_func("db:{self.id}:schema:{schema}:view_list", cache)
    decorated = decorator(lambda self, schema, cache=False: 42)

    self = mocker.MagicMock()
    self.id = 1

    # skip cache
    result = decorated(self, "public", cache=False)
    assert result == 42
    cache.get.assert_not_called()

    # check cache, no cached value
    cache.get.return_value = None
    result = decorated(self, "public", cache=True)
    assert result == 42
    cache.get.assert_called_with("db:1:schema:public:view_list")

    # check cache, cached value
    cache.get.return_value = 43
    result = decorated(self, "public", cache=True)
    assert result == 43


def _make_cache_instance(mocker: MockerFixture) -> MagicMock:
    """A cache instance whose ``.cache`` is not a ``NullCache``."""
    cache_instance = mocker.MagicMock()
    cache_instance.cache = object()
    return cache_instance


def _patch_config(mocker: MockerFixture, **overrides: Any) -> dict[str, Any]:
    config = {
        "CACHE_DEFAULT_TIMEOUT": 100,
        "STATS_LOGGER": mocker.MagicMock(),
        "STORE_CACHE_KEYS_IN_METADATA_DB": False,
        "DATA_CACHE_MAX_VALUE_SIZE": None,
    }
    config.update(overrides)
    mocker.patch("superset.utils.cache.app.config", config)
    return config


def test_set_and_log_cache_under_threshold(mocker: MockerFixture) -> None:
    """A value under DATA_CACHE_MAX_VALUE_SIZE is cached normally."""
    from superset.utils.cache import set_and_log_cache

    config = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "small"})

    cache_instance.set.assert_called_once()
    config["STATS_LOGGER"].incr.assert_any_call("set_cache_key")
    assert (
        mocker.call("skip_cache_value_too_large")
        not in config["STATS_LOGGER"].incr.mock_calls
    )


def test_set_and_log_cache_over_threshold(mocker: MockerFixture) -> None:
    """A value exceeding DATA_CACHE_MAX_VALUE_SIZE is not cached."""
    from superset.utils.cache import set_and_log_cache

    config = _patch_config(
        mocker,
        DATA_CACHE_MAX_VALUE_SIZE=10,
        STORE_CACHE_KEYS_IN_METADATA_DB=True,
    )
    cache_instance = _make_cache_instance(mocker)
    mock_session = mocker.patch("superset.utils.cache.db.session")

    set_and_log_cache(
        cache_instance,
        "my_key",
        {"df": "a value large enough to exceed the tiny threshold"},
        datasource_uid="1__table",
    )

    cache_instance.set.assert_not_called()
    config["STATS_LOGGER"].incr.assert_called_once_with("skip_cache_value_too_large")
    assert mocker.call("set_cache_key") not in config["STATS_LOGGER"].incr.mock_calls
    mock_session.add.assert_not_called()


def test_set_and_log_cache_disabled_no_serialization(mocker: MockerFixture) -> None:
    """When the limit is None (default), no pickling overhead is incurred."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=None)
    cache_instance = _make_cache_instance(mocker)
    mock_dumps = mocker.patch("superset.utils.cache.pickle.dumps")

    set_and_log_cache(cache_instance, "my_key", {"df": "small"})

    cache_instance.set.assert_called_once()
    mock_dumps.assert_not_called()


def test_set_and_log_cache_null_cache(mocker: MockerFixture) -> None:
    """A NullCache backend short-circuits before any set."""
    from flask_caching.backends import NullCache

    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10)
    cache_instance = mocker.MagicMock()
    cache_instance.cache = NullCache()

    set_and_log_cache(cache_instance, "my_key", {"df": "small"})

    cache_instance.set.assert_not_called()


def test_set_and_log_cache_disabled_timeout(mocker: MockerFixture) -> None:
    """A timeout of -1 (CACHE_DISABLED_TIMEOUT) short-circuits before any set."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker)
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "small"}, cache_timeout=-1)

    cache_instance.set.assert_not_called()


def test_set_and_log_cache_equal_threshold(mocker: MockerFixture) -> None:
    """A value whose size EQUALS the threshold is still cached (guard is ``>``)."""
    import pickle

    from superset.utils.cache import set_and_log_cache

    cache_value = {"df": "boundary"}
    # Compute the exact serialized size the function will see, including the
    # injected ``dttm`` field, so we can set the threshold to that exact value.
    dttm = "2021-01-01T00:00:00"
    value = {**cache_value, "dttm": dttm}
    exact_size = len(pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL))

    config = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=exact_size)
    cache_instance = _make_cache_instance(mocker)
    # Pin the timestamp so the pickled size matches ``exact_size`` deterministically.
    mock_datetime = mocker.patch("superset.utils.cache.datetime")
    mock_datetime.now.return_value.replace.return_value.isoformat.return_value = dttm

    set_and_log_cache(cache_instance, "my_key", cache_value)

    cache_instance.set.assert_called_once()
    config["STATS_LOGGER"].incr.assert_any_call("set_cache_key")
    assert (
        mocker.call("skip_cache_value_too_large")
        not in config["STATS_LOGGER"].incr.mock_calls
    )


def test_set_and_log_cache_over_threshold_no_datasource(mocker: MockerFixture) -> None:
    """Over-threshold with no datasource_uid: skipped, and no metadata-DB write."""
    from superset.utils.cache import set_and_log_cache

    config = _patch_config(
        mocker,
        DATA_CACHE_MAX_VALUE_SIZE=10,
        STORE_CACHE_KEYS_IN_METADATA_DB=True,
    )
    cache_instance = _make_cache_instance(mocker)
    mock_session = mocker.patch("superset.utils.cache.db.session")

    set_and_log_cache(
        cache_instance,
        "my_key",
        {"df": "a value large enough to exceed the tiny threshold"},
    )

    cache_instance.set.assert_not_called()
    config["STATS_LOGGER"].incr.assert_called_once_with("skip_cache_value_too_large")
    mock_session.add.assert_not_called()


def test_set_and_log_cache_over_threshold_warns(mocker: MockerFixture) -> None:
    """The over-threshold branch emits a warning naming the key and sizes."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10)
    cache_instance = _make_cache_instance(mocker)
    mock_logger = mocker.patch("superset.utils.cache.logger")

    set_and_log_cache(
        cache_instance,
        "my_key",
        {"df": "a value large enough to exceed the tiny threshold"},
    )

    mock_logger.warning.assert_called_once()
    warning_args = mock_logger.warning.call_args.args
    assert "exceeds DATA_CACHE_MAX_VALUE_SIZE" in warning_args[0]
    assert "my_key" in warning_args


def test_set_and_log_cache_under_threshold_metadata_db(mocker: MockerFixture) -> None:
    """Under-threshold with datasource_uid + metadata-DB storage writes a CacheKey."""
    from superset.utils.cache import set_and_log_cache

    config = _patch_config(
        mocker,
        DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024,
        STORE_CACHE_KEYS_IN_METADATA_DB=True,
    )
    cache_instance = _make_cache_instance(mocker)
    mock_session = mocker.patch("superset.utils.cache.db.session")
    mock_cache_key = mocker.patch("superset.utils.cache.CacheKey")

    set_and_log_cache(
        cache_instance,
        "my_key",
        {"df": "small"},
        cache_timeout=42,
        datasource_uid="1__table",
    )

    cache_instance.set.assert_called_once()
    config["STATS_LOGGER"].incr.assert_any_call("set_cache_key")
    mock_cache_key.assert_called_once_with(
        cache_key="my_key",
        cache_timeout=42,
        datasource_uid="1__table",
    )
    mock_session.add.assert_called_once_with(mock_cache_key.return_value)


def test_set_and_log_cache_set_failure_logs(mocker: MockerFixture) -> None:
    """A failure inside the try block is caught and logged as 'Could not cache key'."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=None)
    cache_instance = _make_cache_instance(mocker)
    boom = RuntimeError("backend down")
    cache_instance.set.side_effect = boom
    mock_logger = mocker.patch("superset.utils.cache.logger")

    # Should not raise despite the backend failure.
    set_and_log_cache(cache_instance, "my_key", {"df": "small"})

    mock_logger.warning.assert_called_once_with("Could not cache key %s", "my_key")
    mock_logger.exception.assert_called_once_with(boom)
