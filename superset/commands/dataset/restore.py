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
"""Command to restore a soft-deleted dataset."""

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetLogicalDuplicateError,
    DatasetNotFoundError,
    DatasetRestoreFailedError,
)
from superset.commands.restore import BaseRestoreCommand
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.extensions import db


class RestoreDatasetCommand(BaseRestoreCommand[SqlaTable]):
    """Restore a soft-deleted dataset by clearing its ``deleted_at`` field.

    Most behaviour is inherited from ``BaseRestoreCommand``. The override
    here adds a logical-duplicate check: ``SqlaTable`` uniqueness is
    enforced in application code (no DB constraint), so it is possible
    for another active dataset to have claimed the same ``(database_id,
    catalog, schema, table_name)`` while this one was soft-deleted.
    Restore should not silently produce two active datasets pointing at
    the same physical table.
    """

    dao = DatasetDAO
    not_found_exc = DatasetNotFoundError
    forbidden_exc = DatasetForbiddenError
    restore_failed_exc = DatasetRestoreFailedError

    def validate(self) -> SqlaTable:  # type: ignore[override]
        model = super().validate()
        if self._has_active_logical_duplicate(model):
            raise DatasetLogicalDuplicateError()
        return model

    @staticmethod
    def _has_active_logical_duplicate(model: SqlaTable) -> bool:
        """Return True iff another active dataset uses the same physical table.

        Relies on the ``SoftDeleteMixin`` listener to auto-append
        ``deleted_at IS NULL`` to the query, so only active rows are
        considered. ``id != model.id`` excludes the row being restored
        from the match. A future change that adds
        ``skip_visibility_filter=True`` to this path would silently
        broaden the check to soft-deleted rows and could refuse a
        legitimate restore.

        Caller assumes an active Flask request / app context via
        ``db.session``.
        """
        return (
            db.session.query(SqlaTable.id)
            .filter(
                SqlaTable.database_id == model.database_id,
                SqlaTable.catalog == model.catalog,
                SqlaTable.schema == model.schema,
                SqlaTable.table_name == model.table_name,
                SqlaTable.id != model.id,
            )
            .first()
            is not None
        )
