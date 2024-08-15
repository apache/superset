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
from datetime import datetime, timedelta

import sqlalchemy as sa

from superset import db
from superset.commands.base import BaseCommand
from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)


class QueryPruneCommand(BaseCommand):
    """
    Command to prune the query table by deleting rows older than the specified retention period.

    This command deletes records from the `Query` table that have not been changed within the
    specified number of days. It helps in maintaining the database by removing outdated entries
    and freeing up space.

    Attributes:
        retention_period_days (int): The number of days for which records should be retained.
                                     Records older than this period will be deleted.
    """

    def __init__(self, retention_period_days: int):
        """
        :param retention_period_days: Number of days to keep in the query table
        """
        self.retention_period_days = retention_period_days

    def run(self) -> None:
        """
        Executes the prune command.
        """
        retention_date = datetime.now() - timedelta(days=self.retention_period_days)

        # Query the total number of rows to be deleted
        total_rows = db.session.query(Query).filter(
            Query.changed_on < retention_date
        ).count()

        logger.info("Total rows to be deleted: %s", total_rows)

        batch_size = 100_000

        total_deleted = 0

        for _ in range(0, total_rows, batch_size):
            # Select a batch of records to delete
            subquery = (
                sa.select(Query.id)
                .where(Query.changed_on < retention_date)
                .limit(batch_size)
                .subquery()
            )

            # Delete the selected batch using equality
            result = db.session.execute(
                sa.delete(Query).where(Query.id == subquery.c.id).execution_options(synchronize_session="fetch")
            )

            # Update the total number of deleted records
            total_deleted += result.rowcount

            # Explicitly commit the transaction given that if an error occurs, we want to ensure that the
            # records that have been deleted so far are committed
            db.session.commit()

            # Log the number of deleted records
            logger.info(
                "Deleted %s rows from the query table older than %s days",
                total_deleted,
                self.retention_period_days,
            )

        logger.info("Pruning complete")

    def validate(self) -> None:
        pass
