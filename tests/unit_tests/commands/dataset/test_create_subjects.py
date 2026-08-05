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
"""Datasets must never be given viewers.

``SqlaTable`` has ``sqlatable_editors`` but no viewers table, so a ``viewers``
key in the create properties would be handed to ``setattr`` by the DAO and
silently dropped instead of granting anything.
"""

from unittest.mock import Mock, patch

from superset.commands.dataset.create import CreateDatasetCommand
from superset.models.core import Database
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType


def _group_subject(id_: int) -> Subject:
    subject = Subject()
    subject.id = id_
    subject.type = SubjectType.GROUP
    return subject


def test_dataset_create_never_populates_viewers(app_context) -> None:
    database = Mock(spec=Database)
    database.id = 1
    database.get_default_catalog.return_value = None

    command = CreateDatasetCommand(
        {"database": 1, "table_name": "some_table", "sql": "SELECT 1"}
    )

    with (
        patch(
            "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
            return_value=database,
        ),
        patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=True,
        ),
        patch("superset.commands.dataset.create.security_manager.raise_for_access"),
        patch("superset.commands.utils.populate_subject_list", return_value=[]),
        patch("superset.commands.utils.get_user_id", return_value=5),
        patch(
            "superset.subjects.utils.get_user_group_subjects",
            return_value=[_group_subject(11)],
        ),
        patch(
            "superset.subjects.utils._assigns_creator_groups_as_viewers",
            return_value=True,
        ),
    ):
        command.validate()

    assert "viewers" not in command._properties  # noqa: SLF001
