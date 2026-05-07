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

import platform
import subprocess
import sys
from typing import Callable, Optional, Set, Tuple

import click
import psutil
from packaging.version import InvalidVersion, Version


class Requirement:
    def __init__(
        self,
        name: str,
        ideal_range: Tuple[Version, Version],
        supported_range: Tuple[Version, Version],
        req_type: str,
        command: str,
        version_post_process: Optional[Callable[[str], str]] = None,
    ):
        self.name = name
        self.ideal_range = ideal_range
        self.supported_range = supported_range
        self.req_type = req_type
        self.command = command
        self.version_post_process = version_post_process
        self.version = self.get_version()
        self.status = self.check_version()

    def get_version(self) -> Optional[str]:
        try:
            version = subprocess.check_output(self.command, shell=True).decode().strip()  # noqa: S602
            if self.version_post_process:
                version = self.version_post_process(version)
            return version.split()[-1]
        except subprocess.CalledProcessError:
            return None

    def check_version(self) -> str:
        if self.version is None:
            return "❌ Not Installed"

        try:
            version_number = Version(self.version)
        except InvalidVersion:
            return "❌ Invalid Version Format"

        ideal_min, ideal_max = self.ideal_range
        supported_min, supported_max = self.supported_range

        if ideal_min <= version_number <= ideal_max:
            return "✅ Ideal"
        elif supported_min <= version_number:
            return "🟡 Supported"
        else:
            return "❌ Unsupported"

    def format_result(self) -> str:
        ideal_range_str = f"{self.ideal_range[0]} - {self.ideal_range[1]}"
        supported_range_str = f"{self.supported_range[0]} - {self.supported_range[1]}"
        return f"{self.status.split()[0]} {self.name:<25} {self.version or 'N/A':<25} {ideal_range_str:<25} {supported_range_str:<25}"  # noqa: E501


def check_memory(min_gb: int) -> str:
    total_memory = psutil.virtual_memory().total / (1024**3)
    if total_memory >= min_gb:
        return f"✅ Memory: {total_memory:.2f} GB"
    else:
        return f"❌ Memory: {total_memory:.2f} GB (Minimum required: {min_gb} GB)"


def get_cpu_info() -> str:
    cpu_count = psutil.cpu_count(logical=True)
    cpu_freq = psutil.cpu_freq()
    cpu_info = (
        f"{cpu_count} cores at {cpu_freq.current:.2f} MHz"
        if cpu_freq
        else f"{cpu_count} cores"
    )
    return f"CPU: {cpu_info}"


def get_docker_platform() -> str:
    try:
        output = (
            subprocess.check_output(  # noqa: S602
                "docker info --format '{{.OperatingSystem}}'",  # noqa: S607
                shell=True,  # noqa: S607
            )
            .decode()
            .strip()
        )
        if "Docker Desktop" in output:
            return f"Docker Platform: {output} ({platform.system()})"
        return f"Docker Platform: {output}"
    except subprocess.CalledProcessError:
        return "Docker Platform: ❌ Not Detected"


@click.command(
    help="""
This script checks the local environment for various software versions and other requirements, providing feedback on whether they are ideal, supported, or unsupported.
"""  # noqa: E501
)
@click.option(
    "--docker", is_flag=True, help="Check Docker and Docker Compose requirements"
)
@click.option(
    "--frontend",
    is_flag=True,
    help="Check frontend requirements (npm, Node.js, memory)",
)
@click.option("--backend", is_flag=True, help="Check backend requirements (Python)")
def main(docker: bool, frontend: bool, backend: bool) -> None:  # noqa: C901
    requirements = [
        Requirement(
            "python",
            (Version("3.10.0"), Version("3.10.999")),
            (Version("3.9.0"), Version("3.11.999")),
            "backend",
            "python --version",
        ),
        Requirement(
            "npm",
            (Version("10.0.0"), Version("999.999.999")),
            (Version("10.0.0"), Version("999.999.999")),
            "frontend",
            "npm -v",
        ),
        Requirement(
            "node",
            (Version("20.0.0"), Version("20.999.999")),
            (Version("20.0.0"), Version("20.999.999")),
            "frontend",
            "node -v",
        ),
        Requirement(
            "docker",
            (Version("20.10.0"), Version("999.999.999")),
            (Version("19.0.0"), Version("999.999.999")),
            "docker",
            "docker --version",
            lambda v: v.split(",")[0],
        ),
        Requirement(
            "docker-compose",
            (Version("2.28.0"), Version("999.999.999")),
            (Version("1.29.0"), Version("999.999.999")),
            "docker",
            "docker-compose --version",
        ),
        Requirement(
            "git",
            (Version("2.30.0"), Version("999.999.999")),
            (Version("2.20.0"), Version("999.999.999")),
            "backend",
            "git --version",
        ),
    ]

    print("==================")
    print("System Information")
    print("==================")
    print(f"OS: {platform.system()} {platform.release()}")
    print(get_cpu_info())
    print(get_docker_platform())
    print("\n")

    check_req_types: Set[str] = set()
    if docker:
        check_req_types.add("docker")
    if frontend:
        check_req_types.add("frontend")
    if backend:
        check_req_types.add("backend")
    if not check_req_types:
        check_req_types.update(["docker", "frontend", "backend"])

    headers = ["Status", "Software", "Version Found", "Ideal Range", "Supported Range"]
    row_format = "{:<2} {:<25} {:<25} {:<25} {:<25}"

    print("=" * 100)
    print(row_format.format(*headers))
    print("=" * 100)

    all_ok = True
    for requirement in requirements:
        if requirement.req_type in check_req_types:
            result = requirement.format_result()
            if "❌" in requirement.status:
                all_ok = False
            print(result)

    if "frontend" in check_req_types:
        memory_check = check_memory(12)
        if "❌" in memory_check:
            all_ok = False
        print(memory_check)

    if not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
