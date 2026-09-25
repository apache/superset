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


def test_memoized_func_none_cache_timeout(mocker: MockerFixture) -> None:
    """
    An explicit ``cache_timeout=None`` falls back to ``CACHE_DEFAULT_TIMEOUT``.

    Databases without a custom metadata cache timeout pass ``None`` explicitly, and
    forwarding it to the cache backend breaks backends that require an integer.
    """
    from superset.utils.cache import memoized_func

    _patch_config(mocker)
    cache = mocker.MagicMock()
    cache.get.return_value = None

    decorator = memoized_func("db:{self.id}:schema:{schema}:table_list", cache)
    decorated = decorator(lambda self, schema: 42)

    self = mocker.MagicMock()
    self.id = 1

    result = decorated(self, "public", cache_timeout=None)
    assert result == 42
    cache.set.assert_called_once_with("db:1:schema:public:table_list", 42, timeout=100)


def test_memoized_func_custom_cache_timeout(mocker: MockerFixture) -> None:
    """
    An explicit ``cache_timeout`` takes precedence over ``CACHE_DEFAULT_TIMEOUT``.
    """
    from superset.utils.cache import memoized_func

    _patch_config(mocker)
    cache = mocker.MagicMock()
    cache.get.return_value = None

    decorator = memoized_func("db:{self.id}:schema:{schema}:table_list", cache)
    decorated = decorator(lambda self, schema: 42)

    self = mocker.MagicMock()
    self.id = 1

    result = decorated(self, "public", cache_timeout=42)
    assert result == 42
    cache.set.assert_called_once_with("db:1:schema:public:table_list", 42, timeout=42)


def test_memoized_func_disabled_cache_timeout(mocker: MockerFixture) -> None:
    """
    A timeout of -1 (``CACHE_DISABLED_TIMEOUT``) skips the cache set.
    """
    from superset.utils.cache import memoized_func

    _patch_config(mocker)
    cache = mocker.MagicMock()
    cache.get.return_value = None

    decorator = memoized_func("db:{self.id}:schema:{schema}:table_list", cache)
    decorated = decorator(lambda self, schema: 42)

    self = mocker.MagicMock()
    self.id = 1

    result = decorated(self, "public", cache_timeout=-1)
    assert result == 42
    cache.set.assert_not_called()


def test_memoized_func_skip_cache_pops_cache_timeout(mocker: MockerFixture) -> None:
    """
    ``cache=False`` skips caching without touching the config or the wrapped function.

    ``cache_timeout`` must still be popped so it is not forwarded to the decorated
    function, which does not accept it. Callers such as
    ``get_all_table_names_in_schema`` pass ``cache`` and ``cache_timeout`` together.
    """
    from superset.utils.cache import memoized_func

    mock_config = mocker.patch("superset.utils.cache.app.config", MagicMock())
    cache = mocker.MagicMock()

    decorator = memoized_func("db:{self.id}:schema:{schema}:table_list", cache)
    decorated = decorator(lambda self, schema: 42)

    self = mocker.MagicMock()
    self.id = 1

    result = decorated(self, "public", cache=False, cache_timeout=None)

    assert result == 42
    cache.get.assert_not_called()
    cache.set.assert_not_called()
    mock_config.__getitem__.assert_not_called()


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


