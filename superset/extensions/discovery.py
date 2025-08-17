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
import os
from pathlib import Path
from typing import Generator
from zipfile import is_zipfile, ZipFile

from superset.extensions.types import LoadedExtension
from superset.extensions.utils import get_bundle_files_from_path, get_loaded_extension

logger = logging.getLogger(__name__)


class ExtensionBundleDiscovery:
    """Service for discovering and loading extension bundles from filesystem."""

    @staticmethod
    def discover_bundles(extensions_path: str) -> list[str]:
        """
        Discover extension bundles from the specified filesystem path.

        Args:
            extensions_path: Path to directory containing extension bundles

        Returns:
            List of bundle paths (.supx files or directories)
        """
        if not extensions_path or not os.path.exists(extensions_path):
            logger.warning(
                f"Extensions path does not exist or is empty: {extensions_path}"
            )
            return []

        bundles = []
        extensions_dir = Path(extensions_path)

        try:
            # Look for .supx files (Superset extension bundles)
            for supx_file in extensions_dir.glob("*.supx"):
                if is_zipfile(supx_file):
                    bundles.append(str(supx_file))
                    logger.debug(f"Found extension .supx bundle: {supx_file}")
                else:
                    logger.warning(
                        "File has .supx extension but is not a valid "
                        "zip file: {supx_file}"
                    )

            # Look for directories with dist subdirectories (built extensions)
            for item in extensions_dir.iterdir():
                if item.is_dir():
                    dist_path = item / "dist"
                    if dist_path.exists() and dist_path.is_dir():
                        bundles.append(str(item))
                        logger.debug(f"Found extension directory bundle: {item}")
                    else:
                        logger.debug(
                            f"Directory {item} does not contain dist subdirectory"
                            ", skipping"
                        )

        except Exception as e:
            logger.error(
                f"Error discovering extension bundles in {extensions_path}: {e}"
            )
            return []

        logger.info(f"Discovered {len(bundles)} extension bundles in {extensions_path}")
        return bundles

    @staticmethod
    def load_extension_from_bundle(bundle_path: str) -> LoadedExtension:
        """
        Load extension from a bundle (.supx file or directory).

        Args:
            bundle_path: Path to extension bundle

        Returns:
            LoadedExtension instance

        Raises:
            Exception: If bundle cannot be loaded or is invalid
        """
        logger.debug(f"Loading extension from bundle: {bundle_path}")

        try:
            if (
                os.path.isfile(bundle_path)
                and bundle_path.endswith(".supx")
                and is_zipfile(bundle_path)
            ):
                return ExtensionBundleDiscovery._load_from_supx(bundle_path)
            elif os.path.isdir(bundle_path):
                return ExtensionBundleDiscovery._load_from_directory(bundle_path)
            else:
                raise Exception(
                    f"Bundle path is neither a valid .supx file nor "
                    f"directory: {bundle_path}"
                )

        except Exception as e:
            logger.error(f"Failed to load extension from bundle {bundle_path}: {e}")
            raise

    @staticmethod
    def _load_from_supx(supx_path: str) -> LoadedExtension:
        """Load extension from .supx file (which is a zip file)."""
        from superset.extensions.utils import get_bundle_files_from_zip

        with ZipFile(supx_path, "r") as zip_file:
            files = get_bundle_files_from_zip(zip_file)
            extension = get_loaded_extension(files)
            logger.info(
                f"Loaded extension '{extension.name}' from .supx file: {supx_path}"
            )
            return extension

    @staticmethod
    def _load_from_directory(dir_path: str) -> LoadedExtension:
        """Load extension from directory."""
        files = get_bundle_files_from_path(dir_path)
        extension = get_loaded_extension(files)
        logger.info(f"Loaded extension '{extension.name}' from directory: {dir_path}")
        return extension

    @staticmethod
    def discover_and_load_extensions(
        extensions_path: str,
    ) -> Generator[LoadedExtension, None, None]:
        """
        Discover and load all extensions from the specified path.

        Args:
            extensions_path: Path to directory containing extension bundles

        Yields:
            LoadedExtension instances for each valid extension found
        """
        bundles = ExtensionBundleDiscovery.discover_bundles(extensions_path)

        for bundle_path in bundles:
            try:
                extension = ExtensionBundleDiscovery.load_extension_from_bundle(
                    bundle_path
                )
                yield extension
            except Exception as e:
                logger.error(f"Failed to load extension from {bundle_path}: {e}")
                # Continue with other bundles - don't let one failure stop the process
                continue
