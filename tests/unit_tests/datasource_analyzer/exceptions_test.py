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

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    ForbiddenError,
)
from superset.datasource_analyzer.exceptions import (
    DatasourceAnalyzerAccessDeniedError,
    DatasourceAnalyzerDatabaseNotFoundError,
    DatasourceAnalyzerInvalidError,
    DatasourceAnalyzerSchemaNotFoundError,
)


def test_invalid_error_inheritance() -> None:
    """Test DatasourceAnalyzerInvalidError inherits from CommandInvalidError."""
    exc = DatasourceAnalyzerInvalidError()
    assert isinstance(exc, CommandInvalidError)


def test_database_not_found_error_inheritance() -> None:
    """Test DatasourceAnalyzerDatabaseNotFoundError inherits from CommandException."""
    exc = DatasourceAnalyzerDatabaseNotFoundError()
    assert isinstance(exc, CommandException)


def test_schema_not_found_error_inheritance() -> None:
    """Test DatasourceAnalyzerSchemaNotFoundError inherits from CommandException."""
    exc = DatasourceAnalyzerSchemaNotFoundError()
    assert isinstance(exc, CommandException)


def test_access_denied_error_inheritance() -> None:
    """Test DatasourceAnalyzerAccessDeniedError inherits from ForbiddenError."""
    exc = DatasourceAnalyzerAccessDeniedError()
    assert isinstance(exc, ForbiddenError)


def test_exception_messages() -> None:
    """Test that exceptions have proper messages."""
    assert "invalid" in str(DatasourceAnalyzerInvalidError().message).lower()
    assert "not found" in str(DatasourceAnalyzerDatabaseNotFoundError().message).lower()
    assert "not found" in str(DatasourceAnalyzerSchemaNotFoundError().message).lower()
    assert "denied" in str(DatasourceAnalyzerAccessDeniedError().message).lower()
