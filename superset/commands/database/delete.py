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
import logging
from functools import partial
from typing import Optional

from flask_babel import lazy_gettext as _

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseDeleteDatasetsExistFailedError,
    DatabaseDeleteFailedError,
    DatabaseDeleteFailedReportsExistError,
    DatabaseDeleteSoftDeletedDatasetsExistFailedError,
    DatabaseNotFoundError,
)
from superset.daos.database import DatabaseDAO
from superset.daos.report import ReportScheduleDAO
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteDatabaseCommand(BaseCommand):
    def __init__(self, model_id: int):
        self._model_id = model_id
        self._model: Optional[Database] = None

    @transaction(on_error=partial(on_error, reraise=DatabaseDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        DatabaseDAO.delete([self._model])

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()
        # Check there are no associated ReportSchedules

        if reports := ReportScheduleDAO.find_by_database_id(self._model_id):
            report_names = [report.name for report in reports]
            raise DatabaseDeleteFailedReportsExistError(
                _(
                    "There are associated alerts or reports: %(report_names)s",
                    report_names=",".join(report_names),
                )
            )
        # Check if there are datasets for this database. ``self._model.tables``
        # would now hide soft-deleted datasets (``SqlaTable`` inherits
        # ``SoftDeleteMixin``, so the relationship lazy-load applies the
        # visibility filter), letting a database whose datasets are all
        # soft-deleted look empty and be hard-deleted while ``tables.database_id``
        # rows still reference it. Count with the visibility filter bypassed so
        # soft-deleted datasets still block the delete.
        from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
            SqlaTable,
        )
        from superset.extensions import (  # pylint: disable=import-outside-toplevel
            db,
        )
        from superset.models.helpers import (  # pylint: disable=import-outside-toplevel
            skip_visibility_filter,
        )

        with skip_visibility_filter(db.session, SqlaTable):
            has_live = db.session.query(
                db.session.query(SqlaTable.id)
                .filter(
                    SqlaTable.database_id == self._model_id,
                    SqlaTable.deleted_at.is_(None),
                )
                .exists()
            ).scalar()
            has_any = db.session.query(
                db.session.query(SqlaTable.id)
                .filter(SqlaTable.database_id == self._model_id)
                .exists()
            ).scalar()
        # Both cases block the delete (a soft-deleted dataset still FK-references
        # the database), but the message differs: with only hidden rows left the
        # operator's dataset list looks empty, so say so explicitly.
        if has_live:
            raise DatabaseDeleteDatasetsExistFailedError()
        if has_any:
            raise DatabaseDeleteSoftDeletedDatasetsExistFailedError()
