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
import os
from pathlib import Path

from astroid import nodes
from pylint.checkers import BaseChecker
from pylint.lint import PyLinter


class JSONLibraryImportChecker(BaseChecker):
    name = "disallowed-json-import"
    priority = -1
    msgs = {
        "C9001": (
            "Disallowed json import used, use superset.utils.json instead",
            "disallowed-json-import",
            "Used when a disallowed import is used in a specific file.",
        ),
    }
    exclude_files = [
        "setup.py",
        "superset/utils/json.py",
        "superset/config.py",
        "superset/cli/update.py",
        "superset/key_value/types.py",
        "superset/translations/utils.py",
        "superset/extensions/__init__.py",
    ]
    path_strip_prefix = os.getcwd() + os.sep

    def visit_import(self, node: nodes.Import) -> None:
        file = (node.root().file).replace(self.path_strip_prefix, "", 1)
        if file not in self.exclude_files:
            for module_name, _ in node.names:
                if module_name in ["json", "simplejson"]:
                    self.add_message("disallowed-json-import", node=node)

    def visit_importfrom(self, node: nodes.ImportFrom) -> None:
        file = (node.root().file).replace(self.path_strip_prefix, "", 1)
        if file not in self.exclude_files:
            if node.modname in ["json", "simplejson"]:
                self.add_message("disallowed-json-import", node=node)


class TransactionChecker(BaseChecker):
    name = "consider-using-transaction"
    msgs = {
        "W9001": (
            'Consider using the @transaction decorator when defining a "unit of work"',
            "consider-using-transaction",
            "Used when an explicit commit or rollback call is detected",
        ),
    }

    def visit_call(self, node: nodes.Call) -> None:
        if isinstance(node.func, nodes.Attribute):
            if node.func.attrname in ("commit", "rollback"):
                self.add_message("consider-using-transaction", node=node)


class SQLParsingLibraryImportChecker(BaseChecker):
    name = "disallowed-sql-import"
    priority = 0
    msgs = {
        "C9002": (
            "Disallowed SQL parsing import used",
            "disallowed-sql-import",
            "Used when a disallowed import is used in a specific file.",
        ),
    }

    def _is_disallowed(self, file_path: Path, root_mod: str) -> bool:
        # True if sqlglot is imported outside superset/sql,
        # or if any forbidden library is imported anywhere
        in_superset_sql = file_path.match("**/superset/sql/**/*.py") or file_path.match(
            "**/superset/sql/*.py"
        )
        return (root_mod == "sqlglot" and not in_superset_sql) or root_mod in {
            "sqlparse",
            "sqloxide",
        }

    def visit_import(self, node: nodes.Import) -> None:
        root_file = Path(node.root().file or "")
        for mod, _ in node.names:
            root_mod = mod.split(".", 1)[0]
            if self._is_disallowed(root_file, root_mod):
                self.add_message("disallowed-sql-import", node=node)

    def visit_importfrom(self, node: nodes.ImportFrom) -> None:
        root_file = Path(node.root().file or "")
        root_mod = (node.modname or "").split(".", 1)[0]
        if self._is_disallowed(root_file, root_mod):
            self.add_message("disallowed-sql-import", node=node)


def register(linter: PyLinter) -> None:
    linter.register_checker(JSONLibraryImportChecker(linter))
    linter.register_checker(SQLParsingLibraryImportChecker(linter))
    linter.register_checker(TransactionChecker(linter))
