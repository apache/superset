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

import json  # noqa: TID251
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, Callable, cast

import click
import semver
from jinja2 import Environment, FileSystemLoader
from superset_core.extensions.types import Manifest, Metadata
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from superset_extensions_cli.constants import MIN_NPM_VERSION
from superset_extensions_cli.utils import read_json, read_toml

REMOTE_ENTRY_REGEX = re.compile(r"^remoteEntry\..+\.js$")
FRONTEND_DIST_REGEX = re.compile(r"/frontend/dist")


def validate_npm() -> None:
    """Abort if `npm` is not on PATH."""
    if shutil.which("npm") is None:
        click.secho(
            "❌ npm is not installed or not on your PATH.",
            err=True,
            fg="red",
        )
        sys.exit(1)

    try:
        result = subprocess.run(  # noqa: S603
            ["npm", "-v"],  # noqa: S607
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.returncode != 0:
            click.secho(
                f"❌ Failed to run `npm -v`: {result.stderr.strip()}",
                err=True,
                fg="red",
            )
            sys.exit(1)

        npm_version = result.stdout.strip()
        if semver.compare(npm_version, MIN_NPM_VERSION) < 0:
            click.secho(
                f"❌ npm version {npm_version} is lower than the required {MIN_NPM_VERSION}.",  # noqa: E501
                err=True,
                fg="red",
            )
            sys.exit(1)

    except FileNotFoundError:
        click.secho(
            "❌ npm was not found when checking its version.",
            err=True,
            fg="red",
        )
        sys.exit(1)


def init_frontend_deps(frontend_dir: Path) -> None:
    """
    If node_modules is missing under `frontend_dir`, run `npm ci` if package-lock.json
    exists, otherwise run `npm i`.
    """
    node_modules = frontend_dir / "node_modules"
    if not node_modules.exists():
        package_lock = frontend_dir / "package-lock.json"
        if package_lock.exists():
            click.secho("⚙️  node_modules not found, running `npm ci`…", fg="cyan")
            npm_command = ["npm", "ci"]
            error_msg = "❌ `npm ci` failed. Aborting."
        else:
            click.secho("⚙️  node_modules not found, running `npm i`…", fg="cyan")
            npm_command = ["npm", "i"]
            error_msg = "❌ `npm i` failed. Aborting."

        validate_npm()
        res = subprocess.run(  # noqa: S603
            npm_command,  # noqa: S607
            cwd=frontend_dir,
            text=True,
        )
        if res.returncode != 0:
            click.secho(error_msg, err=True, fg="red")
            sys.exit(1)
        click.secho("✅ Dependencies installed", fg="green")


def clean_dist(cwd: Path) -> None:
    dist_dir = cwd / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir(parents=True)


def clean_dist_frontend(cwd: Path) -> None:
    frontend_dist = cwd / "dist" / "frontend"
    if frontend_dist.exists():
        shutil.rmtree(frontend_dist)


def build_manifest(cwd: Path, remote_entry: str | None) -> Manifest:
    extension: Metadata = cast(Metadata, read_json(cwd / "extension.json"))
    if not extension:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    manifest: Manifest = {
        "id": extension["id"],
        "name": extension["name"],
        "version": extension["version"],
        "permissions": extension["permissions"],
        "dependencies": extension.get("dependencies", []),
    }
    if (
        (frontend := extension.get("frontend"))
        and (contributions := frontend.get("contributions"))
        and (module_federation := frontend.get("moduleFederation"))
        and remote_entry
    ):
        manifest["frontend"] = {
            "contributions": contributions,
            "moduleFederation": module_federation,
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


def rebuild_frontend(cwd: Path, frontend_dir: Path) -> str | None:
    """Clean and rebuild frontend, return the remoteEntry filename."""
    clean_dist_frontend(cwd)

    res = run_frontend_build(frontend_dir)
    if res.returncode != 0:
        click.secho("❌ Frontend build failed", fg="red")
        return None

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
    validate_npm()

    click.secho("✅ Validation successful", fg="green")


@app.command()
@click.pass_context
def build(ctx: click.Context) -> None:
    ctx.invoke(validate)
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    clean_dist(cwd)

    # Build frontend if it exists
    remote_entry = None
    if frontend_dir.exists():
        init_frontend_deps(frontend_dir)
        remote_entry = rebuild_frontend(cwd, frontend_dir)

    # Build backend independently if it exists
    if backend_dir.exists():
        pyproject = read_toml(backend_dir / "pyproject.toml")
        if pyproject:
            rebuild_backend(cwd)

    # Build manifest and write it
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
    id_ = manifest["id"]
    version = manifest["version"]
    default_filename = f"{id_}-{version}.supx"

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
@click.pass_context
def dev(ctx: click.Context) -> None:
    cwd = Path.cwd()
    frontend_dir = cwd / "frontend"
    backend_dir = cwd / "backend"

    clean_dist(cwd)

    # Build frontend if it exists
    remote_entry = None
    if frontend_dir.exists():
        init_frontend_deps(frontend_dir)
        remote_entry = rebuild_frontend(cwd, frontend_dir)

    # Build backend if it exists
    if backend_dir.exists():
        rebuild_backend(cwd)

    manifest = build_manifest(cwd, remote_entry)
    write_manifest(cwd, manifest)

    def frontend_watcher() -> None:
        if frontend_dir.exists():
            if (remote_entry := rebuild_frontend(cwd, frontend_dir)) is not None:
                manifest = build_manifest(cwd, remote_entry)
                write_manifest(cwd, manifest)

    def backend_watcher() -> None:
        if backend_dir.exists():
            rebuild_backend(cwd)
            dist_dir = cwd / "dist"
            manifest_path = dist_dir / "manifest.json"
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text())
                write_manifest(cwd, manifest)

    # Build watch message based on existing directories
    watch_dirs = []
    if frontend_dir.exists():
        watch_dirs.append(str(frontend_dir))
    if backend_dir.exists():
        watch_dirs.append(str(backend_dir))

    if watch_dirs:
        click.secho(f"👀 Watching for changes in: {', '.join(watch_dirs)}", fg="green")
    else:
        click.secho("⚠️  No frontend or backend directories found to watch", fg="yellow")

    observer = Observer()

    # Only set up watchers for directories that exist
    if frontend_dir.exists():
        frontend_handler = FrontendChangeHandler(trigger_build=frontend_watcher)
        observer.schedule(frontend_handler, str(frontend_dir), recursive=True)

    if backend_dir.exists():
        backend_handler = FileSystemEventHandler()
        backend_handler.on_any_event = lambda event: backend_watcher()
        observer.schedule(backend_handler, str(backend_dir), recursive=True)

    if watch_dirs:
        observer.start()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            click.secho("\n🛑 Stopping watch mode", fg="blue")
            observer.stop()

        observer.join()
    else:
        click.secho("❌ No directories to watch. Exiting.", fg="red")


@app.command()
def init() -> None:
    id_ = click.prompt("Extension ID (unique identifier, alphanumeric only)", type=str)
    if not re.match(r"^[a-zA-Z0-9_]+$", id_):
        click.secho(
            "❌ ID must be alphanumeric (letters, digits, underscore).", fg="red"
        )
        sys.exit(1)

    name = click.prompt("Extension name (human-readable display name)", type=str)
    version = click.prompt("Initial version", default="0.1.0")
    license = click.prompt("License", default="Apache-2.0")
    include_frontend = click.confirm("Include frontend?", default=True)
    include_backend = click.confirm("Include backend?", default=True)

    target_dir = Path.cwd() / id_
    if target_dir.exists():
        click.secho(f"❌ Directory {target_dir} already exists.", fg="red")
        sys.exit(1)

    # Set up Jinja environment
    templates_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(templates_dir))  # noqa: S701
    ctx = {
        "id": id_,
        "name": name,
        "include_frontend": include_frontend,
        "include_backend": include_backend,
        "license": license,
        "version": version,
    }

    # Create base directory
    target_dir.mkdir()
    extension_json = env.get_template("extension.json.j2").render(ctx)
    (target_dir / "extension.json").write_text(extension_json)
    click.secho("✅ Created extension.json", fg="green")

    # Copy frontend template
    if include_frontend:
        frontend_dir = target_dir / "frontend"
        frontend_dir.mkdir()

        # package.json
        package_json = env.get_template("frontend/package.json.j2").render(ctx)
        (frontend_dir / "package.json").write_text(package_json)
        click.secho("✅ Created frontend folder structure", fg="green")

    # Copy backend template
    if include_backend:
        backend_dir = target_dir / "backend"
        backend_dir.mkdir()

        # pyproject.toml
        pyproject_toml = env.get_template("backend/pyproject.toml.j2").render(ctx)
        (backend_dir / "pyproject.toml").write_text(pyproject_toml)

        click.secho("✅ Created backend folder structure", fg="green")

    click.secho(
        f"🎉 Extension {name} (ID: {id_}) initialized at {target_dir}", fg="cyan"
    )


if __name__ == "__main__":
    app()
