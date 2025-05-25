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
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, Callable

import click
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from superset_sdk.utils import read_json, read_toml

REMOTE_ENTRY_REGEX = re.compile(r"^remoteEntry\..+\.js$")
FRONTEND_DIST_REGEX = re.compile(r"\/frontend\/dist")


def clean_dist(cwd: Path) -> None:
    dist_dir = cwd / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir(parents=True)


def clean_dist_frontend(cwd: Path) -> None:
    frontend_dist = cwd / "dist" / "frontend"
    if frontend_dist.exists():
        shutil.rmtree(frontend_dist)


def build_manifest(cwd: Path, remote_entry: str) -> dict[str, Any]:
    extension = read_json(cwd / "extension.json")
    if not extension:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    manifest = {
        "name": extension["name"],
        "version": extension["version"],
        "permissions": extension["permissions"],
        "dependencies": extension.get("dependencies", []),
        "frontend": {
            "contributions": extension.get("frontend", {}).get("contributions", []),
            "moduleFederation": extension.get("frontend", {}).get(
                "moduleFederation", {}
            ),
            "remoteEntry": remote_entry,
        },
        "backend": {},
    }
    if entry_points := extension.get("backend", {}).get("entryPoints"):
        manifest["backend"]["entryPoints"] = entry_points

    return manifest


def write_manifest(cwd: Path, manifest: dict[str, Any]) -> None:
    dist_dir = cwd / "dist"
    (dist_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True)
    )


def run_frontend_build(frontend_dir: Path) -> subprocess.CompletedProcess[str]:
    """Run npm build in frontend/ and return the result."""
    click.echo()
    click.secho("⚙️  Building frontend assets…", fg="cyan")
    return subprocess.run(  # noqa: S603
        ["npm", "run", "build"],  # noqa: S607
        cwd=frontend_dir,
        text=True,
    )


def copy_frontend_dist(cwd: Path) -> str:
    """
    Copy everything from frontend/dist → dist/,
    return the remoteEntry filename (or exit on error).
    """
    dist_dir = cwd / "dist"
    frontend_dist = cwd / "frontend" / "dist"
    remote_entry: str | None = None

    for f in frontend_dist.rglob("*"):
        if not f.is_file():
            continue
        if REMOTE_ENTRY_REGEX.match(f.name):
            remote_entry = f.name
        tgt = dist_dir / f.relative_to(cwd)
        tgt.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, tgt)

    if not remote_entry:
        click.secho("❌ No remote entry file found.", err=True, fg="red")
        sys.exit(1)
    return remote_entry


def copy_backend_files(cwd: Path) -> None:
    """Copy all backend files listed in extension.json → dist/."""
    dist_dir = cwd / "dist"
    extension = read_json(cwd / "extension.json")
    if not extension:
        click.secho("❌ No extension json file found.", err=True, fg="red")
        sys.exit(1)

    for pat in extension.get("backend", {}).get("files", []):
        for f in cwd.glob(pat):
            if not f.is_file():
                continue
            tgt = dist_dir / f.relative_to(cwd)
            tgt.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, tgt)


class FrontendChangeHandler(FileSystemEventHandler):
    def __init__(self, trigger_build: Callable[[], None]):
        self.trigger_build = trigger_build

    def on_any_event(self, event: Any) -> None:
        # Ignore changes in dist/
        if FRONTEND_DIST_REGEX.search(event.src_path):
            return
        click.secho(f"🔁 Change detected in: {event.src_path}", fg="yellow")
        self.trigger_build()


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
def build() -> None:
    """
    Build extension end-to-end: clean dist/, build frontend,
    collect assets, write manifest, then copy backend.
    """
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    # 1) clean dist/
    clean_dist(cwd)

    # 2) build frontend
    result = run_frontend_build(frontend_dir)
    if result.returncode != 0:
        click.secho("❌ Frontend build failed.", err=True, fg="red")
        click.echo(result.stderr or "", err=True)
        sys.exit(1)

    # 3) copy frontend dist → dist/
    remote_entry = copy_frontend_dist(cwd)

    # 4) build and write manifest
    manifest = build_manifest(cwd, remote_entry)
    write_manifest(cwd, manifest)

    # 5) copy backend files
    pyproject = read_toml(backend_dir / "pyproject.toml")
    if pyproject:
        copy_backend_files(cwd)

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


@app.command()
def dev() -> None:
    """
    Watch frontend/ and backend/, clean once, then rebuild on changes.
    """
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    # 1) clean dist/
    clean_dist(cwd)

    # 2) initial frontend build + copy
    res = run_frontend_build(frontend_dir)
    if res.returncode != 0:
        click.secho("❌ Frontend build failed.", fg="red")
        sys.exit(1)
    remote_entry = copy_frontend_dist(cwd)

    # 3) build and write manifest
    manifest = build_manifest(cwd, remote_entry)
    write_manifest(cwd, manifest)

    # 4) copy backend files
    copy_backend_files(cwd)

    # 5) start file watchers
    def build_frontend() -> None:
        clean_dist_frontend(cwd)  # ✅ just remove frontend outputs

        res = run_frontend_build(frontend_dir)
        if res.returncode != 0:
            click.secho("❌ Frontend build failed.", fg="red")
            return

        remote_entry = copy_frontend_dist(cwd)
        manifest = build_manifest(cwd, remote_entry)
        write_manifest(cwd, manifest)

    def sync_backend() -> None:
        click.echo()
        click.secho("⚙️  Copying backend files…", fg="cyan")
        copy_backend_files(cwd)

    click.secho(
        f"👀 Watching for changes in: {frontend_dir}, {backend_dir}", fg="green"
    )

    frontend_handler = FrontendChangeHandler(trigger_build=build_frontend)
    backend_handler = FileSystemEventHandler()
    backend_handler.on_any_event = lambda event: sync_backend()

    observer = Observer()
    observer.schedule(frontend_handler, str(frontend_dir), recursive=True)
    observer.schedule(backend_handler, str(backend_dir), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        click.secho("\n🛑 Stopping watch mode.", fg="blue")
        observer.stop()

    observer.join()


if __name__ == "__main__":
    app()
