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
import time
from datetime import datetime, timedelta

import sqlalchemy as sa
from superset_core.api.tasks import TaskStatus

from superset import db
from superset.commands.base import BaseCommand

logger = logging.getLogger(__name__)


# pylint: disable=consider-using-transaction
class TaskPruneCommand(BaseCommand):
    """
    Command to prune the tasks table by deleting rows older than the specified
    retention period.

    This command deletes records from the `Task` table that are in terminal states
    (success, failure, aborted, or timed_out) and have not been changed within the
    specified number of days. It helps in maintaining the database by removing
    outdated entries and freeing up space.

    Attributes:
        retention_period_days (int): The number of days for which records should be retained.
                                     Records older than this period will be deleted.
        max_rows_per_run (int | None): The maximum number of rows to delete in a single run.
                                       If provided and greater than zero, rows are selected
                                       deterministically from the oldest first (by timestamp then id)
                                       up to this limit in this execution.
    """  # noqa: E501

    def __init__(self, retention_period_days: int, max_rows_per_run: int | None = None):
        """
        :param retention_period_days: Number of days to keep in the tasks table
        :param max_rows_per_run: The maximum number of rows to delete in a single run.
            If provided and greater than zero, rows are selected deterministically from the
            oldest first (by timestamp then id) up to this limit in this execution.
        """  # noqa: E501
        self.retention_period_days = retention_period_days
        self.max_rows_per_run = max_rows_per_run

    def run(self) -> None:
        """
        Executes the prune command
        """
        batch_size = 999  # SQLite has a IN clause limit of 999
        total_deleted = 0
        start_time = time.time()

        # Select all IDs that need to be deleted
        # Only delete completed tasks (success, failure, or aborted)
        from superset.models.tasks import Task

        select_stmt = sa.select(Task.id).where(
            Task.ended_at < datetime.now() - timedelta(days=self.retention_period_days),
            Task.status.in_(
                [
                    TaskStatus.SUCCESS.value,
                    TaskStatus.FAILURE.value,
                    TaskStatus.ABORTED.value,
                    TaskStatus.TIMED_OUT.value,
                ]
            ),
        )

        # Optionally limited by max_rows_per_run
        # order by oldest first for deterministic deletion
        if self.max_rows_per_run is not None and self.max_rows_per_run > 0:
            select_stmt = select_stmt.order_by(
                Task.ended_at.asc(), Task.id.asc()
            ).limit(self.max_rows_per_run)

        ids_to_delete = db.session.execute(select_stmt).scalars().all()

        total_rows = len(ids_to_delete)

        logger.info("Total rows to be deleted: %s", f"{total_rows:,}")

        next_logging_threshold = 1

        # Iterate over the IDs in batches
        for i in range(0, total_rows, batch_size):
            batch_ids = ids_to_delete[i : i + batch_size]

            # Delete the selected batch using IN clause
            result = db.session.execute(sa.delete(Task).where(Task.id.in_(batch_ids)))

            # Update the total number of deleted records
            total_deleted += result.rowcount

            # Explicitly commit the transaction given that if an error occurs, we want to ensure that the  # noqa: E501
            # records that have been deleted so far are committed
            db.session.commit()

            # Log the number of deleted records every 1% increase in progress
            percentage_complete = (total_deleted / total_rows) * 100
            if percentage_complete >= next_logging_threshold:
                logger.info(
                    "Deleted %s rows from the tasks table older than %s days (%d%% complete)",  # noqa: E501
                    f"{total_deleted:,}",
                    self.retention_period_days,
                    percentage_complete,
                )
                next_logging_threshold += 1

        elapsed_time = time.time() - start_time
        minutes, seconds = divmod(elapsed_time, 60)
        formatted_time = f"{int(minutes):02}:{int(seconds):02}"
        logger.info(
            "Pruning complete: %s rows deleted in %s",
            f"{total_deleted:,}",
            formatted_time,
        )

    def validate(self) -> None:
        pass
