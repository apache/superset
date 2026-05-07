#!/usr/bin/env python3
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
#
# ----------------------------------------------------------------------
# Stress-test data generator for the composite-PK migration (sc-105349).
#
# Bulk-inserts synthetic parent rows and many-to-many junction rows for
# the eight association tables that the composite-PK migration touches.
# Useful for measuring migration runtime at varying scales — run this at
# 100K / 1M / 5M / 10M rows and time the migration at each scale to
# verify the O(N log N) extrapolation.
#
# Idempotent: rerunning with the same target is a no-op; rerunning with
# a higher target adds rows up to the new total. Batched bulk INSERTs
# (10K rows per statement) make it fast on Postgres, MySQL, and SQLite.
#
# Usage (inside the Superset container):
#
#     docker exec superset-superset-1 \\
#         /app/.venv/bin/python /app/scripts/seed_junction_load.py \\
#         --dashboard-slices 1000000 \\
#         --slice-user 100000 \\
#         --dashboard-user 100000
#
# Run with no flags for the defaults shown below. Use ``--dry-run`` to
# print the planned inserts without writing anything.
#
# The script connects via Superset's standard ``DATABASE_*`` env vars
# (or ``SUPERSET__SQLALCHEMY_DATABASE_URI`` if set), so it works
# automatically inside the Superset container regardless of which
# metadata DB backend is in use.

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from contextlib import contextmanager
from typing import Iterator
from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger("seed_junction_load")

# Bulk INSERT batch size. Larger values = fewer statements but more memory.
BATCH = 10_000

# Default per-junction-table target row counts. Tuned to mimic the shape
# of a large multi-team Superset install. Override via CLI flags.
DEFAULTS: dict[str, int] = {
    "dashboard_slices": 1_000_000,
    "slice_user": 100_000,
    "dashboard_user": 100_000,
    "dashboard_roles": 10_000,
}

# (junction_table, fk1_col, fk2_col, parent1_table, parent2_table)
# parents reference id columns; we generate (fk1, fk2) pairs by sampling
# from the parents' existing IDs.
JUNCTIONS: list[tuple[str, str, str, str, str]] = [
    ("dashboard_slices", "dashboard_id", "slice_id", "dashboards", "slices"),
    ("slice_user", "user_id", "slice_id", "ab_user", "slices"),
    ("dashboard_user", "user_id", "dashboard_id", "ab_user", "dashboards"),
    ("dashboard_roles", "dashboard_id", "role_id", "dashboards", "ab_role"),
]


# ----------------------------------------------------------------------
# Connection setup
# ----------------------------------------------------------------------


def build_engine() -> Engine:
    """Build a SQLAlchemy engine from Superset env vars."""
    if uri := os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI"):
        logger.info("Using SUPERSET__SQLALCHEMY_DATABASE_URI from env")
        return sa.create_engine(uri)

    try:
        dialect = os.environ["DATABASE_DIALECT"]
        user = os.environ["DATABASE_USER"]
        password = os.environ["DATABASE_PASSWORD"]
        host = os.environ["DATABASE_HOST"]
        port = os.environ["DATABASE_PORT"]
        db = os.environ["DATABASE_DB"]
    except KeyError as exc:
        sys.exit(
            f"Missing env var {exc}; either set DATABASE_DIALECT/USER/PASSWORD/"
            f"HOST/PORT/DB or SUPERSET__SQLALCHEMY_DATABASE_URI before running."
        )

    uri = f"{dialect}://{user}:{password}@{host}:{port}/{db}"
    logger.info(
        "Built URI from DATABASE_* env vars (dialect=%s, host=%s)", dialect, host
    )
    return sa.create_engine(uri)


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def uuid_value(dialect_name: str) -> bytes | str:
    """Return a UUID in the form the active dialect expects.

    MySQL stores UUIDs as ``BINARY(16)`` (16 raw bytes); Postgres has a
    native ``UUID`` type that accepts strings; SQLite stores them as
    BLOB/TEXT and accepts either. Branching here keeps the seed script
    backend-agnostic without depending on Superset's custom column types.
    """
    if dialect_name.startswith("mysql"):
        return uuid4().bytes
    return str(uuid4())


@contextmanager
def time_phase(name: str) -> Iterator[None]:
    """Log elapsed wall time for a named phase."""
    start = time.monotonic()
    logger.info("[%s] starting", name)
    try:
        yield
    finally:
        elapsed = time.monotonic() - start
        logger.info("[%s] done in %.2fs", name, elapsed)


def count_rows(conn: Connection, table: str) -> int:
    return conn.scalar(sa.text(f"SELECT COUNT(*) FROM {table}")) or 0  # noqa: S608


