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


class TransactionChecker(BaseChecker):
    __implements__ = IAstroidChecker

    name = "consider-using-transaction"
    msgs = {
        "W0001": (
            'Consider using the @transaction decorator when defining a "unit of work"',
            "consider-using-transaction",
            "Used when an explicit commit or rollback call is detected",
        ),
    }

    def visit_call(self, node: nodes.Call) -> None:
        if isinstance(node.func, nodes.Attribute):
            if node.func.attrname in ("commit", "rollback"):
                self.add_message("consider-using-transaction", node=node)


def register(linter: PyLinter) -> None:
    linter.register_checker(TransactionChecker(linter))
