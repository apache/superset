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
import json
from typing import Callable, Dict, List, Optional

from flask import Flask


class UIManifestProcessor:
    def __init__(self, app_dir: str) -> None:
        self.app: Optional[Flask] = None
        self.manifest: Dict[str, Dict[str, List[str]]] = {}
        self.manifest_file = f"{app_dir}/static/assets/manifest.json"

    def init_app(self, app: Flask) -> None:
        self.app = app
        # Preload the cache
        self.parse_manifest_json()
        self.register_processor(app)

    def register_processor(self, app: Flask) -> None:
        app.template_context_processors[None].append(self.get_manifest)

    def get_manifest(self) -> Dict[str, Callable[[str], List[str]]]:
        loaded_chunks = set()

        def get_files(bundle: str, asset_type: str = "js") -> List[str]:
            files = self.get_manifest_files(bundle, asset_type)
            filtered_files = [f for f in files if f not in loaded_chunks]
            for f in filtered_files:
                loaded_chunks.add(f)
            return filtered_files

        return dict(
            js_manifest=lambda bundle: get_files(bundle, "js"),
            css_manifest=lambda bundle: get_files(bundle, "css"),
            assets_prefix=self.app.config["STATIC_ASSETS_PREFIX"] if self.app else "",
        )

    def parse_manifest_json(self) -> None:
        try:
            with open(self.manifest_file, "r") as f:
                # the manifest includes non-entry files we only need entries in
                # templates
                full_manifest = json.load(f)
                self.manifest = full_manifest.get("entrypoints", {})
        except Exception:  # pylint: disable=broad-except
            pass

    def get_manifest_files(self, bundle: str, asset_type: str) -> List[str]:
        if self.app and self.app.debug:
            self.parse_manifest_json()
        return self.manifest.get(bundle, {}).get(asset_type, [])
