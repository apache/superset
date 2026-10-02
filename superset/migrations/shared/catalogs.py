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

"""
Catalog permission helpers for the migrations that enabled catalogs per engine.

These migrations only change the metadata database schema (see the migration
files). They intentionally do not backfill catalog information for existing
databases: doing so means connecting to every analytical database, resolving its
default catalog, listing its catalogs and schemas and decrypting its credentials,
none of which is safe or reliable inside a migration.

Don't add a per-database backfill here. The migrations can't use the live
``Database`` model (it changes over time and may not match the schema at this
revision), and a local stand-in model can't connect to databases.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("alembic.env")


def upgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Intentionally a no-op; existing databases are not backfilled with catalogs.
    """
    logger.info(
        "Skipping catalog permission backfill for engines: %s",
        ", ".join(sorted(engines)) if engines else "all",
    )


def downgrade_catalog_perms(engines: set[str] | None = None) -> None:
    """
    Intentionally a no-op, mirroring ``upgrade_catalog_perms``.

    Since the upgrade creates no catalog permissions and sets no catalogs, there
    is nothing to revert, and no datasets or charts are deleted.
    """
    logger.info(
        "Skipping catalog permission rollback for engines: %s",
        ", ".join(sorted(engines)) if engines else "all",
    )
