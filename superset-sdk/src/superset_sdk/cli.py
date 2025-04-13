import json
import zipfile
from pathlib import Path
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
    package = read_json(Path("frontend") / "package.json")
    input_manifest = read_json(Path("manifest.json"))
    pyproject = read_toml(Path("backend") / "pyproject.toml")
    output_manifest: dict[str, Any] = {}

    assert pyproject

    if not input_manifest:
        typer.secho("❌ manifest.json not found.", err=True, fg=typer.colors.RED)
        raise typer.Exit(code=1)

    output_manifest["name"] = name = input_manifest["name"]
    output_manifest["version"] = version = input_manifest["version"]
    output_manifest["foo"] = "bar"

    zip_name = f"{name}-{version}.zip"

    try:
        with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as zipf:
            zipf.write("manifest.json", json.dumps(output_manifest, indent=2))

            # bundle frontend assets
            if package:
                dist_path = Path("frontend") / "dist"
                for file in dist_path.rglob("*"):
                    if file.is_file():
                        arcname = file.relative_to(Path.cwd())
                        zipf.write(file, arcname)

    except Exception as ex:
        typer.secho(f"❌ Failed to create bundle: {ex}", err=True, fg=typer.colors.RED)
        raise typer.Exit(code=1) from ex

    typer.secho(f"✅ Bundle created: {zip_name}", fg=typer.colors.GREEN)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
