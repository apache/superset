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

from sqlglot import exp, generator, parser
from sqlglot.dialects.dialect import Dialect, rename_func


class DremioRegexpSplit(exp.Func):
    """
    Custom REGEXP_SPLIT function for Dremio that supports 4 arguments.
    """

    arg_types = {
        "this": True,  # string to split
        "expression": True,  # delimiter pattern
        "mode": True,  # mode (like 'ALL') - required in Dremio
        "limit": True,  # limit - required in Dremio
    }


class Dremio(Dialect):
    class Parser(parser.Parser):
        FUNCTIONS = {
            **parser.Parser.FUNCTIONS,
            "REGEXP_SPLIT": DremioRegexpSplit.from_arg_list,
        }

    class Generator(generator.Generator):
        TRANSFORMS = {
            **generator.Generator.TRANSFORMS,
            DremioRegexpSplit: rename_func("REGEXP_SPLIT"),
        }
