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
import subprocess
import sys
from shutil import copyfile

import click

BASE_REQS = "requirements/base.txt"
DEV_REQS = "requirements/development.txt"

DEV_EXTRAS = [
    "bigquery",
    "cors",
    "development",
    "druid",
    "hive",
    "gevent",
    "mysql",
    "postgres",
    "presto",
    "prophet",
    "trino",
    "gsheets",
    "playwright",
    "thumbnails",
]


def read_requirements(path: str) -> dict[str, str]:
    """Read requirements from a file and return them as a dictionary."""
    requirements = {}
    with open(path) as file:
        for line in file:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("==")
                lib_name = parts[0].strip()
                version = parts[1].strip() if len(parts) == 2 else ""
                requirements[lib_name] = version
    return requirements


def compare_requirements(
    reqs1: dict[str, str], reqs2: dict[str, str]
) -> tuple[dict[str, str], dict[str, str], dict[str, tuple[str, str]]]:
    """Compare two sets of requirements and identify differences."""
    added = {lib: ver for lib, ver in reqs2.items() if lib not in reqs1}
    removed = {lib: ver for lib, ver in reqs1.items() if lib not in reqs2}
    version_changed = {
        lib: (reqs1[lib], reqs2[lib])
        for lib in reqs1
        if lib in reqs2 and reqs1[lib] != reqs2[lib]
    }
    return added, removed, version_changed


def bash(cmd: str) -> None:
    print(f"RUN: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"Error: Command '{cmd}' exited with {result.returncode}")
        sys.exit(result.returncode)


@click.group()
def cli() -> None:
    pass


@click.command()
@click.option("--pip-flags", default="", help="Flags to pass directly to pip-compile.")
def compile_deps(pip_flags: str) -> None:
    """Compile dependencies using pip-compile with optional flags."""
    # pip-compile commands
    bash(f"pip-compile -o {BASE_REQS} {pip_flags}")
    bash(f'pip-compile -o {DEV_REQS} -v {pip_flags} --extra {",".join(DEV_EXTRAS)}')

    click.echo("Dependencies compiled.")


@click.command()
@click.option(
    "--dev", is_flag=True, help="Install development dependencies instead of base."
)
def install_deps(dev: bool) -> None:
    """Install dependencies from the compiled requirements file."""
    file_path = "requirements/development.txt" if dev else "requirements/base.txt"
    bash(f"pip install -r {file_path}")
    # Installing the project itself in editable mode
    bash("pip install -e .")
    click.echo(f"Dependencies from {file_path} and project installed.")


@click.command()
@click.argument("file1", type=click.Path(exists=True), default=BASE_REQS)
@click.argument("file2", type=click.Path(exists=True), default=DEV_REQS)
def compare_versions(file1: str, file2: str) -> None:
    """Load two requirements files, compare them, and print differences."""
    reqs1 = read_requirements(file1)
    reqs2 = read_requirements(file2)
    added, removed, version_changed = compare_requirements(reqs1, reqs2)

    if added:
        click.echo("Added:")
        for lib, ver in added.items():
            click.echo(f"{lib}=={ver}")
    if removed:
        click.echo("\nRemoved:")
        for lib, ver in removed.items():
            click.echo(f"{lib}=={ver}")
    if version_changed:
        click.echo("\nVersion Changed:")
        for lib, versions in version_changed.items():
            click.echo(f"{lib}: from {versions[0]} to {versions[1]}")


@click.command()
@click.argument("input_file")
@click.argument("output_file")
def merge_compile(input_file: str, output_file: str) -> None:
    """Merge, compile and check versions."""
    # Step 1: Copy development.txt to the output file
    copyfile(DEV_REQS, output_file)

    # Step 2 & 3: Compile the user-defined requirements file appending to the output
    bash(f"pip-compile -v {input_file} --output-file={output_file}")


cli.add_command(merge_compile)
cli.add_command(compile_deps)
cli.add_command(install_deps)
cli.add_command(compare_versions)

if __name__ == "__main__":
    cli()
