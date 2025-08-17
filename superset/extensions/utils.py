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

import importlib.abc
import importlib.util
import logging
import os
import re
import sys
from base64 import b64encode
from pathlib import Path
from typing import Any, Generator, Iterable, Tuple
from zipfile import ZipFile

from flask import current_app
from superset_core.extensions.types import Manifest

from superset.extensions.models import Extension
from superset.extensions.types import BundleFile, LoadedExtension
from superset.utils import json
from superset.utils.core import check_is_safe_zip
from superset.utils.hashing import md5_sha_from_str

logger = logging.getLogger(__name__)

FRONTEND_REGEX = re.compile(r"^frontend/dist/([^/]+)$")
BACKEND_REGEX = re.compile(r"^backend/src/(.+)$")


class InMemoryLoader(importlib.abc.Loader):
    def __init__(
        self, module_name: str, source: str, is_package: bool, origin: str
    ) -> None:
        self.module_name = module_name
        self.source = source
        self.is_package = is_package
        self.origin = origin

    def exec_module(self, module: Any) -> None:
        module.__file__ = self.origin
        module.__package__ = (
            self.module_name if self.is_package else self.module_name.rpartition(".")[0]
        )
        if self.is_package:
            module.__path__ = []
        exec(self.source, module.__dict__)  # noqa: S102


class InMemoryFinder(importlib.abc.MetaPathFinder):
    def __init__(self, file_dict: dict[str, bytes]) -> None:
        self.modules: dict[str, Tuple[Any, Any, Any]] = {}
        for path, content in file_dict.items():
            mod_name, is_package = self._get_module_name(path)
            self.modules[mod_name] = (content, is_package, path)

    def _get_module_name(self, file_path: str) -> Tuple[str, bool]:
        parts = list(Path(file_path).parts)
        is_package = parts[-1] == "__init__.py"
        if is_package:
            parts = parts[:-1]
        else:
            parts[-1] = Path(parts[-1]).stem

        mod_name = ".".join(parts)
        return mod_name, is_package

    def find_spec(self, fullname: str, path: Any, target: Any = None) -> Any | None:
        if fullname in self.modules:
            source, is_package, origin = self.modules[fullname]
            return importlib.util.spec_from_loader(
                fullname,
                InMemoryLoader(fullname, source, is_package, origin),
                origin=origin,
                is_package=is_package,
            )
        return None


def install_in_memory_importer(file_dict: dict[str, bytes]) -> None:
    finder = InMemoryFinder(file_dict)
    sys.meta_path.insert(0, finder)


def eager_import(module_name: str) -> Any:
    if module_name in sys.modules:
        return sys.modules[module_name]
    return importlib.import_module(module_name)


def get_bundle_files_from_zip(zip_file: ZipFile) -> Generator[BundleFile, None, None]:
    check_is_safe_zip(zip_file)
    for name in zip_file.namelist():
        content = zip_file.read(name)
        yield BundleFile(name=name, content=content)


def get_bundle_files_from_path(base_path: str) -> Generator[BundleFile, None, None]:
    dist_path = os.path.join(base_path, "dist")

    if not os.path.isdir(dist_path):
        raise Exception(f"Expected directory {dist_path} does not exist.")

    for root, _, files in os.walk(dist_path):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, dist_path).replace(os.sep, "/")
            with open(full_path, "rb") as f:
                content = f.read()
            yield BundleFile(name=rel_path, content=content)


def get_loaded_extension(files: Iterable[BundleFile]) -> LoadedExtension:
    manifest: Manifest = {}
    frontend: dict[str, bytes] = {}
    backend: dict[str, bytes] = {}

    for file in files:
        filename = file.name
        content = file.content

        if filename == "manifest.json":
            try:
                manifest = json.loads(content)
                if "name" not in manifest:
                    raise Exception("Missing 'name' in manifest")
            except Exception as e:
                raise Exception(f"Invalid manifest.json: {e}") from e

        elif (match := FRONTEND_REGEX.match(filename)) is not None:
            frontend[match.group(1)] = content

        elif (match := BACKEND_REGEX.match(filename)) is not None:
            backend[match.group(1)] = content

        else:
            raise Exception(f"Unexpected file in bundle: {filename}")

    name = manifest["name"]
    return LoadedExtension(
        name=name,
        manifest=manifest,
        frontend=frontend,
        backend=backend,
        enabled=True,
    )


def build_extension_data(extension: LoadedExtension) -> dict[str, Any]:
    manifest: Manifest = extension.manifest
    extension_data: dict[str, Any] = {
        "id": extension.id,
        "name": extension.name,
        "dependencies": manifest.get("dependencies", []),
        "enabled": extension.enabled,
    }
    if frontend := manifest.get("frontend"):
        module_federation = frontend.get("moduleFederation", {})
        remote_entry = frontend["remoteEntry"]
        extension_data.update(
            {
                "remoteEntry": f"/api/v1/extensions/{extension.name}/{remote_entry}",  # noqa: E501
                "exposedModules": module_federation.get("exposes", []),
                "contributions": frontend.get("contributions", {}),
            }
        )
    return extension_data


def get_extensions() -> dict[str, LoadedExtension]:
    from superset.daos.extension import ExtensionDAO

    extensions: dict[str, LoadedExtension] = {}
    for i, path in enumerate(current_app.config["LOCAL_EXTENSIONS"]):
        files = get_bundle_files_from_path(path)
        extension = get_loaded_extension(files)
        extension.id = i
        extensions[extension.name] = extension
        logger.info(f"Loading extension {extension.name} from local filesystem")

    # TODO: Do we allow local extensions that are not enabled in the metastore?

    for db_extension in ExtensionDAO.get_extensions():
        if db_extension.name not in extensions:
            extension = build_loaded_extension(db_extension)
            extensions[extension.name] = extension
            logger.info(f"Loading extension {db_extension.name} from metastore")

    return extensions


def build_loaded_extension(db_extension: Extension) -> LoadedExtension:
    extension = LoadedExtension(
        id=db_extension.id,
        name=db_extension.name,
        manifest=db_extension.manifest_dict,
        backend=db_extension.backend_dict or {},
        frontend=db_extension.frontend_dict or {},
        enabled=db_extension.enabled,
    )
    return extension


def calculate_extension_checksum(
    name: str,
    manifest: Manifest,
    frontend: dict[str, bytes] | None,
    backend: dict[str, bytes] | None,
) -> str:
    """Calculate deterministic checksum for extension data."""

    def encode_assets(assets: dict[str, bytes] | None) -> dict[str, str]:
        """Encode binary assets to base64 strings for JSON serialization."""
        if not assets:
            return {}
        return {k: b64encode(v).decode("utf-8") for k, v in assets.items()}

    extension_data = {
        "name": name,
        "manifest": manifest,
        "frontend": encode_assets(frontend),
        "backend": encode_assets(backend),
    }

    # Use JSON with sorted keys for deterministic string representation
    deterministic_json = json.dumps(extension_data, sort_keys=True)

    # Use the existing md5_sha_from_str utility (has noqa for S324)
    return md5_sha_from_str(deterministic_json)
