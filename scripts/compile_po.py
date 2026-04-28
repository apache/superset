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
import os
import sys
import glob
import shutil
import importlib.util
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

MAX_WORKERS = min(8, (os.cpu_count() or 4) * 2)


def run_command(command, cwd=None, env=None, timeout=300):
    try:
        result = subprocess.run(
            command, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout
        )
        return result
    except Exception as e:
        class Result:
            returncode = 1
            stdout = ""
            stderr = str(e)
        return Result()


def find_command(*names):
    for name in names:
        path = shutil.which(name)
        if path:
            if os.name == "nt" and path.lower().endswith(".com"):
                continue
            return path
    return None


def ensure_python_module(module_name, package_name=None):
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


def ensure_command(label, *names):
    path = find_command(*names)
    if path:
        print(f"  Command available: {label} -> {path}")
        return path
    print(f"  Command NOT available: {label}")
    return None


def install_npm_packages(npm_cmd, node_modules_bin):
    """Install po2json and prettier locally once, avoiding repeated npx -y downloads."""
    packages = ["po2json", "prettier"]
    print(f"  Pre-installing npm packages: {', '.join(packages)}...")
    result = run_command(
        [npm_cmd, "install", "--no-save", "--prefer-offline", *packages],
        timeout=120,
    )
    if result.returncode != 0:
        print(f"  npm install warning (will fall back to npx): {result.stderr}")
        return None, None
    ext = ".cmd" if os.name == "nt" else ""
    po2json_bin = os.path.join(node_modules_bin, f"po2json{ext}")
    prettier_bin = os.path.join(node_modules_bin, f"prettier{ext}")
    if not os.path.exists(po2json_bin) and os.path.exists(prettier_bin):
        print("  Local binaries not found after install, will fall back to npx.")
        return None, None
    print(f"  po2json  -> {po2json_bin}")
    print(f"  prettier -> {prettier_bin}")
    return po2json_bin, prettier_bin


def convert_po_file(po_file, po2json_bin, npx_cmd):
    """Convert a single .po file to .json – called in parallel."""
    json_file = po_file.replace(".po", ".json")
    cmd = [po2json_bin, "--domain", "superset", "--format", "jed1.x", "--fuzzy", po_file, json_file]
    result = run_command(cmd, timeout=60)
    if result.returncode != 0:
        return False, po_file, result.stderr
    return True, po_file, ""


def compile_translations():
    print("0. Checking requirements...")
    if not ensure_python_module("babel", "Babel"):
        return

    node_cmd = ensure_command("Node", "node.exe", "node")
    npm_cmd = ensure_command("NPM", "npm.cmd", "npm.exe", "npm")
    npx_cmd = ensure_command("NPX", "npx.cmd", "npx.exe", "npx")

    if not all([node_cmd, npm_cmd, npx_cmd]):
        print("Missing system dependencies. Aborting.")
        return

    root_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    translations_dir = os.path.join(root_dir, "superset", "translations")
    frontend_trans_dir = os.path.join(root_dir, "superset-frontend", "src", "translations")
    node_modules_bin = os.path.join(root_dir, "node_modules", ".bin")

    if not os.path.exists(translations_dir):
        print(f"  Translations dir missing: {translations_dir}")
        return

    # --- Step 1: pybabel compile ---
    print("1. Compiling translations with pybabel...")
    result = run_command(
        [sys.executable, "-m", "babel.messages.frontend", "compile", "-d", translations_dir],
        cwd=root_dir,
    )
    if result.returncode != 0:
        print(f"  pybabel failed:\n{result.stderr}")
        return
    print("  pybabel compile done.")

    # --- Step 2: Sync PO files to frontend ---
    print("2. Syncing PO files to frontend...")
    if os.path.exists(frontend_trans_dir):
        shutil.rmtree(frontend_trans_dir)
    os.makedirs(frontend_trans_dir, exist_ok=True)
    po_files = glob.glob(os.path.join(translations_dir, "**", "*.po"), recursive=True)
    for f in po_files:
        dest = os.path.join(frontend_trans_dir, os.path.relpath(f, translations_dir))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(f, dest)
    print(f"  Copied {len(po_files)} PO files to frontend.")

    # --- Step 3: Install npm tools ---
    print(f"3. Installing npm tools once, shared across {MAX_WORKERS} workers...")
    po2json_bin, prettier_bin = install_npm_packages(npm_cmd, node_modules_bin)

    if po2json_bin is None:
        print("  Falling back to npx for po2json.")
        po2json_bin = f"{npx_cmd} po2json"  # handled as list below

    # --- Step 4: Parallel PO -> JSON conversion ---
    print(f"4. Converting {len(po_files)} PO files in parallel (workers={MAX_WORKERS})...")
    failures = []
    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_po = {
            executor.submit(convert_po_file, f, po2json_bin, npx_cmd): f for f in po_files
        }
        for future in as_completed(future_to_po):
            ok, po_path, err = future.result()
            completed += 1
            locale = os.path.basename(os.path.dirname(os.path.dirname(po_path)))
            if ok:
                print(f"  [{completed}/{len(po_files)}] {locale}/{os.path.basename(po_path)} OK")
            else:
                print(f"  [{completed}/{len(po_files)}] {locale}/{os.path.basename(po_path)} FAILED: {err}")
                failures.append(po_path)

    if failures:
        print(f"  {len(failures)} files failed to convert:")
        for f in failures:
            print(f"    {f}")

    # --- Step 5: Prettier batch formatting ---
    json_files = [f.replace(".po", ".json") for f in po_files if os.path.exists(f.replace(".po", ".json"))]
    if json_files:
        print(f"5. Running prettier on {len(json_files)} JSON files (single batch)...")
        prettier_cmd = [prettier_bin, "--write", *json_files] if prettier_bin else [npx_cmd, "prettier", "--write", *json_files]
        result = run_command(prettier_cmd, timeout=300)
        if result.returncode != 0:
            print(f"  prettier warnings:\n{result.stderr}")
        else:
            print("  prettier done.")

    print("Pipeline completed successfully!")


if __name__ == "__main__":
    compile_translations()
