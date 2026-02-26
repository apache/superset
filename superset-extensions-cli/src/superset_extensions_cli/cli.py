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

import importlib.util
import inspect
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
from superset_core.extensions import (
    BackendContributions,
    ExtensionConfig,
    FrontendContributions,
    Manifest,
    ManifestBackend,
    ManifestFrontend,
    McpPromptContribution,
    McpToolContribution,
    RegistrationMode,
    RestApiContribution,
    get_context,
)
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from superset_extensions_cli.constants import MIN_NPM_VERSION
from superset_extensions_cli.exceptions import ExtensionNameError
from superset_extensions_cli.types import ExtensionNames
from superset_extensions_cli.utils import (
    generate_extension_names,
    kebab_to_snake_case,
    read_json,
    read_toml,
    suggest_technical_name,
    validate_display_name,
    validate_publisher,
    validate_technical_name,
)

REMOTE_ENTRY_REGEX = re.compile(r"^remoteEntry\..+\.js$")
FRONTEND_DIST_REGEX = re.compile(r"/frontend/dist")


def discover_backend_contributions(
    cwd: Path, files_patterns: list[str]
) -> BackendContributions:
    """
    Discover backend contributions by importing modules and inspecting decorated objects.

    Sets context to BUILD mode so decorators only store metadata, no registration.
    """
    contributions = BackendContributions()

    # Set build mode so decorators don't try to register
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:
        # Collect all Python files matching patterns
        py_files: list[Path] = []
        for pattern in files_patterns:
            py_files.extend(cwd.glob(pattern))

        # Filter to only process Python files
        python_files = [f for f in py_files if f.is_file() and f.suffix == ".py"]

        for py_file in python_files:
            try:
                # Import module dynamically
                module = _import_module_from_path(py_file)
                if module is None:
                    continue

                # Inspect all members for decorated objects
                for name, obj in inspect.getmembers(module):
                    if name.startswith("_"):
                        continue

                    # Check for @tool metadata
                    if hasattr(obj, "__tool_metadata__"):
                        meta = obj.__tool_metadata__
                        contributions.mcp_tools.append(
                            McpToolContribution(
                                id=meta.id,
                                name=meta.name,
                                description=meta.description,
                                module=meta.module,
                                tags=list(meta.tags),
                                protect=meta.protect,
                            )
                        )

                    # Check for @prompt metadata
                    if hasattr(obj, "__prompt_metadata__"):
                        meta = obj.__prompt_metadata__
                        contributions.mcp_prompts.append(
                            McpPromptContribution(
                                id=meta.id,
                                name=meta.name,
                                title=meta.title,
                                description=meta.description,
                                module=meta.module,
                                tags=list(meta.tags),
                                protect=meta.protect,
                            )
                        )

                    # Check for @extension_api metadata
                    if hasattr(obj, "__rest_api_metadata__"):
                        meta = obj.__rest_api_metadata__
                        contributions.rest_apis.append(
                            RestApiContribution(
                                id=meta.id,
                                name=meta.name,
                                description=meta.description,
                                module=meta.module,
                                basePath=meta.base_path,
                                resourceName=meta.resource_name,
                                openapiSpecTag=meta.openapi_spec_tag,
                                classPermissionName=meta.class_permission_name,
                            )
                        )

            except Exception as e:
                click.secho(f"⚠️  Failed to analyze {py_file}: {e}", fg="yellow")

    finally:
        # Reset to host mode
        ctx.set_mode(RegistrationMode.HOST)

    return contributions


def discover_frontend_contributions(cwd: Path) -> FrontendContributions:
    """
    Discover frontend contributions from webpack plugin output.

    The webpack plugin outputs a contributions.json file during build.
    """
    contributions_file = cwd / "frontend" / "dist" / "contributions.json"

    if not contributions_file.exists():
        # No frontend contributions found - this is normal for extensions without frontend
        return FrontendContributions()

    try:
        contributions_data = json.loads(contributions_file.read_text())
        return FrontendContributions.model_validate(contributions_data)
    except Exception as e:
        click.secho(f"⚠️  Failed to parse frontend contributions: {e}", fg="yellow")
        return FrontendContributions()


