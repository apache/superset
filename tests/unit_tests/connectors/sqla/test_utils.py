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
from jinja2 import UndefinedError
from jinja2.exceptions import SecurityError

from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.utils import get_virtual_table_metadata
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
    SupersetSyntaxErrorException,
    SupersetVirtualTableParseException,
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


def test_get_virtual_table_metadata_jinja_parse_error_is_softened():
    """A parse error on SQL that contained Jinja markers is likely a
    rendering artifact (e.g. an empty ``filter_values('x')`` producing
    ``WHERE col IN ()`` or similar) — must raise the soften-able
    ``SupersetVirtualTableParseException`` so ``RefreshDatasetCommand``
    can treat it as best-effort. See #38012.
    """
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    # Input has Jinja markers, so ``_has_jinja_markers(original_sql)`` is True.
    mock_dataset.sql = "SELECT INVALID SYNTAX FROM {{ some_var }}"
    mock_database.db_engine_spec.engine = "postgresql"

    # Template renders (with empty runtime context) to genuinely
    # unparseable SQL that ``SQLScript`` rejects with
    # ``SupersetParseError``.
    mock_template_processor = Mock()
    mock_template_processor.process_template.return_value = "SELECT INVALID SYNTAX FROM"
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    with pytest.raises(SupersetVirtualTableParseException) as exc_info:
        get_virtual_table_metadata(mock_dataset)

    assert "Invalid SQL:" in str(exc_info.value.message)


def test_get_virtual_table_metadata_template_undefined_is_softened():
    """A template render failure caused by ``UndefinedError`` (missing
    runtime variable) is a "no runtime context" signal and must raise
    the soften-able ``SupersetVirtualTableParseException``. See #38012.
    """
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    mock_dataset.sql = "SELECT '{{ from_dttm.isoformat() }}'"

    # Template processor wraps jinja's ``UndefinedError`` in
    # ``SupersetSyntaxErrorException`` (see ``jinja_context.py:807-848``).
    ex = SupersetSyntaxErrorException(
        [
            SupersetError(
                message="Jinja2 template error",
                error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                level=ErrorLevel.ERROR,
            )
        ]
    )
    ex.__cause__ = UndefinedError("'from_dttm' is undefined")
    mock_template_processor = Mock()
    mock_template_processor.process_template.side_effect = ex
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    with pytest.raises(SupersetVirtualTableParseException) as exc_info:
        get_virtual_table_metadata(mock_dataset)

    assert "Template processing error" in str(exc_info.value.message)


def test_get_virtual_table_metadata_template_security_error_is_not_softened():
    """A Jinja ``SecurityError`` (sandbox violation) must NOT be
    softened — it indicates a real security-policy failure that the
    operator needs to see, not a "no runtime context" artifact. See
    codeant review on #42463.
    """
    mock_dataset = Mock(spec=SqlaTable)
    mock_database = Mock(spec=Database)
    mock_dataset.database = mock_database
    mock_dataset.sql = "SELECT {{ some_disallowed_attr }}"

    # Template processor wraps jinja's ``SecurityError`` in
    # ``SupersetSyntaxErrorException`` (see ``jinja_context.py:807-848``).
    ex = SupersetSyntaxErrorException(
        [
            SupersetError(
                message="Jinja2 template error",
                error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                level=ErrorLevel.ERROR,
            )
        ]
    )
    ex.__cause__ = SecurityError("access to attribute 'x' of ... is unsafe")
    mock_template_processor = Mock()
    mock_template_processor.process_template.side_effect = ex
    mock_dataset.get_template_processor.return_value = mock_template_processor
    mock_dataset.template_params_dict = {}

    with pytest.raises(SupersetGenericDBErrorException) as exc_info:
        get_virtual_table_metadata(mock_dataset)

    # Must be the base class, not the soften-able subclass.
    assert not isinstance(exc_info.value, SupersetVirtualTableParseException)
    assert "Template processing error" in str(exc_info.value.message)


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
