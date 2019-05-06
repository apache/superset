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

# pylint: disable=too-few-public-methods

from typing import (
    Any,
    Dict,
    List,
    Optional,
)


class SQLValidationAnnotation:
    """Represents a single annotation (error/warning) in an SQL querytext"""
    def __init__(
            self,
            message: str,
            line_number: Optional[int],
            start_column: Optional[int],
            end_column: Optional[int],
    ):
        self.message = message
        self.line_number = line_number
        self.start_column = start_column
        self.end_column = end_column

    def to_dict(self) -> Dict:
        """Return a dictionary representation of this annotation"""
        return {
            'line_number': self.line_number,
            'start_column': self.start_column,
            'end_column': self.end_column,
            'message': self.message,
        }


class BaseSQLValidator:
    """BaseSQLValidator defines the interface for checking that a given sql
    query is valid for a given database engine."""

    name = 'BaseSQLValidator'

    @classmethod
    def validate(
            cls,
            sql: str,
            schema: str,
            database: Any,
    ) -> List[SQLValidationAnnotation]:
        """Check that the given SQL querystring is valid for the given engine"""
        raise NotImplementedError
