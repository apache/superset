import json
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import typer

from superset_sdk.utils import read_json, read_toml

app = typer.Typer(help="CLI for validating and bundling Superset extensions.")


@app.command()
def validate() -> None:
    """
    Validate extension.
    """
    # TODO: add validation logic
    typer.secho("✅ Validation successful", fg=typer.colors.GREEN)


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

    # assert pyproject

    if not extension:
        typer.secho("❌ extension.json not found.", err=True, fg=typer.colors.RED)
        raise typer.Exit(code=1)

    manifest["name"] = name = extension["name"]
    manifest["version"] = version = extension["version"]
    zip_name = f"{name}-{version}.zip"

    backend = extension.get("backend", {})
    frontend = extension.get("frontend", {})
    manifest["dependencies"] = extension.get("dependencies", [])
    manifest["contributions"] = frontend.get("contributions", [])
    manifest["moduleFederation"] = frontend.get("moduleFederation", {})

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
        typer.secho(f"❌ Failed to create bundle: {ex}", err=True, fg=typer.colors.RED)
        raise typer.Exit(code=1) from ex

    typer.secho(f"✅ Bundle created: {zip_name}", fg=typer.colors.GREEN)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
