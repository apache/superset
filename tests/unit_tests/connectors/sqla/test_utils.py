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
from unittest.mock import Mock, patch

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.utils import get_virtual_table_metadata
from superset.errors import SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.models.core import Database


def test_get_virtual_table_metadata_invalid_sql():
    """Test that invalid SQL in virtual table raises proper exception."""
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    mock_dataset.sql = "SELECT INVALID SYNTAX FROM"
    mock_database.db_engine_spec.engine = "postgresql"

    # Mock template processor
    mock_template_processor = Mock()
    mock_template_processor.process_template.return_value = "SELECT INVALID SYNTAX FROM"
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    with pytest.raises(SupersetGenericDBErrorException) as exc_info:
        get_virtual_table_metadata(mock_dataset)

    # Check that the error message includes the parsing error
    assert "Invalid SQL:" in str(exc_info.value.message)


def test_get_virtual_table_metadata_empty_sql():
    """Test that empty SQL raises appropriate error."""
    mock_dataset = Mock(spec=SqlaTable)
    mock_dataset.sql = None

    with pytest.raises(SupersetGenericDBErrorException) as exc_info:
        get_virtual_table_metadata(mock_dataset)

    assert "Virtual dataset query cannot be empty" in str(exc_info.value.message)


def test_get_virtual_table_metadata_mutation_not_allowed():
    """Test that SQL with mutations raises security error."""
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    mock_dataset.sql = "DELETE FROM users"
    mock_database.db_engine_spec.engine = "postgresql"

    # Mock template processor
    mock_template_processor = Mock()
    mock_template_processor.process_template.return_value = "DELETE FROM users"
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    # Mock SQLScript to simulate mutation detection
    with patch("superset.connectors.sqla.utils.SQLScript") as mock_sqlscript_class:
        mock_script = Mock()
        mock_script.has_mutation.return_value = True
        mock_sqlscript_class.return_value = mock_script

        with pytest.raises(SupersetSecurityException) as exc_info:
            get_virtual_table_metadata(mock_dataset)

        assert (
            exc_info.value.error.error_type
            == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )
        assert "Only `SELECT` statements are allowed" in exc_info.value.error.message


def test_get_virtual_table_metadata_multiple_statements_not_allowed():
    """Test that multiple SQL statements raise security error."""
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    mock_dataset.sql = "SELECT * FROM table1; SELECT * FROM table2"
    mock_database.db_engine_spec.engine = "postgresql"

    # Mock template processor
    mock_template_processor = Mock()
    mock_template_processor.process_template.return_value = (
        "SELECT * FROM table1; SELECT * FROM table2"
    )
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    # Mock SQLScript to simulate multiple statements
    with patch("superset.connectors.sqla.utils.SQLScript") as mock_sqlscript_class:
        mock_script = Mock()
        mock_script.has_mutation.return_value = False
        mock_script.statements = [Mock(), Mock()]  # Two statements
        mock_sqlscript_class.return_value = mock_script

        with pytest.raises(SupersetSecurityException) as exc_info:
            get_virtual_table_metadata(mock_dataset)

        assert (
            exc_info.value.error.error_type
            == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )
        assert "Only single queries supported" in exc_info.value.error.message
