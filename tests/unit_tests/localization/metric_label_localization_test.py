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
Tests for adhoc metric/column label localization.

AdhocMetric and AdhocColumn objects live inside Slice.params (JSON)
and surface as form_data dict in ChartEntityResponseSchema.
Each object can carry inline translations:

    {
        "label": "Total Revenue",
        "hasCustomLabel": true,
        "translations": {"label": {"de": "Gesamtumsatz"}}
    }

localize_metric_labels() replaces label values with translations
for the user's locale.  Only objects with hasCustomLabel=true
and a translations dict are processed.
"""

import copy

from superset.localization.metric_label_utils import localize_metric_labels

# ---------------------------------------------------------------------------
# metrics[] localization
# ---------------------------------------------------------------------------


def test_metric_with_translation_gets_localized() -> None:
    """
    Verify localize_metric_labels translates metric label for given locale.

    Given form_data with metric having translations {"label": {"de": "Gesamtumsatz"}},
    when localize_metric_labels is called with locale="de",
    then metric["label"] is replaced with German translation.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "expressionType": "SQL",
                "sqlExpression": "SUM(revenue)",
                "translations": {"label": {"de": "Gesamtumsatz", "fr": "Revenu total"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Gesamtumsatz"


def test_metric_without_translations_unchanged() -> None:
    """
    Verify localize_metric_labels preserves label when no translations key.

    Given form_data with metric having no translations key,
    when localize_metric_labels is called,
    then metric["label"] remains original "Total Revenue".
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "expressionType": "SQL",
                "sqlExpression": "SUM(revenue)",
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Total Revenue"


def test_metric_with_has_custom_label_false_skipped() -> None:
    """
    Verify localize_metric_labels skips metric with hasCustomLabel=false.

    Given metric with hasCustomLabel=false and existing translations,
    when localize_metric_labels is called,
    then metric["label"] remains the auto-generated label unchanged.
    """
    form_data = {
        "metrics": [
            {
                "label": "SUM(revenue)",
                "hasCustomLabel": False,
                "optionName": "metric_abc",
                "expressionType": "SIMPLE",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "SUM(revenue)"


def test_metric_without_has_custom_label_key_skipped() -> None:
    """
    Verify localize_metric_labels skips metric missing hasCustomLabel key.

    Given metric without hasCustomLabel key at all,
    when localize_metric_labels is called,
    then metric["label"] remains unchanged without error.
    """
    form_data = {
        "metrics": [
            {
                "label": "SUM(revenue)",
                "optionName": "metric_abc",
                "expressionType": "SIMPLE",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "SUM(revenue)"


def test_multiple_metrics_selective_localization() -> None:
    """
    Verify localize_metric_labels selectively translates eligible metrics.

    Given form_data with three metrics: one with translation, one auto-generated,
    one custom but no matching locale,
    when localize_metric_labels is called with locale="de",
    then only the first metric label is translated.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_1",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            },
            {
                "label": "SUM(cost)",
                "hasCustomLabel": False,
                "optionName": "metric_2",
            },
            {
                "label": "Profit",
                "hasCustomLabel": True,
                "optionName": "metric_3",
                "translations": {"label": {"fr": "Bénéfice"}},
            },
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Gesamtumsatz"
    assert result["metrics"][1]["label"] == "SUM(cost)"
    assert result["metrics"][2]["label"] == "Profit"


def test_metric_locale_fallback_base_language() -> None:
    """
    Verify localize_metric_labels falls back to base language.

    Given metric with translations {"label": {"de": "Gesamtumsatz"}},
    when localize_metric_labels is called with locale="de-DE",
    then metric["label"] uses base "de" translation.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de-DE")

    assert result["metrics"][0]["label"] == "Gesamtumsatz"


def test_metric_locale_fallback_underscore() -> None:
    """
    Verify localize_metric_labels falls back to base language for POSIX locales.

    Given metric with translations {"label": {"pt": "Receita Total"}},
    when localize_metric_labels is called with locale="pt_BR",
    then metric["label"] uses base "pt" translation.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {"pt": "Receita Total"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="pt_BR")

    assert result["metrics"][0]["label"] == "Receita Total"


# ---------------------------------------------------------------------------
# columns[] localization (AdhocColumn)
# ---------------------------------------------------------------------------


def test_column_with_translation_gets_localized() -> None:
    """
    Verify localize_metric_labels translates AdhocColumn label.

    Given form_data with AdhocColumn having translations,
    when localize_metric_labels is called with locale="de",
    then column["label"] is replaced with German translation.
    """
    form_data = {
        "columns": [
            {
                "label": "Order Date",
                "hasCustomLabel": True,
                "optionName": "col_abc",
                "sqlExpression": "order_date",
                "expressionType": "SQL",
                "translations": {"label": {"de": "Bestelldatum"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["columns"][0]["label"] == "Bestelldatum"


def test_column_without_translations_unchanged() -> None:
    """
    Verify localize_metric_labels preserves AdhocColumn label without translations.

    Given form_data with AdhocColumn having no translations key,
    when localize_metric_labels is called,
    then column["label"] remains original "Order Date".
    """
    form_data = {
        "columns": [
            {
                "label": "Order Date",
                "hasCustomLabel": True,
                "optionName": "col_abc",
                "sqlExpression": "order_date",
                "expressionType": "SQL",
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["columns"][0]["label"] == "Order Date"


def test_column_with_has_custom_label_false_skipped() -> None:
    """
    Verify localize_metric_labels skips AdhocColumn with hasCustomLabel=false.

    Given AdhocColumn with hasCustomLabel=false and existing translations,
    when localize_metric_labels is called,
    then column["label"] remains unchanged.
    """
    form_data = {
        "columns": [
            {
                "label": "order_date",
                "hasCustomLabel": False,
                "optionName": "col_abc",
                "sqlExpression": "order_date",
                "expressionType": "SQL",
                "translations": {"label": {"de": "Bestelldatum"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["columns"][0]["label"] == "order_date"


# ---------------------------------------------------------------------------
# string metrics (SavedMetric references) are ignored
# ---------------------------------------------------------------------------


def test_string_metric_references_ignored() -> None:
    """
    Verify localize_metric_labels ignores string SavedMetric references.

    Given form_data with metrics as string names (not dicts),
    when localize_metric_labels is called,
    then string metrics pass through unchanged.
    """
    form_data = {
        "metrics": ["count", "avg_revenue"],
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"] == ["count", "avg_revenue"]


def test_mixed_string_and_dict_metrics() -> None:
    """
    Verify localize_metric_labels handles mixed string and dict metrics.

    Given form_data with both a string metric and an AdhocMetric dict,
    when localize_metric_labels is called,
    then string passes through and dict metric is localized.
    """
    form_data = {
        "metrics": [
            "count",
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            },
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0] == "count"
    assert result["metrics"][1]["label"] == "Gesamtumsatz"


# ---------------------------------------------------------------------------
# string columns (PhysicalColumn references) are ignored
# ---------------------------------------------------------------------------


def test_string_column_references_ignored() -> None:
    """
    Verify localize_metric_labels ignores string PhysicalColumn references.

    Given form_data with columns as string names (not dicts),
    when localize_metric_labels is called,
    then string columns pass through unchanged.
    """
    form_data = {
        "columns": ["order_date", "customer_name"],
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["columns"] == ["order_date", "customer_name"]


# ---------------------------------------------------------------------------
# edge cases
# ---------------------------------------------------------------------------


def test_empty_form_data() -> None:
    """
    Verify localize_metric_labels handles empty form_data.

    Given empty form_data {},
    when localize_metric_labels is called,
    then it returns {} without error.
    """
    result = localize_metric_labels({}, locale="de")

    assert result == {}


def test_form_data_without_metrics_or_columns() -> None:
    """
    Verify localize_metric_labels handles form_data without metrics or columns.

    Given form_data with only unrelated keys (viz_type, datasource),
    when localize_metric_labels is called,
    then form_data is returned unchanged.
    """
    form_data = {"viz_type": "table", "datasource": "1__table"}

    result = localize_metric_labels(form_data, locale="de")

    assert result == {"viz_type": "table", "datasource": "1__table"}


def test_does_not_mutate_original() -> None:
    """
    Verify localize_metric_labels does not mutate the original form_data.

    Given form_data with metric having translations,
    when localize_metric_labels is called,
    then original form_data dict is not modified.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ]
    }
    original = copy.deepcopy(form_data)

    localize_metric_labels(form_data, locale="de")

    assert form_data == original


def test_metric_with_empty_translations_dict() -> None:
    """
    Verify localize_metric_labels handles metric with empty translations.

    Given metric with translations={} (empty dict),
    when localize_metric_labels is called,
    then metric["label"] remains original without error.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Total Revenue"


def test_metric_with_empty_label_translations() -> None:
    """
    Verify localize_metric_labels handles metric with empty label translations.

    Given metric with translations={"label": {}} (no locale entries),
    when localize_metric_labels is called,
    then metric["label"] remains original without error.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Total Revenue"


def test_preserves_other_metric_properties() -> None:
    """
    Verify localize_metric_labels preserves all non-translated properties.

    Given metric with various properties (expressionType, sqlExpression, etc.),
    when localize_metric_labels is called,
    then all properties except label are preserved unchanged.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "expressionType": "SQL",
                "sqlExpression": "SUM(revenue)",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ]
    }

    result = localize_metric_labels(form_data, locale="de")

    metric = result["metrics"][0]
    assert metric["label"] == "Gesamtumsatz"
    assert metric["expressionType"] == "SQL"
    assert metric["sqlExpression"] == "SUM(revenue)"
    assert metric["optionName"] == "metric_abc"
    assert metric["hasCustomLabel"] is True
    assert metric["translations"] == {"label": {"de": "Gesamtumsatz"}}


def test_both_metrics_and_columns_localized() -> None:
    """
    Verify localize_metric_labels processes both metrics and columns arrays.

    Given form_data with both metrics[] and columns[] containing translatable items,
    when localize_metric_labels is called,
    then labels in both arrays are localized.
    """
    form_data = {
        "metrics": [
            {
                "label": "Total Revenue",
                "hasCustomLabel": True,
                "optionName": "metric_abc",
                "translations": {"label": {"de": "Gesamtumsatz"}},
            }
        ],
        "columns": [
            {
                "label": "Order Date",
                "hasCustomLabel": True,
                "optionName": "col_abc",
                "sqlExpression": "order_date",
                "expressionType": "SQL",
                "translations": {"label": {"de": "Bestelldatum"}},
            }
        ],
    }

    result = localize_metric_labels(form_data, locale="de")

    assert result["metrics"][0]["label"] == "Gesamtumsatz"
    assert result["columns"][0]["label"] == "Bestelldatum"
