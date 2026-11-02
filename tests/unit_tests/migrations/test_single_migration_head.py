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
"""Regression coverage for a connected Alembic migration graph."""

from pathlib import Path

from alembic.script import ScriptDirectory


def test_migrations_have_one_head() -> None:
    """Database initialization must have an unambiguous upgrade target."""
    migrations = Path(__file__).resolve().parents[3] / "superset" / "migrations"
    scripts = ScriptDirectory(str(migrations))

    assert len(scripts.get_heads()) == 1
