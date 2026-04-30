#!/usr/bin/env python3
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

import glob
import importlib.util
import os
import shutil
import subprocess
import sys
from concurrent.futures import as_completed, ThreadPoolExecutor

MAX_WORKERS = min(8, (os.cpu_count() or 4) * 2)


def run_command(
    command: list[str],
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: int = 300,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(  # noqa: S603
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result
    except Exception as e:

        class Result:
            returncode = 1
            stdout = ""
            stderr = str(e)

        return Result()  # type: ignore[return-value]


def find_command(*names: str) -> str | None:
    for name in names:
        if path := shutil.which(name):
            if os.name == "nt" and path.lower().endswith(".com"):
                continue
            return path
    return None


def ensure_python_module(module_name: str, package_name: str | None = None) -> bool:
    if importlib.util.find_spec(module_name) is not None:
        print(f"  Python module available: {module_name}")
        return True
    pkg = package_name or module_name
    print(f"  Missing Python module '{module_name}'. Installing '{pkg}'...")
    result = run_command([sys.executable, "-m", "pip", "install", pkg])
    if result.returncode == 0 and importlib.util.find_spec(module_name):
        print(f"  Successfully installed '{pkg}'")
        return True
    print(f"  Failed to install '{pkg}'")
    return False


def ensure_command(label: str, *names: str) -> str | None:
    if path := find_command(*names):
        print(f"  Command available: {label} -> {path}")
        return path
    print(f"  Command NOT available: {label}")
    return None


def install_npm_packages(
    npm_cmd: str,
    node_modules_bin: str,
    root_dir: str,
) -> tuple[str | None, str | None]:
    packages = ["po2json", "prettier"]
    print(f"  Pre-installing npm packages: {', '.join(packages)}...")
    result = run_command(
        [npm_cmd, "install", "--no-save", "--prefer-offline", *packages],
        cwd=root_dir,
        timeout=120,
    )
    if result.returncode != 0:
        print(f"  npm install warning (will fall back to npx): {result.stderr}")
        return None, None
    ext = ".cmd" if os.name == "nt" else ""
    po2json_bin = os.path.join(node_modules_bin, f"po2json{ext}")
    prettier_bin = os.path.join(node_modules_bin, f"prettier{ext}")
    if not os.path.exists(po2json_bin) or not os.path.exists(prettier_bin):
        print("  Local binaries not found after install, will fall back to npx.")
        return None, None
    print(f"  po2json -> {po2json_bin}")
    print(f"  prettier -> {prettier_bin}")
    return po2json_bin, prettier_bin


def convert_po_file(
    po_file: str,
    po2json_cmd: list[str],
) -> tuple[bool, str, str]:
    json_file = po_file.replace(".po", ".json")
    cmd = [
        *po2json_cmd,
        "--domain",
        "superset",
        "--format",
        "jed1.x",
        "--fuzzy",
        po_file,
        json_file,
    ]
    result = run_command(cmd, timeout=60)
    if result.returncode != 0:
        return False, po_file, result.stderr
    return True, po_file, ""


def _run_pybabel(translations_dir: str, root_dir: str) -> bool:
    print("1. Compiling translations with pybabel...")
    result = run_command(
        [
            sys.executable,
            "-m",
            "babel.messages.frontend",
            "compile",
            "-d",
            translations_dir,
        ],
        cwd=root_dir,
    )
    if result.returncode != 0:
        print(f"  pybabel failed:\n{result.stderr}")
        return False
    print("  pybabel compile done.")
    return True


def _sync_po_to_frontend(
    translations_dir: str,
    frontend_trans_dir: str,
) -> list[str]:
    print("2. Syncing PO files to frontend...")
    if os.path.exists(frontend_trans_dir):
        shutil.rmtree(frontend_trans_dir)
    os.makedirs(frontend_trans_dir, exist_ok=True)
    po_files = glob.glob(os.path.join(translations_dir, "**", "*.po"), recursive=True)
    dest_files = []
    for f in po_files:
        dest = os.path.join(frontend_trans_dir, os.path.relpath(f, translations_dir))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(f, dest)
        dest_files.append(dest)
    print(f"  Copied {len(po_files)} PO files to frontend.")
    return dest_files


def _convert_po_files_parallel(
    po_files: list[str],
    po2json_cmd: list[str],
    npx_cmd: str,  # noqa: ARG001
) -> list[str]:
    print(
        f"4. Converting {len(po_files)} PO files in parallel (workers={MAX_WORKERS})..."
    )
    failures: list[str] = []
    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_po = {
            executor.submit(convert_po_file, f, po2json_cmd): f for f in po_files
        }
        for future in as_completed(future_to_po):
            ok, po_path, err = future.result()
            completed += 1
            locale = os.path.basename(os.path.dirname(os.path.dirname(po_path)))
            fname = os.path.basename(po_path)
            if ok:
                print(f"  [{completed}/{len(po_files)}] {locale}/{fname} OK")
            else:
                print(f"  [{completed}/{len(po_files)}] {locale}/{fname} FAILED: {err}")
                failures.append(po_path)
    if failures:
        print(f"  {len(failures)} files failed to convert:")
        for f in failures:
            print(f"    {f}")
    return failures


def _run_prettier(
    po_files: list[str],
    prettier_bin: str | None,
    npx_cmd: str,
) -> None:
    json_files = [
        f.replace(".po", ".json")
        for f in po_files
        if os.path.exists(f.replace(".po", ".json"))
    ]
    if not json_files:
        return
    print(f"5. Running prettier on {len(json_files)} JSON files (single batch)...")
    if prettier_bin:
        prettier_cmd = [prettier_bin, "--write", *json_files]
    else:
        prettier_cmd = [npx_cmd, "prettier", "--write", *json_files]
    result = run_command(prettier_cmd, timeout=300)
    if result.returncode != 0:
        print(f"  prettier warnings:\n{result.stderr}")
    else:
        print("  prettier done.")


def compile_translations() -> None:
    print("0. Checking requirements...")
    if not ensure_python_module("babel", "Babel"):
        sys.exit(1)
    node_cmd = ensure_command("Node", "node.exe", "node")
    npm_cmd = ensure_command("NPM", "npm.cmd", "npm.exe", "npm")
    npx_cmd = ensure_command("NPX", "npx.cmd", "npx.exe", "npx")
    if not all([node_cmd, npm_cmd, npx_cmd]):
        print("Missing system dependencies. Aborting.")
        sys.exit(1)

    root_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    )
    translations_dir = os.path.join(root_dir, "superset", "translations")
    frontend_trans_dir = os.path.join(
        root_dir, "superset-frontend", "src", "translations"
    )
    node_modules_bin = os.path.join(root_dir, "node_modules", ".bin")

    if not os.path.exists(translations_dir):
        print(f"  Translations dir missing: {translations_dir}")
        sys.exit(1)

    if not _run_pybabel(translations_dir, root_dir):
        sys.exit(1)

    po_files = _sync_po_to_frontend(translations_dir, frontend_trans_dir)

    print(f"3. Installing npm tools once, shared across {MAX_WORKERS} workers...")
    po2json_bin, prettier_bin = install_npm_packages(
        npm_cmd,  # type: ignore[arg-type]
        node_modules_bin,
        root_dir,
    )
    po2json_cmd: list[str] = (
        [po2json_bin] if po2json_bin else [npx_cmd, "po2json"]  # type: ignore[list-item]
    )
    if po2json_bin is None:
        print("  Falling back to npx for po2json.")

    failures = _convert_po_files_parallel(
        po_files,
        po2json_cmd,
        npx_cmd,  # type: ignore[arg-type]
    )
    _run_prettier(
        po_files,
        prettier_bin,
        npx_cmd,  # type: ignore[arg-type]
    )

    if failures:
        print(f"\u274c Pipeline completed with {len(failures)} conversion failure(s).")
        sys.exit(1)

    print("\u2705 Pipeline completed successfully!")


if __name__ == "__main__":
    compile_translations()
