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
from superset.extensions.utils import get_bundle_files_from_zip, get_loaded_extension

logger = logging.getLogger(__name__)


def discover_and_load_extensions(
    extensions_path: str,
) -> Generator[LoadedExtension, None, None]:
    """
    Discover and load all .supx extension files from the specified path.

    Args:
        extensions_path: Path to directory containing .supx extension files

    Yields:
        LoadedExtension instances for each valid .supx file found
    """
    if not extensions_path or not os.path.exists(extensions_path):
        logger.warning(f"Extensions path does not exist or is empty: {extensions_path}")
        return

    extensions_dir = Path(extensions_path)

    try:
        # Look for .supx files only
        for supx_file in extensions_dir.glob("*.supx"):
            if not is_zipfile(supx_file):
                logger.warning(
                    f"File has .supx extension but is not a valid zip file: {supx_file}"
                )
                continue

            try:
                with ZipFile(supx_file, "r") as zip_file:
                    files = get_bundle_files_from_zip(zip_file)
                    extension = get_loaded_extension(files)
                    extension_id = extension.manifest["id"]
                    logger.info(f"Loaded extension '{extension_id}' from {supx_file}")
                    yield extension
            except Exception as e:
                logger.error(f"Failed to load extension from {supx_file}: {e}")
                continue

    except Exception as e:
        logger.error(f"Error discovering extensions in {extensions_path}: {e}")
