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
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
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
def build() -> None:  # noqa: C901
    """
    Build extension assets and prepare files in dist/ directory.
    """
    cwd = Path.cwd()
    dist_dir = cwd / "dist"
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    # Remove existing dist directory
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir(parents=True)

    # Run frontend build
    result = subprocess.run(  # noqa: S603
        ["npm", "run", "build"],  # noqa: S607
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        click.secho("❌ Frontend build failed.", err=True, fg="red")
        click.echo(result.stderr, err=True)
        sys.exit(1)

    extension = read_json(cwd / "extension.json")
    package = read_json(frontend_dir / "package.json")
    pyproject = read_toml(backend_dir / "pyproject.toml")

    if not extension:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    # Build manifest
    manifest: dict[str, Any] = {}
    manifest["name"] = extension["name"]
    manifest["version"] = extension["version"]
    manifest["permissions"] = extension["permissions"]
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

    # Write manifest
    (dist_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True)
    )

    # Copy frontend/dist files into dist/
    if package:
        for file in (frontend_dir / "dist").rglob("*"):
            if file.is_file():
                target_path = dist_dir / file.relative_to(cwd)
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, target_path)

    # Copy backend files into dist/
    if pyproject:
        for pattern in backend.get("files", []):
            for file in cwd.glob(pattern):
                target_path = dist_dir / file.relative_to(cwd)
                target_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, target_path)

    click.secho("✅ Build completed in dist/", fg="green")


@app.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path, dir_okay=True, file_okay=True, writable=True),
    help="Optional output path or filename for the bundle.",
)
@click.pass_context
def bundle(ctx: click.Context, output: Path | None) -> None:
    """
    Bundle dist/ into a zip file: {name}-{version}.supx
    """
    ctx.invoke(build)

    cwd = Path.cwd()
    dist_dir = cwd / "dist"
    manifest_path = dist_dir / "manifest.json"

    if not manifest_path.exists():
        click.secho(
            "❌ dist/manifest.json not found. Run `build` first.", err=True, fg="red"
        )
        sys.exit(1)

    manifest = json.loads(manifest_path.read_text())
    name = manifest["name"]
    version = manifest["version"]
    default_filename = f"{name}-{version}.supx"

    if output is None:
        zip_path = Path(default_filename)
    elif output.is_dir():
        zip_path = output / default_filename
    else:
        zip_path = output

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file in dist_dir.rglob("*"):
                if file.is_file():
                    arcname = file.relative_to(dist_dir)
                    zipf.write(file, arcname)
    except Exception as ex:
        click.secho(f"❌ Failed to create bundle: {ex}", err=True, fg="red")
        sys.exit(1)

    click.secho(f"✅ Bundle created: {zip_path}", fg="green")


if __name__ == "__main__":
    app()
