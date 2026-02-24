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
from typing import Any, Callable

import click
import semver
from jinja2 import Environment, FileSystemLoader
from superset_core.extensions.types import (
    ExtensionConfig,
    Manifest,
    ManifestBackend,
    ManifestFrontend,
)
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from superset_extensions_cli.constants import MIN_NPM_VERSION
from superset_extensions_cli.exceptions import ExtensionNameError
from superset_extensions_cli.types import ExtensionNames
from superset_extensions_cli.utils import (
    generate_extension_names,
    kebab_to_camel_case,
    kebab_to_snake_case,
    read_json,
    read_toml,
    to_kebab_case,
    to_snake_case,
    validate_extension_id,
    validate_npm_package_name,
    validate_python_package_name,
)

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
    extension_data = read_json(cwd / "extension.json")
    if not extension_data:
        click.secho("❌ extension.json not found.", err=True, fg="red")
        sys.exit(1)

    extension = ExtensionConfig.model_validate(extension_data)

    frontend: ManifestFrontend | None = None
    if extension.frontend and remote_entry:
        frontend = ManifestFrontend(
            contributions=extension.frontend.contributions,
            moduleFederation=extension.frontend.moduleFederation,
            remoteEntry=remote_entry,
        )

    backend: ManifestBackend | None = None
    if extension.backend and extension.backend.entryPoints:
        backend = ManifestBackend(entryPoints=extension.backend.entryPoints)

    return Manifest(
        id=extension.id,
        name=extension.name,
        version=extension.version,
        permissions=extension.permissions,
        dependencies=extension.dependencies,
        frontend=frontend,
        backend=backend,
    )


