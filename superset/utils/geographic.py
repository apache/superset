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

"""Exact-first, ambiguity-safe resolution against rendered geographic identifiers."""

import unicodedata
from collections.abc import Iterable

from superset.utils.geographic_regions import REGIONS


def geographic_key(value: str) -> str:
    """Fold case and diacritics, but never guess or perform fuzzy matching."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", value.lower())
        if not unicodedata.combining(c)
    )


def resolve_geographic_value(
    value: object, entries: Iterable[tuple[str, str]], *, fold_diacritics: bool = True
) -> str:
    """Resolve exactly first, then accept only a unique folded identifier."""
    if not isinstance(value, str) or not value or len(value) > 500:
        raise ValueError(
            "Geographic values must be nonempty strings of at most 500 characters"
        )
    key = geographic_key if fold_diacritics else str.lower
    pairs = list(entries)
    exact = {code for alias, code in pairs if alias == value}
    matches = exact or {code for alias, code in pairs if key(alias) == key(value)}
    if len(matches) != 1:
        reason = "ambiguous" if matches else "unrecognized"
        raise ValueError(f"{reason} geographic value {value[:100]!r}")
    return next(iter(matches))


def resolve_region(value: object, country: str, region_format: str) -> str:
    """Resolve only identifiers present in the selected bundled geometry."""
    if country not in REGIONS or region_format not in {
        "name",
        "abbreviation",
        "iso_3166_2",
    }:
        raise ValueError(
            "Choose a supported country and region_format: name, "
            "abbreviation, iso_3166_2"
        )
    entries = [
        (
            name
            if region_format == "name"
            else code.split("-", 1)[-1]
            if region_format == "abbreviation"
            else code,
            code,
        )
        for code, name in REGIONS[country]
    ]
    try:
        return resolve_geographic_value(value, entries)
    except ValueError as exc:
        raise ValueError(
            f"{exc}; country={country}, region_format={region_format}. Correct "
            "the value, choose the matching country/format, "
            "or explicitly filter the dataset."
        ) from exc
