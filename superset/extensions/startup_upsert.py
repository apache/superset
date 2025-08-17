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
from typing import Any

from superset.commands.extension.upsert import UpsertExtensionCommand
from superset.distributed_lock import KeyValueDistributedLock
from superset.exceptions import CreateKeyValueDistributedLockFailedException
from superset.extensions.models import Extension
from superset.extensions.types import LoadedExtension

logger = logging.getLogger(__name__)


class LockedExtensionUpsertCommand:
    """Command for upserting extensions with distributed locking during startup."""

    def __init__(self, extension: LoadedExtension, lock_timeout: int = 30):
        """
        Initialize the locked upsert command.

        Args:
            extension: Extension to upsert
            lock_timeout: Timeout in seconds for lock acquisition
        """
        self.extension = extension
        self.lock_timeout = lock_timeout

    def run(self) -> Extension | None:
        """
        Upsert extension with distributed locking.

        Returns:
            Extension instance if successful, None if lock could not be acquired

        Raises:
            Exception: If upsert operation fails after acquiring lock
        """
        lock_namespace = "extension_upsert"
        lock_params = {"extension_name": self.extension.name}

        logger.debug(
            f"Attempting to acquire lock for extension '{self.extension.name}'"
        )

        try:
            with KeyValueDistributedLock(namespace=lock_namespace, **lock_params):
                logger.info(f"Acquired lock for extension '{self.extension.name}'")
                return self._perform_upsert()

        except CreateKeyValueDistributedLockFailedException:
            logger.info(
                f"Extension '{self.extension.name}' is being updated by another worker"
                ", skipping"
            )
            return None
        except Exception as e:
            logger.error(f"Failed to upsert extension '{self.extension.name}': {e}")
            raise

    def _perform_upsert(self) -> Extension:
        """
        Perform the actual upsert operation.

        Returns:
            Extension instance
        """
        upsert_data = {
            "name": self.extension.name,
            "manifest": self.extension.manifest,
            "frontend": self.extension.frontend,
            "backend": self.extension.backend,
            "enabled": True,  # Enable extensions by default during startup
        }

        logger.debug(f"Upserting extension '{self.extension.name}'")

        result = UpsertExtensionCommand(upsert_data).run()

        logger.info(
            f"Successfully upserted extension '{self.extension.name}' (ID: {result.id})"
        )
        return result


class ExtensionStartupUpdateOrchestrator:
    """Orchestrates extension updates during application startup."""

    def __init__(self, lock_timeout: int = 30):
        """
        Initialize the orchestrator.

        Args:
            lock_timeout: Timeout in seconds for lock acquisition per extension
        """
        self.lock_timeout = lock_timeout

    def update_extensions(self, extensions_path: str) -> dict[str, Any]:
        """
        Update extensions from filesystem during startup.

        Args:
            extensions_path: Path to directory containing extension bundles

        Returns:
            Dictionary with update statistics
        """
        from superset.daos.extension import ExtensionDAO
        from superset.extensions.discovery import discover_and_load_extensions

        stats = {
            "discovered": 0,
            "updated": 0,
            "skipped_locked": 0,
            "skipped_unchanged": 0,
            "errors": 0,
        }

        logger.info(f"Starting extension update process from path: {extensions_path}")

        try:
            # Discover and load extensions from filesystem
            for filesystem_extension in discover_and_load_extensions(extensions_path):
                stats["discovered"] += 1

                try:
                    # Check if extension exists in database
                    db_extension = ExtensionDAO.get_by_name(filesystem_extension.name)

                    # Compare checksums to determine if update is needed
                    if (
                        db_extension
                        and filesystem_extension.checksum == db_extension.checksum
                    ):
                        stats["skipped_unchanged"] += 1
                        continue

                    # Perform locked upsert
                    upsert_command = LockedExtensionUpsertCommand(
                        filesystem_extension, self.lock_timeout
                    )
                    result = upsert_command.run()

                    if result is not None:
                        stats["updated"] += 1
                    else:
                        stats["skipped_locked"] += 1

                except Exception as e:
                    logger.error(
                        f"Error processing extension '{filesystem_extension.name}': {e}"
                    )
                    stats["errors"] += 1

        except Exception as e:
            logger.error(f"Error during extension update process: {e}")
            stats["errors"] += 1

        logger.info(
            f"Extension update process completed. "
            f"Discovered: {stats['discovered']}, "
            f"Updated: {stats['updated']}, "
            f"Skipped (locked): {stats['skipped_locked']}, "
            f"Skipped (unchanged): {stats['skipped_unchanged']}, "
            f"Errors: {stats['errors']}"
        )

        return stats