def write_manifest(cwd: Path, manifest: Manifest) -> None:
    dist_dir = cwd / "dist"
    (dist_dir / "manifest.json").write_text(
        manifest.model_dump_json(indent=2, exclude_none=True, by_alias=True)
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


def prompt_for_extension_name(
    display_name_opt: str | None, id_opt: str | None
) -> ExtensionNames:
    """
    Prompt for extension name with graceful validation and re-prompting.

    Args:
        display_name_opt: Display name provided via CLI option (if any)
        id_opt: Extension ID provided via CLI option (if any)

    Returns:
        ExtensionNames: Validated extension name variants
    """

    # Case 1: Both provided via CLI - validate they work together
    if display_name_opt and id_opt:
        try:
            # Generate all names from display name for consistency
            temp_names = generate_extension_names(display_name_opt)
            # Check if the provided ID matches what we'd generate
            if temp_names["id"] == id_opt:
                return temp_names
            else:
                # If IDs don't match, use the provided ID but validate it
                validate_extension_id(id_opt)
                validate_python_package_name(to_snake_case(id_opt))
                validate_npm_package_name(id_opt)
                # Create names with the provided ID (derive technical names from ID)
                return ExtensionNames(
                    name=display_name_opt,
                    id=id_opt,
                    mf_name=kebab_to_camel_case(id_opt),
                    backend_name=kebab_to_snake_case(id_opt),
                    backend_package=f"superset_extensions.{kebab_to_snake_case(id_opt)}",
                    backend_entry=f"superset_extensions.{kebab_to_snake_case(id_opt)}.entrypoint",
                )
        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            sys.exit(1)

    # Case 2: Only display name provided - suggest ID
    if display_name_opt and not id_opt:
        display_name = display_name_opt
        try:
            suggested_names = generate_extension_names(display_name)
            suggested_id = suggested_names["id"]
        except ExtensionNameError:
            suggested_id = to_kebab_case(display_name)

        extension_id = click.prompt("Extension ID", default=suggested_id, type=str)

    # Case 3: Only ID provided - ask for display name
    elif id_opt and not display_name_opt:
        extension_id = id_opt
        # Validate the provided ID first
        try:
            validate_extension_id(id_opt)
        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            sys.exit(1)

        # Suggest display name from kebab ID
        suggested_display = " ".join(word.capitalize() for word in id_opt.split("-"))
        display_name = click.prompt(
            "Extension name", default=suggested_display, type=str
        )

    # Case 4: Neither provided - ask for both
    else:
        display_name = click.prompt("Extension name (e.g. Hello World)", type=str)
        try:
            suggested_names = generate_extension_names(display_name)
            suggested_id = suggested_names["id"]
        except ExtensionNameError:
            suggested_id = to_kebab_case(display_name)

        extension_id = click.prompt("Extension ID", default=suggested_id, type=str)

    # Final validation loop - try to use generate_extension_names for consistent results
    display_name_failed = False  # Track if display name validation failed
    while True:
        try:
            # First try to generate from display name if possible and it hasn't failed before
            if display_name and not display_name_failed:
                temp_names = generate_extension_names(display_name)
                if temp_names["id"] == extension_id:
                    # Perfect match - use generated names
                    return temp_names

            # If no match or display name failed, validate manually and construct
            validate_extension_id(extension_id)
            validate_python_package_name(to_snake_case(extension_id))
            validate_npm_package_name(extension_id)

            return ExtensionNames(
                name=display_name,
                id=extension_id,
                mf_name=kebab_to_camel_case(extension_id),
                backend_name=kebab_to_snake_case(extension_id),
                backend_package=f"superset_extensions.{kebab_to_snake_case(extension_id)}",
                backend_entry=f"superset_extensions.{kebab_to_snake_case(extension_id)}.entrypoint",
            )

        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            # If the error came from generate_extension_names, stop trying it
            if "display_name" in str(e) or not display_name_failed:
                display_name_failed = True
            extension_id = click.prompt("Extension ID", type=str)


@app.command()
@click.option(
    "--id",
    "id_opt",
    default=None,
    help="Extension ID (kebab-case, e.g. hello-world)",
)
@click.option(
    "--name", "name_opt", default=None, help="Extension display name (e.g. Hello World)"
)
@click.option(
    "--version", "version_opt", default=None, help="Initial version (default: 0.1.0)"
)
@click.option(
    "--license", "license_opt", default=None, help="License (default: Apache-2.0)"
)
@click.option(
    "--frontend/--no-frontend", "frontend_opt", default=None, help="Include frontend"
)
@click.option(
    "--backend/--no-backend", "backend_opt", default=None, help="Include backend"
)
def init(
    id_opt: str | None,
    name_opt: str | None,
    version_opt: str | None,
    license_opt: str | None,
    frontend_opt: bool | None,
    backend_opt: bool | None,
) -> None:
    # Get extension names with graceful validation
    names = prompt_for_extension_name(name_opt, id_opt)

    version = version_opt or click.prompt("Initial version", default="0.1.0")
    license_ = license_opt or click.prompt("License", default="Apache-2.0")
    include_frontend = (
        frontend_opt
        if frontend_opt is not None
        else click.confirm("Include frontend?", default=True)
    )
    include_backend = (
        backend_opt
        if backend_opt is not None
        else click.confirm("Include backend?", default=True)
    )

    target_dir = Path.cwd() / names["id"]
    if target_dir.exists():
        click.secho(f"❌ Directory {target_dir} already exists.", fg="red")
        sys.exit(1)

    # Set up Jinja environment
    templates_dir = Path(__file__).parent / "templates"
    env = Environment(loader=FileSystemLoader(templates_dir))  # noqa: S701
    ctx = {
        **names,  # Include all name variants
        "include_frontend": include_frontend,
        "include_backend": include_backend,
        "license": license_,
        "version": version,
    }

    # Create base directory
    target_dir.mkdir()
    extension_json = env.get_template("extension.json.j2").render(ctx)
    (target_dir / "extension.json").write_text(extension_json)
    click.secho("✅ Created extension.json", fg="green")

    # Create .gitignore
    gitignore = env.get_template(".gitignore.j2").render(ctx)
    (target_dir / ".gitignore").write_text(gitignore)
    click.secho("✅ Created .gitignore", fg="green")

    # Initialize frontend files
    if include_frontend:
        frontend_dir = target_dir / "frontend"
        frontend_dir.mkdir()
        frontend_src_dir = frontend_dir / "src"
        frontend_src_dir.mkdir()

        # frontend files
        package_json = env.get_template("frontend/package.json.j2").render(ctx)
        (frontend_dir / "package.json").write_text(package_json)
        webpack_config = env.get_template("frontend/webpack.config.js.j2").render(ctx)
        (frontend_dir / "webpack.config.js").write_text(webpack_config)
        tsconfig_json = env.get_template("frontend/tsconfig.json.j2").render(ctx)
        (frontend_dir / "tsconfig.json").write_text(tsconfig_json)
        index_tsx = env.get_template("frontend/src/index.tsx.j2").render(ctx)
        (frontend_src_dir / "index.tsx").write_text(index_tsx)
        click.secho("✅ Created frontend folder structure", fg="green")

    # Initialize backend files with superset_extensions namespace
    if include_backend:
        backend_dir = target_dir / "backend"
        backend_dir.mkdir()
        backend_src_dir = backend_dir / "src"
        backend_src_dir.mkdir()

        # Create superset_extensions namespace directory
        namespace_dir = backend_src_dir / "superset_extensions"
        namespace_dir.mkdir()

        # Create extension package directory
        extension_package_dir = namespace_dir / names["backend_name"]
        extension_package_dir.mkdir()

        # backend files
        pyproject_toml = env.get_template("backend/pyproject.toml.j2").render(ctx)
        (backend_dir / "pyproject.toml").write_text(pyproject_toml)

        # Namespace package __init__.py (empty for namespace)
        (namespace_dir / "__init__.py").write_text("")

        # Extension package files
        init_py = env.get_template("backend/src/package/__init__.py.j2").render(ctx)
        (extension_package_dir / "__init__.py").write_text(init_py)
        entrypoint_py = env.get_template("backend/src/package/entrypoint.py.j2").render(
            ctx
        )
        (extension_package_dir / "entrypoint.py").write_text(entrypoint_py)

        click.secho("✅ Created backend folder structure", fg="green")

    click.secho(
        f"🎉 Extension {names['name']} (ID: {names['id']}) initialized at {target_dir}",
        fg="cyan",
    )


if __name__ == "__main__":
    app()
