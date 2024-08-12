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

import argparse
import hashlib
import os
import subprocess
from datetime import datetime

XVFB_PRE_CMD = "xvfb-run --auto-servernum --server-args='-screen 0, 1024x768x24' "
REPO = os.getenv("GITHUB_REPOSITORY") or "apache/superset"
GITHUB_EVENT_NAME = os.getenv("GITHUB_REPOSITORY") or "push"
CYPRESS_RECORD_KEY = os.getenv("CYPRESS_RECORD_KEY") or ""


def compute_hash(file_path: str) -> str:
    return hashlib.md5(file_path.encode()).hexdigest()


def compute_group_index(hash_value: str, num_groups: int) -> int:
    return int(hash_value, 16) % num_groups


def generate_build_id() -> str:
    now = datetime.now()
    rounded_minute = now.minute - (now.minute % 20)
    rounded_time = now.replace(minute=rounded_minute, second=0, microsecond=0)
    return (os.getenv("GITHUB_SHA") or "DUMMY")[:8] + rounded_time.strftime(
        "%Y%m%d%H%M"
    )


def get_cypress_cmd(
    spec_list: list[str], _filter: str, group: str, use_dashboard: bool
) -> str:
    cypress_cmd = "./node_modules/.bin/cypress run"

    os.environ["TERM"] = "xterm"
    os.environ["ELECTRON_DISABLE_GPU"] = "true"
    build_id = generate_build_id()
    browser = os.getenv("CYPRESS_BROWSER", "chrome")

    if use_dashboard:
        # Run using cypress.io service
        spec: str = "cypress/e2e/*/**/*"
        cmd = (
            f"{XVFB_PRE_CMD} "
            f'{cypress_cmd} --spec "{spec}" --browser {browser} '
            f"--record --group {group} --tag {REPO},{GITHUB_EVENT_NAME} "
            f"--parallel --ci-build-id {build_id}"
        )
    else:
        # Run local, but split the execution
        os.environ.pop("CYPRESS_RECORD_KEY", None)
        spec_list_str = ",".join(sorted(spec_list))
        if _filter:
            spec_list_str = ",".join(sorted([s for s in spec_list if _filter in s]))
        cmd = (
            f"{XVFB_PRE_CMD} "
            f"{cypress_cmd} --browser {browser} "
            f'--spec "{spec_list_str}" '
        )
    return cmd


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Cypress commands based on test file hash"
    )
    parser.add_argument(
        "--use-dashboard",
        action="store_true",
        help="Use Cypress Dashboard for parallelization",
    )
    parser.add_argument(
        "--parallelism", type=int, default=10, help="Number of parallel groups"
    )
    parser.add_argument(
        "--parallelism-id", type=int, required=True, help="ID of the parallelism group"
    )
    parser.add_argument(
        "--filter", type=str, required=False, default=None, help="filter to test"
    )
    parser.add_argument("--group", type=str, default="Default", help="Group name")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the command instead of executing it",
    )
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    cypress_base_path = "superset-frontend/cypress-base/"
    cypress_base_full_path = os.path.join(script_dir, "../", cypress_base_path)
    cypress_tests_path = os.path.join(cypress_base_full_path, "cypress/e2e")

    test_files = []
    for root, _, files in os.walk(cypress_tests_path):
        for file in files:
            if file.endswith("test.ts") or file.endswith("test.js"):
                test_files.append(
                    os.path.join(root, file).replace(cypress_base_full_path, "")
                )

    # Initialize groups
    groups: dict[int, list[str]] = {i: [] for i in range(args.parallelism)}

    # Sort test files to ensure deterministic distribution
    sorted_test_files = sorted(test_files)

    # Distribute test files in a round-robin manner
    for index, test_file in enumerate(sorted_test_files):
        group_index = index % args.parallelism
        groups[group_index].append(test_file)

    group_id = args.parallelism_id
    spec_list = groups[group_id]
    cmd = get_cypress_cmd(spec_list, args.filter, args.group, args.use_dashboard)
    print(f"RUN: {cmd}")
    if not args.dry_run:
        subprocess.run(cmd, shell=True, check=True, stdout=None, stderr=None)


if __name__ == "__main__":
    main()