def existing_ids(conn: Connection, table: str, limit: int | None = None) -> list[int]:
    sql = f"SELECT id FROM {table} ORDER BY id"  # noqa: S608
    if limit is not None:
        sql += f" LIMIT {limit}"
    return [row[0] for row in conn.execute(sa.text(sql))]


# ----------------------------------------------------------------------
# Parent seeders
#
# Each function ensures the named parent table has at least ``target``
# rows by inserting synthetic ones with minimal-but-valid columns.
# Returns nothing; subsequent code reads back IDs via ``existing_ids``.
# ----------------------------------------------------------------------


def seed_dashboards(conn: Connection, target: int, dry_run: bool) -> None:
    current = count_rows(conn, "dashboards")
    if current >= target:
        logger.info(
            "dashboards: %d rows (target %d) — no insert needed", current, target
        )
        return
    needed = target - current
    logger.info("dashboards: %d → %d (+%d)", current, target, needed)
    if dry_run:
        return

    dialect = conn.engine.dialect.name
    sql = sa.text(
        "INSERT INTO dashboards (uuid, dashboard_title, slug, published) "
        "VALUES (:uuid, :title, :slug, :published)"
    )
    for batch_start in range(0, needed, BATCH):
        rows = [
            {
                "uuid": uuid_value(dialect),
                "title": f"seed_dashboard_{current + i}",
                "slug": f"seed-dashboard-{current + i}-{uuid4().hex[:8]}",
                "published": False,
            }
            for i in range(batch_start, min(batch_start + BATCH, needed))
        ]
        conn.execute(sql, rows)
        logger.info("  dashboards: inserted %d / %d", batch_start + len(rows), needed)


def seed_dbs(conn: Connection, dry_run: bool) -> int:
    """Ensure at least one row exists in ``dbs`` (parent of ``tables``).
    Returns the id to use as ``database_id`` when seeding ``tables``."""
    ids = existing_ids(conn, "dbs", limit=1)
    if ids:
        return ids[0]
    if dry_run:
        return -1  # placeholder
    dialect = conn.engine.dialect.name
    logger.info("dbs: inserting one synthetic database (no rows present)")
    conn.execute(
        sa.text(
            "INSERT INTO dbs (uuid, database_name, sqlalchemy_uri, expose_in_sqllab) "
            "VALUES (:uuid, :name, :uri, :expose)"
        ),
        {
            "uuid": uuid_value(dialect),
            "name": f"seed_db_{uuid4().hex[:8]}",
            "uri": "sqlite:///seed.db",
            "expose": False,
        },
    )
    return existing_ids(conn, "dbs", limit=1)[0]


def seed_tables(conn: Connection, target: int, dry_run: bool) -> None:
    current = count_rows(conn, "tables")
    if current >= target:
        logger.info("tables: %d rows (target %d) — no insert needed", current, target)
        return
    needed = target - current
    logger.info("tables: %d → %d (+%d)", current, target, needed)
    if dry_run:
        return

    database_id = seed_dbs(conn, dry_run=False)
    dialect = conn.engine.dialect.name
    sql = sa.text(
        "INSERT INTO tables (uuid, table_name, database_id) "
        "VALUES (:uuid, :name, :db_id)"
    )
    for batch_start in range(0, needed, BATCH):
        rows = [
            {
                "uuid": uuid_value(dialect),
                "name": f"seed_table_{current + i}",
                "db_id": database_id,
            }
            for i in range(batch_start, min(batch_start + BATCH, needed))
        ]
        conn.execute(sql, rows)
        logger.info("  tables: inserted %d / %d", batch_start + len(rows), needed)


def seed_slices(conn: Connection, target: int, dry_run: bool) -> None:
    current = count_rows(conn, "slices")
    if current >= target:
        logger.info("slices: %d rows (target %d) — no insert needed", current, target)
        return
    needed = target - current
    logger.info("slices: %d → %d (+%d)", current, target, needed)
    if dry_run:
        return

    # Slices reference tables.id; ensure at least one ``tables`` row exists
    # so the FK is satisfiable (datasource_id is nullable but we set it for
    # realism). The migration test doesn't care, but a real Superset that
    # re-renders these slices does.
    seed_tables(conn, target=1, dry_run=False)
    table_id = existing_ids(conn, "tables", limit=1)[0]
    dialect = conn.engine.dialect.name
    sql = sa.text(
        "INSERT INTO slices "
        "(uuid, slice_name, datasource_id, datasource_type, viz_type) "
        "VALUES (:uuid, :name, :ds_id, :ds_type, :viz)"
    )
    for batch_start in range(0, needed, BATCH):
        rows = [
            {
                "uuid": uuid_value(dialect),
                "name": f"seed_slice_{current + i}",
                "ds_id": table_id,
                "ds_type": "table",
                "viz": "table",
            }
            for i in range(batch_start, min(batch_start + BATCH, needed))
        ]
        conn.execute(sql, rows)
        logger.info("  slices: inserted %d / %d", batch_start + len(rows), needed)


