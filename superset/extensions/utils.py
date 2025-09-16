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
from pathlib import Path
from typing import Any, Generator, Iterable, Tuple
from zipfile import ZipFile

from flask import current_app
from superset_core.extensions.types import Manifest

from superset.extensions.types import BundleFile, LoadedExtension
from superset.utils import json
from superset.utils.core import check_is_safe_zip

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
        raise Exception("Expected directory %s does not exist." % dist_path)

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
                if "id" not in manifest:
                    raise Exception("Missing 'id' in manifest")
                if "name" not in manifest:
                    raise Exception("Missing 'name' in manifest")
            except Exception as e:
                raise Exception("Invalid manifest.json: %s" % e) from e

        elif (match := FRONTEND_REGEX.match(filename)) is not None:
            frontend[match.group(1)] = content

        elif (match := BACKEND_REGEX.match(filename)) is not None:
            backend[match.group(1)] = content

        else:
            raise Exception("Unexpected file in bundle: %s" % filename)

    id_ = manifest["id"]
    name = manifest["name"]
    version = manifest["version"]
    return LoadedExtension(
        id=id_,
        name=name,
        manifest=manifest,
        frontend=frontend,
        backend=backend,
        version=version,
    )


def build_extension_data(extension: LoadedExtension) -> dict[str, Any]:
    manifest: Manifest = extension.manifest
    extension_data: dict[str, Any] = {
        "id": manifest["id"],
        "name": extension.name,
        "version": extension.version,
        "description": manifest.get("description", ""),
        "dependencies": manifest.get("dependencies", []),
        "extensionDependencies": manifest.get("extensionDependencies", []),
    }
    if frontend := manifest.get("frontend"):
        module_federation = frontend.get("moduleFederation", {})
        remote_entry = frontend["remoteEntry"]
        extension_data.update(
            {
                "remoteEntry": "/api/v1/extensions/%s/%s"
                % (manifest["id"], remote_entry),  # noqa: E501
                "exposedModules": module_federation.get("exposes", []),
                "contributions": frontend.get("contributions", {}),
            }
        )
    return extension_data


def get_extensions() -> dict[str, LoadedExtension]:
    extensions: dict[str, LoadedExtension] = {}

    # Load extensions from LOCAL_EXTENSIONS configuration (filesystem paths)
    for path in current_app.config["LOCAL_EXTENSIONS"]:
        files = get_bundle_files_from_path(path)
        extension = get_loaded_extension(files)
        extension_id = extension.manifest["id"]
        extensions[extension_id] = extension
        logger.info(
            "Loading extension %s (ID: %s) from local filesystem",
            extension.name,
            extension_id,
        )

    # Load extensions from discovery path (.supx files)
    if extensions_path := current_app.config.get("EXTENSIONS_PATH"):
        from superset.extensions.discovery import discover_and_load_extensions

        for extension in discover_and_load_extensions(extensions_path):
            extension_id = extension.manifest["id"]
            if extension_id not in extensions:  # Don't override LOCAL_EXTENSIONS
                extensions[extension_id] = extension
                logger.info(
                    "Loading extension %s (ID: %s) from discovery path",
                    extension.name,
                    extension_id,
                )
            else:
                logger.info(
                    "Extension %s (ID: %s) already loaded from LOCAL_EXTENSIONS, "
                    "skipping discovery version",
                    extension.name,
                    extension_id,
                )

    return extensions
