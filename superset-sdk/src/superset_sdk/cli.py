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
import sys
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import click

from superset_sdk.utils import read_json, read_toml


@click.group(help="CLI for validating and bundling Superset extensions.")
def app() -> None:
    pass


@app.command()
def validate() -> None:
    """
    Validate extension.
    """
    # TODO: add validation logic
    click.secho("✅ Validation successful", fg="green")


@app.command()
def bundle() -> None:
    """
    Bundle extension files into a zip file: {name}-{version}.zip
    """
    cwd = Path.cwd()
    package = read_json(cwd / "frontend" / "package.json")
    extension = read_json(cwd / "extension.json")
    backend_path = cwd / "backend"
    pyproject = read_toml(backend_path / "pyproject.toml")
    manifest: dict[str, Any] = {}

    if not extension:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    manifest["name"] = name = extension["name"]
    manifest["version"] = version = extension["version"]
    zip_name = f"{name}-{version}.zip"

    backend = extension.get("backend", {})
    frontend = extension.get("frontend", {})
    manifest["dependencies"] = extension.get("dependencies", [])
    manifest["frontend"] = {
        "contributions": frontend.get("contributions", []),
        "moduleFederation": frontend.get("moduleFederation", {}),
    }
    manifest["backend"] = {}
    if entry_points := backend.get("entryPoints", ""):
        manifest["backend"]["entryPoints"] = entry_points

    try:
        with TemporaryDirectory() as temp_dir:
            temp_manifest_path = Path(temp_dir) / "manifest.json"
            temp_manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True)
            )

            with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(temp_manifest_path, "manifest.json")

                # bundle frontend assets
                if package:
                    dist_path = cwd / "frontend" / "dist"
                    for file in dist_path.rglob("*"):
                        if file.is_file():
                            arcname = file.relative_to(Path.cwd())
                            zipf.write(file, arcname)

                # bundle backend assets
                if pyproject:
                    for pattern in backend.get("files", []):
                        for file in cwd.glob(pattern):
                            arcname = file.relative_to(cwd)
                            zipf.write(file, arcname)

    except Exception as ex:
        click.secho(f"❌ Failed to create bundle: {ex}", err=True, fg="red")
        sys.exit(1)

    click.secho(f"✅ Bundle created: {zip_name}", fg="green")


if __name__ == "__main__":
    app()