def _import_module_from_path(py_file: Path) -> Any:
    """Import a Python module from a file path."""
    module_name = py_file.stem
    spec = importlib.util.spec_from_file_location(module_name, py_file)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module

    try:
        spec.loader.exec_module(module)
        return module
    except Exception:
        # Clean up on failure
        sys.modules.pop(module_name, None)
        raise


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

    # Build frontend manifest with auto-discovery
    frontend: ManifestFrontend | None = None
    if extension.frontend and remote_entry:
        click.secho("🔍 Auto-discovering frontend contributions...", fg="cyan")
        frontend_contributions = discover_frontend_contributions(cwd)

        # Count contributions for feedback
        command_count = len(frontend_contributions.commands)
        view_count = sum(len(views) for views in frontend_contributions.views.values())
        menu_count = len(frontend_contributions.menus)
        editor_count = len(frontend_contributions.editors)

        total_count = command_count + view_count + menu_count + editor_count
        if total_count > 0:
            click.secho(
                f"   Found: {command_count} commands, {view_count} views, {menu_count} menus, {editor_count} editors",
                fg="green",
            )
        else:
            click.secho("   No frontend contributions found", fg="yellow")

        frontend = ManifestFrontend(
            contributions=frontend_contributions,
            moduleFederation=extension.frontend.moduleFederation,
            remoteEntry=remote_entry,
        )

    # Build backend manifest with auto-discovered contributions
    backend: ManifestBackend | None = None
    if extension.backend:
        click.secho("🔍 Auto-discovering backend contributions...", fg="cyan")
        backend_contributions = discover_backend_contributions(
            cwd, extension.backend.files
        )

        tool_count = len(backend_contributions.mcp_tools)
        prompt_count = len(backend_contributions.mcp_prompts)
        api_count = len(backend_contributions.rest_apis)
        click.secho(
            f"   Found: {tool_count} tools, {prompt_count} prompts, {api_count} APIs",
            fg="green",
        )

        backend = ManifestBackend(
            entryPoints=extension.backend.entryPoints,
            contributions=backend_contributions,
        )

    return Manifest(
        id=composite_id,
        publisher=extension.publisher,
        name=extension.name,
        displayName=extension.displayName,
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


def prompt_for_extension_info(
    display_name_opt: str | None,
    publisher_opt: str | None,
    technical_name_opt: str | None,
) -> ExtensionNames:
    """
    Prompt for extension info with graceful validation and re-prompting.

    Args:
        display_name_opt: Display name provided via CLI option (if any)
        publisher_opt: Publisher provided via CLI option (if any)
        technical_name_opt: Technical name provided via CLI option (if any)

    Returns:
        ExtensionNames: Validated extension name variants
    """

    # Step 1: Get display name
    if display_name_opt:
        display_name = display_name_opt
        try:
            display_name = validate_display_name(display_name)
        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            sys.exit(1)
    else:
        while True:
            display_name = click.prompt("Extension display name", type=str)
            try:
                display_name = validate_display_name(display_name)
                break
            except ExtensionNameError as e:
                click.secho(f"❌ {e}", fg="red")

    # Step 2: Get technical name (with suggestion from display name)
    if technical_name_opt:
        technical_name = technical_name_opt
        try:
            validate_technical_name(technical_name)
        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            sys.exit(1)
    else:
        # Suggest technical name from display name
        try:
            suggested_technical = suggest_technical_name(display_name)
        except ExtensionNameError:
            suggested_technical = "extension"

        while True:
            technical_name = click.prompt(
                f"Extension name ({suggested_technical})",
                default=suggested_technical,
                type=str,
            )
            try:
                validate_technical_name(technical_name)
                break
            except ExtensionNameError as e:
                click.secho(f"❌ {e}", fg="red")

    # Step 3: Get publisher
    if publisher_opt:
        publisher = publisher_opt
        try:
            validate_publisher(publisher)
        except ExtensionNameError as e:
            click.secho(f"❌ {e}", fg="red")
            sys.exit(1)
    else:
        while True:
            publisher = click.prompt("Publisher (e.g., my-org)", type=str)
            try:
                validate_publisher(publisher)
                break
            except ExtensionNameError as e:
                click.secho(f"❌ {e}", fg="red")

    # Generate all name variants
    try:
        return generate_extension_names(display_name, publisher, technical_name)
    except ExtensionNameError as e:
        click.secho(f"❌ {e}", fg="red")
        sys.exit(1)


@app.command()
@click.option(
    "--publisher",
    "publisher_opt",
    default=None,
    help="Publisher namespace (kebab-case, e.g. my-org)",
)
@click.option(
    "--name",
    "name_opt",
    default=None,
    help="Technical extension name (kebab-case, e.g. dashboard-widgets)",
)
@click.option(
    "--display-name",
    "display_name_opt",
    default=None,
    help="Extension display name (e.g. Dashboard Widgets)",
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
    publisher_opt: str | None,
    name_opt: str | None,
    display_name_opt: str | None,
    version_opt: str | None,
    license_opt: str | None,
    frontend_opt: bool | None,
    backend_opt: bool | None,
) -> None:
    # Get extension names with graceful validation
    names = prompt_for_extension_info(display_name_opt, publisher_opt, name_opt)

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

    # Initialize backend files with superset_extensions.publisher.name structure
    if include_backend:
        backend_dir = target_dir / "backend"
        backend_dir.mkdir()
        backend_src_dir = backend_dir / "src"
        backend_src_dir.mkdir()

        # Create superset_extensions namespace directory
        namespace_dir = backend_src_dir / "superset_extensions"
        namespace_dir.mkdir()

        # Create publisher directory (e.g., superset_extensions/my_org)
        publisher_snake = kebab_to_snake_case(names["publisher"])
        publisher_dir = namespace_dir / publisher_snake
        publisher_dir.mkdir()

        # Create extension package directory (e.g., superset_extensions/my_org/dashboard_widgets)
        name_snake = kebab_to_snake_case(names["name"])
        extension_package_dir = publisher_dir / name_snake
        extension_package_dir.mkdir()

        # backend files
        pyproject_toml = env.get_template("backend/pyproject.toml.j2").render(ctx)
        (backend_dir / "pyproject.toml").write_text(pyproject_toml)

        # Namespace package __init__.py (empty for namespace)
        (namespace_dir / "__init__.py").write_text("")
        (publisher_dir / "__init__.py").write_text("")

        # Extension package files
        init_py = env.get_template("backend/src/package/__init__.py.j2").render(ctx)
        (extension_package_dir / "__init__.py").write_text(init_py)
        entrypoint_py = env.get_template("backend/src/package/entrypoint.py.j2").render(
            ctx
        )
        (extension_package_dir / "entrypoint.py").write_text(entrypoint_py)

        click.secho("✅ Created backend folder structure", fg="green")

    click.secho(
        f"🎉 Extension {names['display_name']} (ID: {names['id']}) initialized at {target_dir}",
        fg="cyan",
    )


if __name__ == "__main__":
    app()
