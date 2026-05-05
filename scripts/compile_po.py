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

# This script is a cross-platform Python equivalent of po2json.sh.
# It generates .json files from .po translation files used by the frontend.

import glob
import os
import subprocess
import sys

# On Windows, npm global binaries are installed as .cmd scripts and cannot
# be resolved by subprocess unless shell=True is used.
_SHELL = os.name == "nt"


def run_command(command: list[str]) -> int:
    result = subprocess.run(command, text=True, shell=_SHELL, check=False)  # noqa: S603
    return result.returncode


def compile_translations() -> None:
    root_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    )
    translations_dir = os.path.join(root_dir, "superset", "translations")

    po_files = glob.glob(
        os.path.join(translations_dir, "**", "*.po"), recursive=True
    )

    failed = False
    for po_file in po_files:
        json_file = os.path.splitext(po_file)[0] + ".json"
        print(f"po2json --domain superset --format jed1.x {po_file} {json_file}")
        rc = run_command(
            ["po2json", "--domain", "superset", "--format", "jed1.x", po_file, json_file]
        )
        if rc != 0:
            print(f"ERROR: po2json failed for {po_file}", file=sys.stderr)
            failed = True
            continue
        rc = run_command(["prettier", "--write", json_file])
        if rc != 0:
            print(f"WARNING: prettier failed for {json_file}", file=sys.stderr)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    compile_translations()
