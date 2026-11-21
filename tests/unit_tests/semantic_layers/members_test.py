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
import pyarrow as pa
from superset_core.semantic_layers.types import (
    AggregationType,
    Dimension,
    Grains,
    Metric,
)

from superset.semantic_layers.members import members_by_key

COUNTRY: Dimension = Dimension("dim.country", "Country", pa.string())
ORDERED_AT: Dimension = Dimension("dim.ordered_at", "Ordered At", pa.date32())
ORDERED_AT_MONTH: Dimension = Dimension(
    "dim.ordered_at__month", "Ordered At", pa.date32(), grain=Grains.MONTH
)
REVENUE: Metric = Metric(
    "metric.revenue",
    "Revenue",
    pa.float64(),
    "SUM(revenue)",
    aggregation=AggregationType.SUM,
)


def test_members_are_keyed_by_name_not_by_provider_id() -> None:
    """Selections are saved under ``name``; ``id`` is provider-private."""
    assert members_by_key([REVENUE]) == {"Revenue": REVENUE}
    assert members_by_key([COUNTRY]) == {"Country": COUNTRY}
    assert "metric.revenue" not in members_by_key([REVENUE])


def test_display_label_does_not_become_the_key() -> None:
    """``verbose_name`` is display only and must never key a selection."""
    labelled: Metric = Metric(
        "metric.gmv",
        "gmv",
        pa.float64(),
        "SUM(gmv)",
        verbose_name="Gross Merchandise Value",
    )
    keyed: dict[str, Metric] = members_by_key([labelled])
    assert set(keyed) == {"gmv"}


def test_empty_input_yields_an_empty_mapping() -> None:
    assert members_by_key([]) == {}


def test_same_name_grain_variants_collapse_to_one_entry() -> None:
    """A view may expose one variant per grain; the mapping holds one per name."""
    keyed: dict[str, Dimension] = members_by_key([ORDERED_AT, ORDERED_AT_MONTH])
    assert set(keyed) == {"Ordered At"}
    assert keyed["Ordered At"] is ORDERED_AT_MONTH


def test_matches_the_lookup_it_replaces() -> None:
    """Guard the extraction: identical mapping to the former comprehension."""
    dimensions: list[Dimension] = [COUNTRY, ORDERED_AT, ORDERED_AT_MONTH]
    metrics: list[Metric] = [REVENUE]
    assert members_by_key(dimensions) == {
        dimension.name: dimension for dimension in dimensions
    }
    assert members_by_key(metrics) == {metric.name: metric for metric in metrics}
    # Insertion order is part of the behavior: callers read ``.values()``.
    assert list(members_by_key(dimensions)) == list(
        dict.fromkeys(dimension.name for dimension in dimensions)
    )
