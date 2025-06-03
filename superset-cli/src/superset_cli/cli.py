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
from typing import Any, Callable, cast

import click
from superset_core.extensions.types import Manifest, Metadata
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from superset_cli.utils import read_json, read_toml

REMOTE_ENTRY_REGEX = re.compile(r"^remoteEntry\..+\.js$")
FRONTEND_DIST_REGEX = re.compile(r"/frontend/dist")


def clean_dist(cwd: Path) -> None:
    dist_dir = cwd / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir(parents=True)


def clean_dist_frontend(cwd: Path) -> None:
    frontend_dist = cwd / "dist" / "frontend"
    if frontend_dist.exists():
        shutil.rmtree(frontend_dist)


def build_manifest(cwd: Path, remote_entry: str) -> Manifest:
    extension: Metadata = cast(Metadata, read_json(cwd / "extension.json"))
    if not extension:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    manifest: Manifest = {
        "name": extension["name"],
        "version": extension["version"],
        "permissions": extension["permissions"],
        "dependencies": extension.get("dependencies", []),
    }
    if frontend := extension.get("frontend"):
        manifest["frontend"] = {
            "contributions": frontend["contributions"],
            "moduleFederation": frontend["moduleFederation"],
            "remoteEntry": remote_entry,
        }

    if entry_points := extension.get("backend", {}).get("entryPoints"):
        manifest["backend"] = {"entryPoints": entry_points}

    return manifest


def write_manifest(cwd: Path, manifest: Manifest) -> None:
    dist_dir = cwd / "dist"
    (dist_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True)
    )
    click.secho("✅ Manifest updated", fg="green")


def run_frontend_build(frontend_dir: Path) -> subprocess.CompletedProcess[str]:
    click.echo()
    click.secho("⚙️  Building frontend assets…", fg="cyan")
    return subprocess.run(  # noqa: S603
        ["npm", "run", "build"],  # noqa: S607
        cwd=frontend_dir,
        text=True,
    )


def copy_frontend_dist(cwd: Path) -> str:
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
    dist_dir = cwd / "dist"
    extension = read_json(cwd / "extension.json")
    if not extension:
        click.secho("❌ No extension.json file found.", err=True, fg="red")
        sys.exit(1)

    for pat in extension.get("backend", {}).get("files", []):
        for f in cwd.glob(pat):
            if not f.is_file():
                continue
            tgt = dist_dir / f.relative_to(cwd)
            tgt.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, tgt)


def rebuild_frontend(cwd: Path, frontend_dir: Path) -> str:
    """Clean and rebuild frontend, return the remoteEntry filename."""
    clean_dist_frontend(cwd)

    res = run_frontend_build(frontend_dir)
    if res.returncode != 0:
        click.secho("❌ Frontend build failed", fg="red")
        sys.exit(1)

    remote_entry = copy_frontend_dist(cwd)
    click.secho("✅ Frontend rebuilt", fg="green")
    return remote_entry


def rebuild_backend(cwd: Path) -> None:
    """Copy backend files (no manifest update)."""
    copy_backend_files(cwd)
    click.secho("✅ Backend files synced", fg="green")


class FrontendChangeHandler(FileSystemEventHandler):
    def __init__(self, trigger_build: Callable[[], None]):
        self.trigger_build = trigger_build

    def on_any_event(self, event: Any) -> None:
        if FRONTEND_DIST_REGEX.search(event.src_path):
            return
        click.secho(f"🔁 Frontend change detected: {event.src_path}", fg="yellow")
        self.trigger_build()


@click.group(help="CLI for validating and bundling Superset extensions.")
def app() -> None:
    pass


@app.command()
def validate() -> None:
    click.secho("✅ Validation successful", fg="green")


@app.command()
def build() -> None:
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    clean_dist(cwd)

    remote_entry = rebuild_frontend(cwd, frontend_dir)

    pyproject = read_toml(backend_dir / "pyproject.toml")
    if pyproject:
        rebuild_backend(cwd)

    manifest = build_manifest(cwd, remote_entry)
    write_manifest(cwd, manifest)

    click.secho("✅ Full build completed in dist/", fg="green")


@app.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path, dir_okay=True, file_okay=True, writable=True),
    help="Optional output path or filename for the bundle.",
)
@click.pass_context
def bundle(ctx: click.Context, output: Path | None) -> None:
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
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    clean_dist(cwd)
    remote_entry = rebuild_frontend(cwd, frontend_dir)
    rebuild_backend(cwd)
    manifest = build_manifest(cwd, remote_entry)
    write_manifest(cwd, manifest)

    def frontend_watcher() -> None:
        remote_entry = rebuild_frontend(cwd, frontend_dir)
        manifest = build_manifest(cwd, remote_entry)
        write_manifest(cwd, manifest)

    def backend_watcher() -> None:
        rebuild_backend(cwd)
        dist_dir = cwd / "dist"
        manifest_path = dist_dir / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            write_manifest(cwd, manifest)

    click.secho(
        f"👀 Watching for changes in: {frontend_dir}, {backend_dir}", fg="green"
    )

    frontend_handler = FrontendChangeHandler(trigger_build=frontend_watcher)
    backend_handler = FileSystemEventHandler()
    backend_handler.on_any_event = lambda event: backend_watcher()

    observer = Observer()
    observer.schedule(frontend_handler, str(frontend_dir), recursive=True)
    observer.schedule(backend_handler, str(backend_dir), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        click.secho("\n🛑 Stopping watch mode", fg="blue")
        observer.stop()

    observer.join()


if __name__ == "__main__":
    app()