def test_set_and_log_cache_returns_persistence_outcome(mocker: MockerFixture) -> None:
    """set_and_log_cache reports whether the value was actually persisted so the
    forced-refresh idempotency marker only claims a real cache write."""
    from flask_caching.backends import NullCache

    from superset.utils.cache import set_and_log_cache

    # Persisted normally → True
    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    assert set_and_log_cache(_make_cache_instance(mocker), "k", {"df": "small"}) is True

    # Skipped for exceeding the size limit → False
    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10)
    assert (
        set_and_log_cache(_make_cache_instance(mocker), "k", {"df": "x" * 1000})
        is False
    )

    # NullCache backend → False
    _patch_config(mocker)
    null_instance = mocker.MagicMock()
    null_instance.cache = NullCache()
    assert set_and_log_cache(null_instance, "k", {"df": "small"}) is False

    # Backend write raises → False (best-effort, swallowed)
    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    failing = _make_cache_instance(mocker)
    failing.set.side_effect = RuntimeError("backend down")
    assert set_and_log_cache(failing, "k", {"df": "small"}) is False

    # Backend reports a failed write by returning False (no exception) → False.
    # cachelib backends do this; ignoring it would let the marker claim a write
    # that never landed.
    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    reports_false = _make_cache_instance(mocker)
    reports_false.set.return_value = False
    assert set_and_log_cache(reports_false, "k", {"df": "small"}) is False

    # Backend returns None (no status reported) → treated as success.
    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    reports_none = _make_cache_instance(mocker)
    reports_none.set.return_value = None
    assert set_and_log_cache(reports_none, "k", {"df": "small"}) is True


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


def test_data_cache_max_value_size_default_is_protective() -> None:
    """The shipped default caps oversized data-cache entries out of the box.

    The oversized-value skip is only effective when ``DATA_CACHE_MAX_VALUE_SIZE``
    has a value; a ``None`` default disables it and lets very large results pile
    up in the cache backend. This asserts the default is a positive cap that still
    exceeds ordinary chart/query payloads. Operators can raise it or set it to
    ``None`` explicitly.
    """
    import superset.config as config

    assert config.DATA_CACHE_MAX_VALUE_SIZE is not None
    assert isinstance(config.DATA_CACHE_MAX_VALUE_SIZE, int)
    # Comfortably above typical payloads, well below the multi-tens-of-MB outliers.
    assert 1024 * 1024 <= config.DATA_CACHE_MAX_VALUE_SIZE <= 20 * 1024 * 1024


def test_set_and_log_cache_applies_default_timeout(mocker: MockerFixture) -> None:
    """Every persisted value carries a TTL: an unset timeout falls back to
    ``CACHE_DEFAULT_TIMEOUT`` and is passed atomically to ``cache.set`` (SETEX),
    never written TTL-less. Guards against a code path that could leave a data-cache
    key with no expiry, which would let it linger in Redis indefinitely."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker)  # CACHE_DEFAULT_TIMEOUT == 100, no explicit timeout
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "small"})

    cache_instance.set.assert_called_once()
    _, kwargs = cache_instance.set.call_args
    assert kwargs["timeout"] == 100


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


def test_set_and_log_cache_shipped_default_caches_normal_payload(
    mocker: MockerFixture,
) -> None:
    """With the *shipped* default cap active, an ordinary payload still caches.

    Uses the real ``config.DATA_CACHE_MAX_VALUE_SIZE`` rather than a patched value,
    so it proves the value we actually ship does not wrongly skip typical
    chart/query results (which sit far below the cap).
    """
    import superset.config as config
    from superset.utils.cache import set_and_log_cache

    cfg = _patch_config(
        mocker, DATA_CACHE_MAX_VALUE_SIZE=config.DATA_CACHE_MAX_VALUE_SIZE
    )
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "a normal-sized result"})

    cache_instance.set.assert_called_once()
    cfg["STATS_LOGGER"].incr.assert_any_call("set_cache_key")
    assert (
        mocker.call("skip_cache_value_too_large")
        not in cfg["STATS_LOGGER"].incr.mock_calls
    )


def test_set_and_log_cache_shipped_default_skips_oversized_payload(
    mocker: MockerFixture,
) -> None:
    """With the *shipped* default cap active, an over-cap payload is skipped.

    Builds a payload larger than the real ``config.DATA_CACHE_MAX_VALUE_SIZE`` and
    asserts the end-to-end skip behavior the default exists to provide: no cache
    write, a WARNING, and the ``skip_cache_value_too_large`` counter.
    """
    import superset.config as config
    from superset.utils.cache import set_and_log_cache

    max_size = config.DATA_CACHE_MAX_VALUE_SIZE
    assert max_size is not None
    cfg = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=max_size)
    cache_instance = _make_cache_instance(mocker)
    mock_logger = mocker.patch("superset.utils.cache.logger")

    # A string this long pickles to more than ``max_size`` bytes.
    set_and_log_cache(cache_instance, "my_key", {"df": "x" * (max_size + 1024)})

    cache_instance.set.assert_not_called()
    cfg["STATS_LOGGER"].incr.assert_called_once_with("skip_cache_value_too_large")
    mock_logger.warning.assert_called_once()


def test_set_and_log_cache_one_byte_over_threshold(mocker: MockerFixture) -> None:
    """A value one byte OVER the threshold is skipped (guard is strict ``>``).

    Complements ``test_set_and_log_cache_equal_threshold`` (== is cached) by pinning
    the threshold to one below the exact serialized size.
    """
    import pickle

    from superset.utils.cache import set_and_log_cache

    cache_value = {"df": "boundary"}
    dttm = "2021-01-01T00:00:00"
    value = {**cache_value, "dttm": dttm}
    exact_size = len(pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL))

    cfg = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=exact_size - 1)
    cache_instance = _make_cache_instance(mocker)
    mock_datetime = mocker.patch("superset.utils.cache.datetime")
    mock_datetime.now.return_value.replace.return_value.isoformat.return_value = dttm

    set_and_log_cache(cache_instance, "my_key", cache_value)

    cache_instance.set.assert_not_called()
    cfg["STATS_LOGGER"].incr.assert_called_once_with("skip_cache_value_too_large")


def test_set_and_log_cache_explicit_timeout_passthrough(mocker: MockerFixture) -> None:
    """An explicit ``cache_timeout`` is forwarded verbatim to ``cache.set``,
    taking precedence over ``CACHE_DEFAULT_TIMEOUT``."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "small"}, cache_timeout=4242)

    cache_instance.set.assert_called_once()
    _, kwargs = cache_instance.set.call_args
    assert kwargs["timeout"] == 4242


