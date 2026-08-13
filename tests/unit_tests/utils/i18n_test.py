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

from collections.abc import Iterator

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.utils import i18n

MULTI_LANG = {
    "en": {"flag": "us", "name": "English"},
    "fr": {"flag": "fr", "name": "French"},
}


@pytest.fixture(autouse=True)
def reset_hooks() -> Iterator[None]:
    """Keep hook config from leaking between tests."""
    yield
    current_app.config["TRANSLATION_HOOK"] = None
    current_app.config["TRANSLATION_BATCH_HOOK"] = None


@pytest.fixture
def fr_locale(mocker: MockerFixture) -> None:
    """Active locale resolves to French (non-default)."""

    class _Locale:
        def __str__(self) -> str:
            return "fr"

    mocker.patch.object(i18n, "get_locale", return_value=_Locale())


def _enable(mocker: MockerFixture, enabled: bool = True) -> None:
    mocker.patch.object(
        i18n.feature_flag_manager, "is_feature_enabled", return_value=enabled
    )


def test_translate_returns_original_when_feature_disabled(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker, enabled=False)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: "Ventes"

    assert i18n.translate("Sales") == "Sales"


def test_translate_returns_original_with_single_language(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = {"en": {"flag": "us", "name": "English"}}
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: "Ventes"

    # Feature flag is on, but only one language is configured -> no translation.
    assert i18n.translate("Sales") == "Sales"


def test_translate_returns_original_for_default_locale(mocker: MockerFixture) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["BABEL_DEFAULT_LOCALE"] = "en"
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: "should not be used"

    class _En:
        def __str__(self) -> str:
            return "en"

    mocker.patch.object(i18n, "get_locale", return_value=_En())
    assert i18n.translate("Sales") == "Sales"


def test_translate_returns_original_when_no_hook(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = None

    assert i18n.translate("Sales") == "Sales"


def test_translate_uses_hook_result(mocker: MockerFixture, fr_locale: None) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["BABEL_DEFAULT_LOCALE"] = "en"
    current_app.config["TRANSLATION_HOOK"] = lambda text, locale, **k: (
        "Ventes" if (text, locale) == ("Sales", "fr") else None
    )

    assert i18n.translate("Sales") == "Ventes"


def test_translate_forwards_context_to_hook(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    hook = mocker.MagicMock(return_value="Ventes")
    current_app.config["TRANSLATION_HOOK"] = hook

    i18n.translate("Sales", model_name="Slice", field_name="slice_name")

    hook.assert_called_once_with(
        "Sales", "fr", model_name="Slice", field_name="slice_name"
    )


def test_translate_falls_back_when_hook_returns_falsy(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: ""

    # Hook found no translation -> original text is preserved.
    assert i18n.translate("Sales") == "Sales"


def test_translate_falls_back_when_hook_raises(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG

    def _boom(*_a: object, **_k: object) -> str:
        raise RuntimeError("translation service down")

    current_app.config["TRANSLATION_HOOK"] = _boom

    # A broken hook must never blank out the name.
    assert i18n.translate("Sales") == "Sales"


@pytest.mark.parametrize("empty", [None, ""])
def test_translate_passes_through_empty_text(
    mocker: MockerFixture, fr_locale: None, empty: str | None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    hook = mocker.MagicMock(return_value="x")
    current_app.config["TRANSLATION_HOOK"] = hook

    assert i18n.translate(empty) == empty
    hook.assert_not_called()


def test_translate_falls_back_when_locale_is_none(mocker: MockerFixture) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: "Ventes"
    mocker.patch.object(i18n, "get_locale", return_value=None)

    assert i18n.translate("Sales") == "Sales"


def test_i18n_macro_translates_via_hook(mocker: MockerFixture, fr_locale: None) -> None:
    """The {{ i18n('...') }} Jinja macro resolves through the same hook."""
    from superset.jinja_context import i18n_macro

    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda text, locale, **k: (
        "Ventes" if (text, locale) == ("Sales", "fr") else None
    )

    assert i18n_macro("Sales") == "Ventes"


def test_i18n_macro_returns_original_when_disabled(mocker: MockerFixture) -> None:
    """When the feature is off the macro returns the source text unchanged."""
    from superset.jinja_context import i18n_macro

    _enable(mocker, enabled=False)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda *a, **k: "Ventes"

    assert i18n_macro("Sales") == "Sales"


def test_translate_many_resolves_batch_in_one_hook_call(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """The whole collection is resolved with a single batch-hook invocation."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    batch_hook = mocker.MagicMock(return_value={"Sales": "Ventes", "Costs": "Coûts"})
    current_app.config["TRANSLATION_BATCH_HOOK"] = batch_hook

    resolved = i18n.translate_many(
        ["Sales", "Costs"], model_name="Slice", field_name="slice_name"
    )

    assert resolved == {"Sales": "Ventes", "Costs": "Coûts"}
    batch_hook.assert_called_once_with(
        ["Sales", "Costs"], "fr", model_name="Slice", field_name="slice_name"
    )


def test_translate_many_falls_back_to_single_hook(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """Without a batch hook, priming still works via the per-string hook."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    hook = mocker.MagicMock(side_effect=lambda text, _locale, **_k: f"{text}-fr")
    current_app.config["TRANSLATION_HOOK"] = hook

    resolved = i18n.translate_many(["Sales", "Costs"])

    assert resolved == {"Sales": "Sales-fr", "Costs": "Costs-fr"}
    assert hook.call_count == 2


def test_translate_many_dedupes_and_skips_empty_texts(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    batch_hook = mocker.MagicMock(return_value={"Sales": "Ventes"})
    current_app.config["TRANSLATION_BATCH_HOOK"] = batch_hook

    resolved = i18n.translate_many(["Sales", "Sales", None, ""])

    assert resolved == {"Sales": "Ventes"}
    # Duplicates and empties never reach the hook.
    batch_hook.assert_called_once_with(["Sales"], "fr")


def test_translate_many_falls_back_for_untranslated_entries(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """A partial batch result keeps canonical text for the missing keys."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_BATCH_HOOK"] = lambda texts, locale, **k: {
        "Sales": "Ventes"
    }

    assert i18n.translate_many(["Sales", "Costs"]) == {
        "Sales": "Ventes",
        "Costs": "Costs",
    }


def test_translate_many_falls_back_when_batch_hook_raises(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG

    def _boom(*_a: object, **_k: object) -> dict[str, str]:
        raise RuntimeError("translation service down")

    current_app.config["TRANSLATION_BATCH_HOOK"] = _boom

    # A broken batch hook must never blank out names.
    assert i18n.translate_many(["Sales", "Costs"]) == {
        "Sales": "Sales",
        "Costs": "Costs",
    }


def test_translate_many_ignores_non_mapping_result(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """A hook returning the wrong shape degrades to canonical text."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_BATCH_HOOK"] = lambda texts, locale, **k: ["Ventes"]

    assert i18n.translate_many(["Sales"]) == {"Sales": "Sales"}


def test_translate_many_returns_original_when_feature_disabled(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker, enabled=False)
    current_app.config["LANGUAGES"] = MULTI_LANG
    batch_hook = mocker.MagicMock(return_value={"Sales": "Ventes"})
    current_app.config["TRANSLATION_BATCH_HOOK"] = batch_hook

    assert i18n.translate_many(["Sales"]) == {"Sales": "Sales"}
    batch_hook.assert_not_called()


def test_translate_routes_through_batch_hook_when_only_batch_configured(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """The batch hook is a complete replacement, not an add-on."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = None
    current_app.config["TRANSLATION_BATCH_HOOK"] = lambda texts, locale, **k: {
        "Sales": "Ventes"
    }

    assert i18n.translate("Sales") == "Ventes"


def test_prefetched_batch_serves_later_single_lookups(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """Priming a collection makes the per-item lookups free for the request."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    batch_hook = mocker.MagicMock(return_value={"Sales": "Ventes", "Costs": "Coûts"})
    current_app.config["TRANSLATION_BATCH_HOOK"] = batch_hook

    with current_app.test_request_context():
        i18n.translate_many(["Sales", "Costs"])
        assert i18n.translate("Sales") == "Ventes"
        assert i18n.translate("Costs") == "Coûts"

    # The two follow-up lookups hit the request memo, not the hook.
    batch_hook.assert_called_once()


def test_repeated_lookups_are_memoized_within_a_request(
    mocker: MockerFixture, fr_locale: None
) -> None:
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    hook = mocker.MagicMock(return_value="Ventes")
    current_app.config["TRANSLATION_HOOK"] = hook

    with current_app.test_request_context():
        assert i18n.translate("Sales") == "Ventes"
        assert i18n.translate("Sales") == "Ventes"

    hook.assert_called_once()


def test_memo_distinguishes_the_same_text_across_fields(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """Identical strings in different fields resolve independently."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    current_app.config["TRANSLATION_HOOK"] = lambda text, locale, **kwargs: (
        "Ventes" if kwargs.get("model_name") == "Slice" else "Tableau des ventes"
    )

    with current_app.test_request_context():
        assert i18n.translate("Sales", model_name="Slice") == "Ventes"
        assert i18n.translate("Sales", model_name="Dashboard") == "Tableau des ventes"


def test_memo_is_skipped_outside_a_request(
    mocker: MockerFixture, fr_locale: None
) -> None:
    """Background jobs have no request scope and simply resolve directly."""
    _enable(mocker)
    current_app.config["LANGUAGES"] = MULTI_LANG
    hook = mocker.MagicMock(return_value="Ventes")
    current_app.config["TRANSLATION_HOOK"] = hook
    # Patched rather than relying on the ambient context: the test harness may
    # push one, and this asserts the no-request branch specifically.
    mocker.patch.object(i18n, "has_request_context", return_value=False)

    assert i18n.translate("Sales") == "Ventes"
    assert i18n.translate("Sales") == "Ventes"

    assert hook.call_count == 2