def seed_users(conn: Connection, target: int, dry_run: bool) -> None:
    current = count_rows(conn, "ab_user")
    if current >= target:
        logger.info("ab_user: %d rows (target %d) — no insert needed", current, target)
        return
    needed = target - current
    logger.info("ab_user: %d → %d (+%d)", current, target, needed)
    if dry_run:
        return

    sql = sa.text(
        "INSERT INTO ab_user (first_name, last_name, username, email, active) "
        "VALUES (:first, :last, :username, :email, :active)"
    )
    for batch_start in range(0, needed, BATCH):
        rows = [
            {
                "first": "seed",
                "last": f"user_{current + i}",
                "username": f"seed_user_{current + i}_{uuid4().hex[:8]}",
                "email": f"seed_user_{current + i}_{uuid4().hex[:8]}@example.invalid",
                "active": True,
            }
            for i in range(batch_start, min(batch_start + BATCH, needed))
        ]
        conn.execute(sql, rows)
        logger.info("  ab_user: inserted %d / %d", batch_start + len(rows), needed)


def seed_roles(conn: Connection, target: int, dry_run: bool) -> None:
    current = count_rows(conn, "ab_role")
    if current >= target:
        logger.info("ab_role: %d rows (target %d) — no insert needed", current, target)
        return
    needed = target - current
    logger.info("ab_role: %d → %d (+%d)", current, target, needed)
    if dry_run:
        return

    sql = sa.text("INSERT INTO ab_role (name) VALUES (:name)")
    for batch_start in range(0, needed, BATCH):
        rows = [
            {"name": f"seed_role_{current + i}_{uuid4().hex[:8]}"}
            for i in range(batch_start, min(batch_start + BATCH, needed))
        ]
        conn.execute(sql, rows)
        logger.info("  ab_role: inserted %d / %d", batch_start + len(rows), needed)


# ----------------------------------------------------------------------
# Junction seeder
# ----------------------------------------------------------------------


def _load_existing_pairs(
    conn: Connection, junction: str, fk1_col: str, fk2_col: str
) -> set[tuple[int, int]]:
    """Load existing ``(fk1, fk2)`` pairs from a junction table into a set.

    Used so the seeder can skip them when generating new pairs (junction
    tables enforce uniqueness on the FK pair). Memory is ~32 bytes/tuple
    on CPython, so 10M existing pairs is ~320MB — acceptable for a dev
    machine. The junction / column names come from ``JUNCTIONS``, not
    user input, so the f-string interpolation is safe.
    """
    sql_text = f"SELECT {fk1_col}, {fk2_col} FROM {junction}"  # noqa: S608
    return {(row[0], row[1]) for row in conn.execute(sa.text(sql_text))}


def _generate_new_pairs(
    p1_ids: list[int],
    p2_ids: list[int],
    existing_pairs: set[tuple[int, int]],
) -> Iterator[tuple[int, int]]:
    """Yield ``(fk1, fk2)`` pairs from the parent1 × parent2 cross-product
    that are not already in ``existing_pairs``."""
    for fk1 in p1_ids:
        for fk2 in p2_ids:
            if (fk1, fk2) not in existing_pairs:
                yield (fk1, fk2)


