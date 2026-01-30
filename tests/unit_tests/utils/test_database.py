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
"""Tests for superset.utils.database module."""

from sqlalchemy import Sequence
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.schema import CreateSequence
from sqlalchemy.sql.compiler import DDLCompiler

from superset.utils.database import apply_mariadb_ddl_fix

apply_mariadb_ddl_fix()


def test_mariadb_nocycle_fix_applied():
    """Test that 'NO CYCLE' is replaced with 'NOCYCLE' for MariaDB dialect."""
    dialect = mysql.dialect()
    dialect.name = "mariadb"
    ddl_compiler = DDLCompiler(dialect, None)
    seq = Sequence("test_seq", cycle=False)

    result = ddl_compiler.visit_create_sequence(CreateSequence(seq))
    assert "NOCYCLE" in result
    assert "NO CYCLE" not in result


def test_nocycle_fix_not_applied_for_postgresql():
    """Test that 'NO CYCLE' is NOT replaced for PostgreSQL dialect."""
    dialect = postgresql.dialect()
    compiler = DDLCompiler(dialect, None)
    seq = Sequence("test_seq", cycle=False)

    result = compiler.visit_create_sequence(CreateSequence(seq))
    assert "NO CYCLE" in result
