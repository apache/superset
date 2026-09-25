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


class RestoreDatasetCommand(BaseRestoreCommand[SqlaTable]):
    """Restore a soft-deleted dataset by clearing its ``deleted_at`` field.

    Most behaviour is inherited from ``BaseRestoreCommand``. The override
    here adds a logical-duplicate check: DB-level enforcement of
    ``SqlaTable`` logical uniqueness is inconsistent (the model-level
    4-column ``UniqueConstraint`` is metadata-only — no migration creates
    it — and the legacy 3-column ``_customer_location_uc`` has no catalog
    leg and is NULL-leaky), so another active dataset may have claimed the
    same physical identity while this one was soft-deleted. The
    application-level check refuses the restore with a clean 422 rather
    than relying on the DB, which would either reject with an opaque
    IntegrityError or — where no constraint applies — silently allow two
    active datasets pointing at the same physical table.
    """

    dao = DatasetDAO
    not_found_exc = DatasetNotFoundError
    forbidden_exc = DatasetForbiddenError
    restore_failed_exc = DatasetRestoreFailedError

    def validate(self) -> SqlaTable:  # type: ignore[override]
        model = super().validate()
        # DB-level uniqueness enforcement is inconsistent across schema
        # builds (see class docstring), so restoring must refuse here if
        # another active dataset claimed the same physical table while this
        # one was soft-deleted — a clean 422 instead of an IntegrityError
        # or a silent twin.
        if DatasetDAO.has_active_logical_duplicate(model):
            raise DatasetLogicalDuplicateError()
        return model
