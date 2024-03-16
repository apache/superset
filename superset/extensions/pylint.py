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

from astroid import nodes
from pylint.checkers import BaseChecker
from pylint.interfaces import IAstroidChecker
from pylint.lint import PyLinter


class SQLParsingLibraryImportChecker(BaseChecker):
    __implements__ = IAstroidChecker

    name = "sql-parsing-library-import-checker"
    priority = -1
    msgs = {
        "C9999": (
            "Disallowed SQL parsing import used",
            "disallowed-import",
            "Used when a disallowed import is used in a specific file.",
        ),
    }

    def visit_import(self, node: nodes.Import) -> None:
        if "superset/sql_parse.py" not in node.root().file:
            for module_name, _ in node.names:
                if module_name in ["sqlglot", "sqlparse", "sqloxide"]:
                    self.add_message("disallowed-import", node=node)

    def visit_importfrom(self, node: nodes.ImportFrom) -> None:
        if "superset/sql_parse.py" not in node.root().file:
            if node.modname in ["sqlglot", "sqlparse", "sqloxide"]:
                self.add_message("disallowed-import", node=node)


def register(linter: PyLinter) -> None:
    linter.register_checker(SQLParsingLibraryImportChecker(linter))
