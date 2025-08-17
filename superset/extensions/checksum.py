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
from base64 import b64encode
from typing import Any

from superset_core.extensions.types import Manifest

from superset.extensions.models import Extension
from superset.extensions.types import LoadedExtension
from superset.utils.hashing import md5_sha_from_dict

logger = logging.getLogger(__name__)


class ExtensionChecksumService:
    """Service for calculating deterministic checksums for extensions."""

    @staticmethod
    def calculate_checksum(
        name: str,
        manifest: Manifest,
        frontend: dict[str, bytes] | None,
        backend: dict[str, bytes] | None,
    ) -> str:
        """
        Calculate deterministic checksum for extension data.

        Args:
            name: Extension name
            manifest: Extension manifest dictionary
            frontend: Frontend assets as bytes dictionary
            backend: Backend assets as bytes dictionary

        Returns:
            MD5/SHA checksum string
        """
        # Ensure deterministic ordering for all components
        extension_dict = {
            "name": name,
            "manifest": ExtensionChecksumService._sort_dict_recursively(manifest),
            "frontend": ExtensionChecksumService._sort_and_encode_assets(frontend),
            "backend": ExtensionChecksumService._sort_and_encode_assets(backend),
        }

        checksum = md5_sha_from_dict(extension_dict)
        logger.debug(f"Calculated checksum for extension '{name}': {checksum}")
        return checksum

    @staticmethod
    def _sort_dict_recursively(obj: Any) -> Any:
        """
        Recursively sort dictionaries for deterministic ordering.

        Args:
            obj: Object to sort (dict, list, or primitive)

        Returns:
            Sorted object with same structure
        """
        if isinstance(obj, dict):
            return {
                k: ExtensionChecksumService._sort_dict_recursively(v)
                for k, v in sorted(obj.items())
            }
        elif isinstance(obj, list):
            return [
                ExtensionChecksumService._sort_dict_recursively(item) for item in obj
            ]
        return obj

    @staticmethod
    def _sort_and_encode_assets(
        assets: dict[str, bytes] | None,
    ) -> dict[str, str] | None:
        """
        Sort asset dictionary and encode for consistent checksum calculation.

        Args:
            assets: Dictionary of filename -> bytes content

        Returns:
            Sorted dictionary of filename -> base64 encoded content, or None
        """
        if not assets:
            return None

        return {k: b64encode(v).decode("utf-8") for k, v in sorted(assets.items())}


class ExtensionChecksumComparator:
    """Service for comparing extension checksums to determine update necessity."""

    @staticmethod
    def needs_update(
        filesystem_extension: LoadedExtension, db_extension: Extension | None
    ) -> bool:
        """
        Compare checksums to determine if extension update is needed.

        Args:
            filesystem_extension: Extension loaded from filesystem
            db_extension: Extension from database, or None if not exists

        Returns:
            True if update is needed, False otherwise
        """
        if not db_extension:
            logger.info(
                f"Extension '{filesystem_extension.name}' not found in database "
                "- update needed"
            )
            return True

        fs_checksum = filesystem_extension.checksum
        db_checksum = db_extension.checksum

        needs_update = fs_checksum != db_checksum

        if needs_update:
            logger.info(
                f"Extension '{filesystem_extension.name}' checksum mismatch "
                "- update needed. "
                f"FS: {fs_checksum}, DB: {db_checksum}"
            )
        else:
            logger.debug(
                f"Extension '{filesystem_extension.name}' checksums match. "
                f"Checksum: {fs_checksum}"
            )

        return needs_update
