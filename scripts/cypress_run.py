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
import os
import subprocess
from datetime import datetime

XVFB_PRE_CMD = "xvfb-run --auto-servernum --server-args='-screen 0, 1024x768x24' "
REPO = os.getenv("GITHUB_REPOSITORY") or "apache/superset"
GITHUB_EVENT_NAME = os.getenv("GITHUB_EVENT_NAME") or "push"
CYPRESS_RECORD_KEY = os.getenv("CYPRESS_RECORD_KEY") or ""


def generate_build_id() -> str:
    """Generates a build ID based on the current timestamp."""
    now = datetime.now()
    rounded_minute = now.minute - (now.minute % 20)
    rounded_time = now.replace(minute=rounded_minute, second=0, microsecond=0)
    return (os.getenv("GITHUB_SHA") or "DUMMY")[:8] + rounded_time.strftime(
        "%Y%m%d%H%M"
    )


def run_cypress_for_test_file(
    test_file: str, retries: int, use_dashboard: bool, group: str, dry_run: bool, i: int
) -> int:
    """Runs Cypress for a single test file and retries upon failure."""
    cypress_cmd = "./node_modules/.bin/cypress run"
    os.environ["TERM"] = "xterm"
    os.environ["ELECTRON_DISABLE_GPU"] = "true"
    build_id = generate_build_id()
    browser = os.getenv("CYPRESS_BROWSER", "chrome")
    chrome_flags = "--disable-dev-shm-usage"

    for attempt in range(retries):
        # Create Cypress command for a single test file
        cmd: str = ""
        if use_dashboard:
            # If/when we want to use cypress' dashboard feature to record the run
            group_id = f"matrix{group}-file{i}-{attempt}"
            cmd = (
                f"{XVFB_PRE_CMD} "
                f'{cypress_cmd} --spec "{test_file}" --browser {browser} '
                f"--record --group {group_id} --tag {REPO},{GITHUB_EVENT_NAME} "
                f"--ci-build-id {build_id} "
                f"-- {chrome_flags}"
            )
        else:
            os.environ.pop("CYPRESS_RECORD_KEY", None)
            cmd = (
                f"{XVFB_PRE_CMD} "
                f"{cypress_cmd} --browser {browser} "
                f'--spec "{test_file}" '
                f"-- {chrome_flags}"
            )
            print(f"RUN: {cmd} (Attempt {attempt + 1}/{retries})")
        if dry_run:
            # Print the command instead of executing it
            print(f"DRY RUN: {cmd}")
            return 0

        process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
        )

        # Stream stdout in real-time
        if process.stdout:
            for stdout_line in iter(process.stdout.readline, ""):
                print(stdout_line, end="")

        process.wait()

        if process.returncode == 0:
            print(f"Test {test_file} succeeded on attempt {attempt + 1}")
            return 0
        else:
            print(f"Test {test_file} failed on attempt {attempt + 1}")

    print(f"Test {test_file} failed after {retries} retries.")
    return process.returncode


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Cypress tests with retries per test file"
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
        "--filter", type=str, required=False, default=None, help="Filter to test"
    )
    parser.add_argument("--group", type=str, default="Default", help="Group name")
    parser.add_argument(
        "--retries", type=int, default=3, help="Number of retries per test file"
    )
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
    file_count = 0
    for root, _, files in os.walk(cypress_tests_path):
        for file in files:
            if file.endswith("test.ts") or file.endswith("test.js"):
                file_count += 1
                test_files.append(
                    os.path.join(root, file).replace(cypress_base_full_path, "")
                )
    print(f"Found {file_count} test files.")

    # Initialize groups for round-robin distribution
    groups: dict[int, list[str]] = {i: [] for i in range(args.parallelism)}

    # Sort test files to ensure deterministic distribution
    sorted_test_files = sorted(test_files)

    # Distribute test files in a round-robin manner
    for index, test_file in enumerate(sorted_test_files):
        group_index = index % args.parallelism
        groups[group_index].append(test_file)

    # Only run tests for the group that matches the parallelism ID
    group_id = args.parallelism_id
    spec_list = groups[group_id]

    # Run each test file independently with retry logic or dry-run
    processed_file_count: int = 0
    for i, test_file in enumerate(spec_list):
        result = run_cypress_for_test_file(
            test_file, args.retries, args.use_dashboard, args.group, args.dry_run, i
        )
        if result != 0:
            print(f"Exiting due to failure in {test_file}")
            exit(result)
        processed_file_count += 1
    print(f"Ran {processed_file_count} test files successfully.")


if __name__ == "__main__":
    main()