def test_set_and_log_cache_zero_timeout_never_expires(mocker: MockerFixture) -> None:
    """A ``cache_timeout`` of 0 ("never expires") is preserved, not treated as
    disabled. Only ``CACHE_DISABLED_TIMEOUT`` (-1) skips the write; 0 must pass
    through to ``cache.set`` so the backend stores the key without expiry."""
    from superset.utils.cache import set_and_log_cache

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=10 * 1024 * 1024)
    cache_instance = _make_cache_instance(mocker)

    set_and_log_cache(cache_instance, "my_key", {"df": "small"}, cache_timeout=0)

    cache_instance.set.assert_called_once()
    _, kwargs = cache_instance.set.call_args
    assert kwargs["timeout"] == 0


def test_exceeds_max_cache_value_size_disabled_skips_serialization(
    mocker: MockerFixture,
) -> None:
    """With the cap set to ``None`` nothing is too large and nothing is pickled."""
    from superset.utils.cache import exceeds_max_cache_value_size

    _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=None)
    mock_dumps = mocker.patch("superset.utils.cache.pickle.dumps")

    assert exceeds_max_cache_value_size("my_key", ["x" * 1024]) is False
    mock_dumps.assert_not_called()


def test_exceeds_max_cache_value_size_boundary(mocker: MockerFixture) -> None:
    """A value exactly at the cap fits; one byte over does not and is reported."""
    import pickle

    from superset.utils.cache import exceeds_max_cache_value_size

    value = ["a", "b", "c"]
    exact_size = len(pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL))
    mock_logger = mocker.patch("superset.utils.cache.logger")

    config = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=exact_size)
    assert exceeds_max_cache_value_size("my_key", value) is False
    config["STATS_LOGGER"].incr.assert_not_called()
    mock_logger.warning.assert_not_called()

    config = _patch_config(mocker, DATA_CACHE_MAX_VALUE_SIZE=exact_size - 1)
    assert exceeds_max_cache_value_size("my_key", value) is True
    config["STATS_LOGGER"].incr.assert_called_once_with("skip_cache_value_too_large")
    mock_logger.warning.assert_called_once()
    assert mock_logger.warning.call_args.args[1:] == (
        "my_key",
        exact_size,
        exact_size - 1,
    )
