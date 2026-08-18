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
from __future__ import annotations

import logging
import time
from datetime import datetime

import sqlalchemy as sa

from superset import db
from superset.commands.base import BaseCommand
from superset.key_value.models import KeyValueEntry

logger = logging.getLogger(__name__)


# pylint: disable=consider-using-transaction
class KeyValuePruneCommand(BaseCommand):
    """
    Command to prune the key-value store by deleting entries whose expiry has
    already passed.

    The metastore-backed key-value store keeps an `expires_on` timestamp for
    entries written with a timeout (for example, the metastore cache backend).
    Unlike cache backends that evict on read, the metastore does not remove rows
    on its own, so expired entries remain in the table until something deletes
    them. This command performs that housekeeping by deleting every entry whose
    `expires_on` is in the past, freeing up space in the table.

    Attributes:
        max_rows_per_run (int | None): The maximum number of rows to delete in a
                                       single run. If provided and greater than
                                       zero, rows are selected deterministically
                                       from the oldest first by id up to this
                                       limit in this execution.
    """

    def __init__(self, max_rows_per_run: int | None = None):
        """
        :param max_rows_per_run: The maximum number of rows to delete in a single run.
            If provided and greater than zero, rows are selected deterministically from
            the oldest first by id up to this limit in this execution.
        """
        self.max_rows_per_run = max_rows_per_run

    def run(self) -> None:
        """
        Executes the prune command
        """
        batch_size = 999  # SQLite has a IN clause limit of 999
        total_deleted = 0
        start_time = time.time()

        # Capture a single cutoff timestamp and reuse it for both the selection
        # and the delete. Reusing the same value (rather than calling
        # datetime.now() again at delete time) keeps the delete predicate
        # consistent with the selection and re-checks expiry on delete, so an
        # entry refreshed (expires_on moved into the future) between selection
        # and deletion is not removed.
        cutoff = datetime.now()

        # Select all IDs whose expiry has already passed. Entries without an
        # expiry (expires_on IS NULL) never expire and are left untouched. The
        # `<=` comparison matches KeyValueEntry.is_expired() and
        # KeyValueDAO.delete_expired_entries() so all expiry checks agree.
        select_stmt = sa.select(KeyValueEntry.id).where(
            KeyValueEntry.expires_on.isnot(None),
            KeyValueEntry.expires_on <= cutoff,
        )

        # Optionally limited by max_rows_per_run
        # order by oldest first for deterministic deletion
        if self.max_rows_per_run is not None and self.max_rows_per_run > 0:
            select_stmt = select_stmt.order_by(KeyValueEntry.id.asc()).limit(
                self.max_rows_per_run
            )

        ids_to_delete = db.session.execute(select_stmt).scalars().all()

        total_rows = len(ids_to_delete)

        logger.info("Total rows to be deleted: %s", f"{total_rows:,}")

        next_logging_threshold = 1

        # Iterate over the IDs in batches
        for i in range(0, total_rows, batch_size):
            batch_ids = ids_to_delete[i : i + batch_size]

            # Delete the selected batch using IN clause. The expiry predicate is
            # re-applied here (against the same cutoff captured before selection)
            # so an entry refreshed between selection and deletion is left intact.
            result = db.session.execute(
                sa.delete(KeyValueEntry).where(
                    KeyValueEntry.id.in_(batch_ids),
                    KeyValueEntry.expires_on.isnot(None),
                    KeyValueEntry.expires_on <= cutoff,
                )
            )

            # Update the total number of deleted records
            total_deleted += result.rowcount

            # Explicitly commit the transaction so that, if an error occurs, the
            # records deleted so far are committed
            db.session.commit()

            # Log the number of deleted records every 1% increase in progress
            percentage_complete = (total_deleted / total_rows) * 100
            if percentage_complete >= next_logging_threshold:
                logger.info(
                    "Deleted %s expired rows from the key-value store (%d%% complete)",
                    f"{total_deleted:,}",
                    percentage_complete,
                )
                next_logging_threshold += 1

        elapsed_time = time.time() - start_time
        minutes, seconds = divmod(elapsed_time, 60)
        formatted_time = f"{int(minutes):02}:{int(seconds):02}"
        logger.info(
            "Pruning complete: %s expired rows deleted in %s",
            f"{total_deleted:,}",
            formatted_time,
        )

    def validate(self) -> None:
        pass
