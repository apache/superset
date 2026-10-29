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

from sqlglot import exp
from sqlglot.dialects.dialect import rename_func
from sqlglot.dialects.dremio import Dremio as SqlglotDremio
from sqlglot.generators.dremio import DremioGenerator
from sqlglot.parsers.dremio import DremioParser


class DremioRegexpSplit(exp.Expression, exp.Func):
    """
    Custom REGEXP_SPLIT function for Dremio that supports 4 arguments.

    sqlglot's native Dremio dialect does not parse this form; Superset adds
    it on top until it lands upstream.

    In sqlglot 30 the Expression class was split from the Func base class; custom
    Func subclasses must now explicitly inherit from both exp.Expression and exp.Func
    so that exp.Expression._set_parent is reachable via the MRO.
    """

    arg_types = {
        "this": True,  # string to split
        "expression": True,  # delimiter pattern
        "mode": True,  # mode (like 'ALL') - required in Dremio
        "limit": True,  # limit - required in Dremio
    }


class Dremio(SqlglotDremio):
    """
    Superset's Dremio dialect, built on sqlglot's native Dremio dialect.

    Adds the 4-argument REGEXP_SPLIT form on top of everything sqlglot
    already gets right for Dremio (type mapping, DATE_ADD/DATE_SUB
    semantics, TO_CHAR, CURRENT_DATE_UTC, timestamp-timezone rejection).
    """

    class Parser(DremioParser):
        FUNCTIONS = {
            **DremioParser.FUNCTIONS,
            "REGEXP_SPLIT": DremioRegexpSplit.from_arg_list,
        }

    class Generator(DremioGenerator):
        TRANSFORMS = {
            **DremioGenerator.TRANSFORMS,
            DremioRegexpSplit: rename_func("REGEXP_SPLIT"),
        }