def seed_junction(
    conn: Connection,
    junction: str,
    fk1_col: str,
    fk2_col: str,
    parent1: str,
    parent2: str,
    target: int,
    dry_run: bool,
) -> None:
    """Bulk-insert junction rows up to ``target`` rows total.

    Generates ``(fk1, fk2)`` pairs by walking the cross-product of
    parent1 IDs × parent2 IDs in row-major order, skipping pairs that
    already exist. Walking the cross-product deterministically keeps
    the script replayable: re-running with the same target is a no-op,
    and re-running with a higher target appends new pairs in a stable
    order regardless of how many runs preceded.
    """
    current = count_rows(conn, junction)
    if current >= target:
        logger.info(
            "%s: %d rows (target %d) — no insert needed", junction, current, target
        )
        return
    needed = target - current
    logger.info("%s: %d → %d (+%d)", junction, current, target, needed)
    if dry_run:
        return

    p1_ids = existing_ids(conn, parent1)
    p2_ids = existing_ids(conn, parent2)
    max_pairs = len(p1_ids) * len(p2_ids)
    if max_pairs < target:
        sys.exit(
            f"Cannot reach {target} rows in {junction}: "
            f"only {max_pairs} unique pairs available "
            f"({len(p1_ids)} × {len(p2_ids)}). "
            f"Increase parent targets and rerun."
        )

    existing_pairs: set[tuple[int, int]] = (
        _load_existing_pairs(conn, junction, fk1_col, fk2_col) if current > 0 else set()
    )
    if existing_pairs:
        logger.info(
            "  %s: loaded %d existing pairs into avoidance set",
            junction,
            len(existing_pairs),
        )

    insert_sql = sa.text(
        f"INSERT INTO {junction} ({fk1_col}, {fk2_col}) "  # noqa: S608
        f"VALUES (:fk1, :fk2)"
    )

    inserted = 0
    batch: list[dict[str, int]] = []
    for fk1, fk2 in _generate_new_pairs(p1_ids, p2_ids, existing_pairs):
        batch.append({"fk1": fk1, "fk2": fk2})
        inserted += 1
        if len(batch) == BATCH or inserted == needed:
            conn.execute(insert_sql, batch)
            logger.info("  %s: inserted %d / %d", junction, inserted, needed)
            batch = []
            if inserted == needed:
                return
    if inserted < needed:
        sys.exit(
            f"Ran out of unique pairs at {inserted}/{needed} for {junction} "
            f"(parents have {len(p1_ids)} × {len(p2_ids)} = {max_pairs} pairs, "
            f"{len(existing_pairs)} already present)"
        )


# ----------------------------------------------------------------------
# Orchestration
# ----------------------------------------------------------------------


def required_parent_count(target_pairs: int, other_parent: int) -> int:
    """How many rows we need in this parent so that
    (this_parent × other_parent) ≥ target_pairs."""
    if other_parent == 0:
        # Bootstrapping: assume we'll create at least 1
        other_parent = 1
    return -(-target_pairs // other_parent)  # ceil(target_pairs / other_parent)


def _compute_parent_requirements(targets: dict[str, int]) -> dict[str, int]:
    """For each parent table, return the minimum row count needed so that
    parent1 × parent2 ≥ target for every junction it participates in.

    Allocates ceil(sqrt(target)) rows per parent, balanced across the two
    parents of each junction. The actual junction seeder will then walk
    the cross-product to produce the target number of unique pairs.
    """
    parent_req: dict[str, int] = {}
    for junction, _, _, p1, p2 in JUNCTIONS:
        target = targets.get(junction, 0)
        if target == 0:
            continue
        sqrt_n = int(target**0.5) + 1
        parent_req[p1] = max(parent_req.get(p1, 0), sqrt_n)
        parent_req[p2] = max(parent_req.get(p2, 0), sqrt_n)
    return parent_req


def _seed_parents(conn: Connection, parent_req: dict[str, int], dry_run: bool) -> None:
    """Seed parent tables in dependency order:
    independent parents (ab_user, ab_role) first, then dashboards / slices /
    tables (which transitively depend on dbs, seeded inside seed_tables)."""
    if "ab_user" in parent_req:
        seed_users(conn, parent_req["ab_user"], dry_run)
    if "ab_role" in parent_req:
        seed_roles(conn, parent_req["ab_role"], dry_run)
    if "dashboards" in parent_req:
        seed_dashboards(conn, parent_req["dashboards"], dry_run)
    if "slices" in parent_req:
        seed_slices(conn, parent_req["slices"], dry_run)
    if "tables" in parent_req:
        seed_tables(conn, parent_req["tables"], dry_run)


def _seed_all_junctions(
    conn: Connection, targets: dict[str, int], dry_run: bool
) -> None:
    for junction, fk1, fk2, p1, p2 in JUNCTIONS:
        target = targets.get(junction, 0)
        if target == 0:
            continue
        with time_phase(f"junction:{junction}"):
            seed_junction(conn, junction, fk1, fk2, p1, p2, target, dry_run)


def run(targets: dict[str, int], dry_run: bool) -> None:
    engine = build_engine()
    with engine.begin() as conn:
        parent_req = _compute_parent_requirements(targets)
        logger.info("Required parent row counts: %s", parent_req)

        with time_phase("parents"):
            _seed_parents(conn, parent_req, dry_run)

        with time_phase("junctions"):
            _seed_all_junctions(conn, targets, dry_run)


# ----------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    for table, default in DEFAULTS.items():
        parser.add_argument(
            f"--{table.replace('_', '-')}",
            type=int,
            default=default,
            help=f"target row count for {table} (default: {default:,})",
        )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="print planned inserts without writing to the DB",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="increase log verbosity",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    targets = {table: getattr(args, table) for table in DEFAULTS}

    logger.info("Targets: %s", targets)
    logger.info("Dry run: %s", args.dry_run)

    with time_phase("total"):
        run(targets, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
