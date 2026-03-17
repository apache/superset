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

from __future__ import annotations

import logging
import re
import subprocess

from superset.models.core import Database
from superset.sql_validators.base import BaseSQLValidator, SQLValidationAnnotation

try:
    from syntaqlite import get_binary_path
except ModuleNotFoundError:
    get_binary_path = None

logger = logging.getLogger(__name__)

DIAGNOSTIC_RE = re.compile(
    r"^(?:error|warning): (.+)\n"
    r" --> .+?:(\d+):(\d+)\n"
    r" +\|\n"
    r"\d+ \| .+\n"
    r" +\| +\^(~*)",
    re.MULTILINE,
)


class SQLiteSQLValidator(BaseSQLValidator):  # pylint: disable=too-few-public-methods
    """Validate SQL queries using the syntaqlite binary"""

    name = "SQLiteSQLValidator"

    @classmethod
    def validate(
        cls,
        sql: str,
        catalog: str | None,
        schema: str | None,
        database: Database,
    ) -> list[SQLValidationAnnotation]:
        annotations: list[SQLValidationAnnotation] = []

        if get_binary_path is None:
            raise ImportError(
                "syntaqlite is not installed. Install it with: "
                'pip install "apache-superset[sqlite]"'
            )

        try:
            result = subprocess.run(  # noqa: S603
                [
                    get_binary_path(),
                    "--no-config",
                    "validate",
                    "--allow",
                    "schema",
                    "--input=sql",
                ],
                input=sql,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except FileNotFoundError:
            logger.exception("syntaqlite binary not found")
            raise
        except subprocess.TimeoutExpired:
            logger.warning("syntaqlite timed out validating SQL")
            return annotations

        if result.returncode == 0:
            return annotations

        output = result.stderr or result.stdout
        for match in DIAGNOSTIC_RE.finditer(output):
            message = match.group(1)
            line_number = int(match.group(2))
            start_column = int(match.group(3))
            # The caret (^) plus tildes (~) span the error token
            end_column = start_column + len(match.group(4))

            annotations.append(
                SQLValidationAnnotation(
                    message=message,
                    line_number=line_number,
                    start_column=start_column,
                    end_column=end_column,
                )
            )

        # If we couldn't parse the output but got a non-zero exit, add a generic error
        if not annotations and result.returncode != 0:
            annotations.append(
                SQLValidationAnnotation(
                    message=output.strip() or "SQL syntax validation failed",
                    line_number=None,
                    start_column=None,
                    end_column=None,
                )
            )

        return annotations
