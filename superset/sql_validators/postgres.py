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

import re
from typing import List, Optional

from pgsanity.pgsanity import check_string

from superset.models.core import Database
from superset.sql_validators.base import BaseSQLValidator, SQLValidationAnnotation


class PostgreSQLValidator(BaseSQLValidator):  # pylint: disable=too-few-public-methods
    """Validate SQL queries using the pgsanity module"""

    name = "PostgreSQLValidator"

    @classmethod
    def validate(
        cls, sql: str, schema: Optional[str], database: Database
    ) -> List[SQLValidationAnnotation]:
        annotations: List[SQLValidationAnnotation] = []
        valid, error = check_string(sql, add_semicolon=True)
        if valid:
            return annotations

        match = re.match(r"^line (\d+): (.*)", error)
        line_number = int(match.group(1)) if match else None
        message = match.group(2) if match else error

        annotations.append(
            SQLValidationAnnotation(
                message=message,
                line_number=line_number,
                start_column=None,
                end_column=None,
            )
        )

        return annotations
