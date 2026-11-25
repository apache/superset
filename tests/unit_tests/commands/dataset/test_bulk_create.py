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
from uuid import uuid4

import pytest
from flask import Flask
from marshmallow import ValidationError

from superset.commands.dataset.bulk_create import BulkCreateDatasetsCommand
from superset.commands.dataset.exceptions import (
    DatasetDataAccessIsNotAllowed,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.datasets.schemas import DatasetBulkCreateSchema
from superset.sql.parse import Table


@pytest.mark.parametrize(
    "tables",
    [[], [""], ["a", "a"], [str(i) for i in range(101)]],
)
def test_bulk_registration_rejects_invalid_selections(tables: list[str]) -> None:
    """Reject empty, duplicated, or oversized batches before starting work."""
    with pytest.raises(ValidationError):
        DatasetBulkCreateSchema().load({"database": 1, "tables": tables})


def test_bulk_registration_handles_mixed_results() -> None:
    """Continue after validation failures and skip only authorized duplicates."""
    created_uuid = uuid4()
    existing = DatasetExistsValidationError(Table("existing", "public"))
    denied = DatasetDataAccessIsNotAllowed("Access denied")
    with patch("superset.commands.dataset.bulk_create.CreateDatasetCommand") as create:
        create.return_value.run.side_effect = [
            Mock(uuid=created_uuid),
            DatasetInvalidError(exceptions=[existing]),
            DatasetInvalidError(exceptions=[existing, denied]),
            DatasetInvalidError(
                exceptions=[TableNotFoundValidationError(Table("missing", "public"))]
            ),
            Mock(uuid=uuid4()),
        ]
        results = BulkCreateDatasetsCommand(
            {
                "database": 1,
                "catalog": "warehouse",
                "schema": "public",
                "tables": ["new", "existing", "denied", "missing", "last"],
            }
        ).run()

    assert [result["status"] for result in results] == [
        "created",
        "skipped",
        "failed",
        "failed",
        "created",
    ]
    assert results[0]["uuid"] == str(created_uuid)
    assert "Access denied" in results[2]["message"]
    assert results[1]["uuid"] is None
    assert create.call_args_list[0].args[0] == {
        "database": 1,
        "catalog": "warehouse",
        "schema": "public",
        "table_name": "new",
    }


def test_bulk_registration_does_not_expose_internal_errors() -> None:
    """Keep internal errors private and continue processing subsequent tables."""
    with patch("superset.commands.dataset.bulk_create.CreateDatasetCommand") as create:
        create.return_value.run.side_effect = [
            RuntimeError("private connection details"),
            Mock(uuid=uuid4()),
        ]
        results = BulkCreateDatasetsCommand(
            {"database": 1, "tables": ["bad", "good"]}
        ).run()
    assert [result["status"] for result in results] == ["failed", "created"]
    assert "private" not in results[0]["message"]


def test_bulk_registration_commits_each_table_independently() -> None:
    """A failed command rolls back its own work while later tables still commit."""
    from superset.exceptions import SupersetException

    datasets = [Mock(uuid=uuid4()) for _ in range(3)]
    datasets[1].fetch_metadata.side_effect = SupersetException("metadata failed")
    with (
        Flask(__name__).app_context(),
        patch("superset.commands.dataset.create.CreateDatasetCommand.validate"),
        patch(
            "superset.commands.dataset.create.DatasetDAO.create", side_effect=datasets
        ),
        patch("superset.db.session") as session,
    ):
        results = BulkCreateDatasetsCommand(
            {"database": 1, "tables": ["first", "bad", "last"]}
        ).run()
        assert session.commit.call_count == 2
        assert session.rollback.call_count == 1
    assert [result["status"] for result in results] == ["created", "failed", "created"]
