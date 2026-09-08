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
"""Hierarchical recipient resolution (Section 8 of the design spec).

Given the set of failing facilities produced by an alert SQL, resolve the
users who must be notified and the facilities inside each user's scope.

Recipient rule (FR-3): for a failing facility F, recipients are all users
assigned to F or to any ancestor org unit of F (the facility itself and
above).

Scoping rule (FR-4): a user mapped to org unit U receives exactly the
failing facilities F where U is the facility or an ancestor of F.
"""

from __future__ import annotations

from typing import Any, Iterable, TYPE_CHECKING

from sqlalchemy import text

if TYPE_CHECKING:
    from superset.models.core import Database

# level1id..level7id are the ancestor-chain columns on org_units
_SCOPE_LEVEL_COLS = (
    "level1id",
    "level2id",
    "level3id",
    "level4id",
    "level5id",
    "level6id",
    "level7id",
)


def _qualified(schema: str | None, table: str) -> str:
    """Return a backtick-quoted fully qualified ClickHouse table name."""
    q = lambda s: f"`{s.replace('`', '``')}`"  # noqa: E731
    return f"{q(schema)}.{q(table)}" if schema else q(table)


def get_ancestor_map(
    database: Database,
    facility_ids: Iterable[str],
    schema: str,
    org_units_table: str,
    max_per_query: int = 5000,
) -> dict[str, set[str]]:
    """Map each facility id to its org-unit chain.

    chain(f) = {f} union {non-null ancestor ids of f}. Missing facilities
    are absent from the result and are tracked by the caller.
    """
    ids = list(dict.fromkeys(str(i) for i in facility_ids))
    if not ids:
        return {}
    cols = ", ".join(_SCOPE_LEVEL_COLS)
    table = _qualified(schema, org_units_table)
    result: dict[str, set[str]] = {}
    with database.get_sqla_engine() as engine:
        with engine.connect() as conn:
            for start in range(0, len(ids), max_per_query):
                chunk = ids[start : start + max_per_query]
                rows = conn.execute(
                    text(
                        f"SELECT id, {cols} FROM {table} WHERE id IN :ids"  # noqa: S608 - constant cols, config-quoted table, values bound
                    ),
                    {"ids": chunk},
                ).mappings()
                for row in rows:
                    chain = {str(row["id"])}
                    for col in _SCOPE_LEVEL_COLS:
                        val = row.get(col)
                        if val is not None:
                            chain.add(str(val))
                    result[str(row["id"])] = chain
    return result


def get_usernames_by_unit(
    database: Database,
    scope_units: Iterable[str],
    schema: str,
    user_org_units_table: str,
    max_per_query: int = 5000,
) -> dict[str, set[str]]:
    """Map each org unit id to the usernames assigned to it."""
    units = list(dict.fromkeys(str(u) for u in scope_units))
    if not units:
        return {}
    table = _qualified(schema, user_org_units_table)
    out: dict[str, set[str]] = {}
    with database.get_sqla_engine() as engine:
        with engine.connect() as conn:
            for start in range(0, len(units), max_per_query):
                chunk = units[start : start + max_per_query]
                rows = conn.execute(
                    text(
                        f"SELECT org_unit_id, username FROM {table} "  # noqa: S608 - config-quoted table, values bound
                        "WHERE org_unit_id IN :units"
                    ),
                    {"units": chunk},
                ).mappings()
                for row in rows:
                    out.setdefault(str(row["org_unit_id"]), set()).add(
                        str(row["username"])
                    )
    return out


def resolve(
    database: Database,
    failing_facilities: Iterable[str],
    schema: str = "moh",
    org_units_table: str = "org_units",
    user_org_units_table: str = "dim_user_orgunit",
    max_per_query: int = 5000,
) -> tuple[dict[str, list[str]], int]:
    """Resolve recipients for a set of failing facilities.

    Returns (username -> sorted failing facility ids in that user's scope,
    number of facilities ignored because they are not in org_units).
    """
    ids = list(dict.fromkeys(str(f) for f in failing_facilities))
    ancestor_map = get_ancestor_map(
        database, ids, schema, org_units_table, max_per_query
    )
    ignored = len(ids) - len(ancestor_map)

    # union of all chains -> every scope unit that matters
    scope_units: set[str] = set()
    for chain in ancestor_map.values():
        scope_units.update(chain)

    # unit -> failing facilities covered by that unit
    unit_facilities: dict[str, list[str]] = {}
    for facility, chain in ancestor_map.items():
        for unit in chain:
            unit_facilities.setdefault(unit, []).append(facility)

    username_units = get_usernames_by_unit(
        database, scope_units, schema, user_org_units_table, max_per_query
    )

    per_user: dict[str, list[str]] = {}
    for unit, usernames in username_units.items():
        facilities = unit_facilities.get(unit, [])
        for username in usernames:
            per_user.setdefault(username, []).extend(facilities)

    deduped = {
        username: sorted(set(facilities)) for username, facilities in per_user.items()
    }
    return deduped, ignored


def list_columns(rows: list[Any]) -> list[str]:
    """Return the union of column names present across result rows."""
    cols: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in cols:
                cols.append(key)
    return cols
