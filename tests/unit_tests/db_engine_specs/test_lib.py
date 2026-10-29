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
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import ast
import re
from pathlib import Path

from superset.db_engine_specs.lib import diagnose, SQL_VALIDATION_ENGINES
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec

REPO_ROOT = Path(__file__).parents[3]
CONFIG_PY = REPO_ROOT / "superset" / "config.py"
DOCS_GENERATOR = REPO_ROOT / "docs" / "scripts" / "generate-database-docs.mjs"


def get_shipped_validator_engines() -> set[str]:
    """
    Return the engine keys of the ``SQL_VALIDATORS_BY_ENGINE`` default.

    Read via ``ast`` rather than by importing ``superset.config``, because that
    module ends by applying the operator's ``superset_config``. The capability
    matrix describes the shipped default, not one deployment's overrides.
    """
    module = ast.parse(CONFIG_PY.read_text(encoding="utf-8"))
    targets: list[ast.expr]
    for node in module.body:
        # An annotated assignment has a single target, a plain one may have
        # several; accept both so adding a type annotation in config.py does
        # not read as a missing setting.
        if isinstance(node, ast.AnnAssign):
            targets, value = [node.target], node.value
        elif isinstance(node, ast.Assign):
            targets, value = node.targets, node.value
        else:
            continue
        if value is not None and any(
            isinstance(target, ast.Name) and target.id == "SQL_VALIDATORS_BY_ENGINE"
            for target in targets
        ):
            return set(ast.literal_eval(value))
    raise AssertionError(f"No SQL_VALIDATORS_BY_ENGINE assignment in {CONFIG_PY}")


def get_docs_generator_engines() -> set[str]:
    """
    Return the engine set the docs generator uses for the ``sql_validation`` flag.

    The generator embeds Python that walks the db engine specs with ``ast``
    without importing Superset, so it cannot read the constant directly.
    """
    match = re.search(
        r"'sql_validation':\s*engine_attr\s+in\s+(\{[^}]*\})",
        DOCS_GENERATOR.read_text(encoding="utf-8"),
    )
    assert match, f"No sql_validation engine set found in {DOCS_GENERATOR}"
    return set(ast.literal_eval(match.group(1)))


def test_sql_validation_engines_matches_config_default() -> None:
    """
    The capability matrix must report the engines config actually wires up.
    """
    assert SQL_VALIDATION_ENGINES == get_shipped_validator_engines()


def test_sql_validation_engines_matches_docs_generator() -> None:
    """
    The docs generator restates the engine set; drift silently publishes a
    wrong ``sql_validation`` flag and score in docs/src/data/databases.json.
    """
    assert SQL_VALIDATION_ENGINES == get_docs_generator_engines()


def test_diagnose_reports_extended_aggregations() -> None:
    """
    ``diagnose()`` must report per-engine MEDIAN/STDDEV_SAMP/VAR_SAMP support
    so the generated database docs (docs/src/data/databases.json, via
    docs/scripts/generate-database-docs.mjs's Flask-context path) reflect it,
    instead of these silently never appearing anywhere outside the source.
    """
    assert diagnose(PostgresEngineSpec)["extended_aggregations"] == {
        "MEDIAN": True,
        "STDDEV_SAMP": True,
        "VAR_SAMP": True,
    }
    # MySQL has no native MEDIAN (see MySQLEngineSpec._extended_aggregations).
    assert diagnose(MySQLEngineSpec)["extended_aggregations"] == {
        "MEDIAN": False,
        "STDDEV_SAMP": True,
        "VAR_SAMP": True,
    }
    # SQLite never opted in to any of the three.
    assert diagnose(SqliteEngineSpec)["extended_aggregations"] == {
        "MEDIAN": False,
        "STDDEV_SAMP": False,
        "VAR_SAMP": False,
    }
