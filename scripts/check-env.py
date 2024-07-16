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
"""
check-env.py

This script checks the local environment for the following software versions and provides feedback on whether they are ideal, supported, or unsupported. The software checked includes:

- Core Python version
- npm
- Node.js
- Docker
- Docker Compose
- Git

Each check will display a green check mark (✅) for ideal versions, a yellow warning (🟡) for supported versions, and a red cross (❌) for unsupported versions.
"""

import subprocess
import sys
from typing import List, Optional, Tuple

from packaging.version import InvalidVersion, Version


def get_version(command: str) -> Optional[str]:
    try:
        version = subprocess.check_output(command, shell=True).decode().strip()
        return version
    except subprocess.CalledProcessError:
        return None


def check_version(
    software: str,
    version: Optional[str],
    ideal_range: Tuple[Version, Version],
    supported_range: Tuple[Version, Version],
) -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    if version is None:
        return f"❌ {software}", ideal_range, supported_range

    try:
        version_number = Version(version)
    except InvalidVersion:
        return f"❌ {software} {version}", ideal_range, supported_range

    ideal_min, ideal_max = ideal_range
    supported_min, supported_max = supported_range

    if ideal_min <= version_number <= ideal_max:
        return f"✅ {software} {version}", ideal_range, supported_range
    elif supported_min <= version_number:
        return f"🟡 {software} {version}", ideal_range, supported_range
    else:
        return f"❌ {software} {version}", ideal_range, supported_range


def check_core_python() -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    version = sys.version.split()[0]
    ideal_range = (Version("3.10.0"), Version("3.10.999"))
    supported_range = (Version("3.9.0"), Version("3.11.999"))
    return check_version("Python", version, ideal_range, supported_range)


def check_npm() -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    version = get_version("npm -v")
    ideal_range = (Version("10.0.0"), Version("10.999.999"))
    supported_range = ideal_range  # Only ideal range is considered supported
    return check_version("npm", version, ideal_range, supported_range)


def check_node() -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    version = get_version("node -v")
    if version:
        version = version.lstrip("v")
    ideal_range = (Version("18.0.0"), Version("18.999.999"))
    supported_range = ideal_range  # Only ideal range is considered supported
    return check_version("Node", version, ideal_range, supported_range)


def check_docker() -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    version = get_version("docker --version")
    if version:
        version = version.split()[2].rstrip(",")
    ideal_range = (Version("20.10.0"), Version("999.999.999"))
    supported_range = (Version("19.0.0"), Version("999.999.999"))
    return check_version("Docker", version, ideal_range, supported_range)


def check_docker_compose() -> (
    Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]
):
    version = get_version("docker-compose --version")
    if version:
        version = version.split()[-1]
    ideal_range = (Version("2.28.0"), Version("999.999.999"))
    supported_range = (Version("1.29.0"), Version("999.999.999"))
    return check_version("Docker Compose", version, ideal_range, supported_range)


def check_git() -> Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]:
    version = get_version("git --version")
    if version:
        version = version.split()[2]
    ideal_range = (Version("2.30.0"), Version("999.999.999"))
    supported_range = (Version("2.20.0"), Version("999.999.999"))
    return check_version("Git", version, ideal_range, supported_range)


def main() -> None:
    checks: List[Tuple[str, Tuple[Version, Version], Tuple[Version, Version]]] = [
        check_core_python(),
        check_npm(),
        check_node(),
        check_docker(),
        check_docker_compose(),
        check_git(),
    ]

    headers = ["Status", "Software", "Ideal Range", "Supported Range"]
    row_format = "{:<2} {:<25} {:<25} {:<25}"

    print(row_format.format(*headers))
    print("=" * 90)

    for check, ideal_range, supported_range in checks:
        status, software_info = check.split(" ", 1)
        ideal_range_str = f"{ideal_range[0]} - {ideal_range[1]}"
        supported_range_str = f"{supported_range[0]} - {supported_range[1]}"
        print(
            row_format.format(
                status, software_info, ideal_range_str, supported_range_str
            )
        )


if __name__ == "__main__":
    main()
