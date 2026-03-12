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
Centralized version metadata utilities for Apache Superset.
"""

import os
import subprocess
from typing import Any

from flask import current_app as app


def get_version_metadata() -> dict[str, Any]:
    """
    Get version metadata with backward compatibility.

    Returns all the fields that existing code expects.
    """
    # Start with app config for backward compatibility
    metadata = {
        "version_string": app.config.get("VERSION_STRING", "unknown"),
        "version_sha": app.config.get("VERSION_SHA", ""),
        "build_number": app.config.get("BUILD_NUMBER"),
    }

    # Get Git info from GitHub Actions or local git
    if github_sha := os.environ.get("GITHUB_SHA"):
        metadata["full_sha"] = github_sha
        if not metadata["version_sha"]:
            metadata["version_sha"] = github_sha[:8]

    # Get branch name
    branch_name = (
        os.environ.get("GITHUB_HEAD_REF")
        or os.environ.get("GITHUB_REF_NAME")
        or _get_local_branch()
    )
    if branch_name:
        metadata["branch_name"] = branch_name

    return metadata


def get_dev_env_label() -> str:
    """
    Generate development environment label with branch/SHA info.

    No Flask app dependency - safe to call during config loading.

    Returns:
        Simple string like "branch@sha" or just "@sha" or ""
    """
    # Get branch and SHA from environment or git
    branch = (
        os.environ.get("GITHUB_HEAD_REF")
        or os.environ.get("GITHUB_REF_NAME")
        or _get_local_branch()
    )

    sha = os.environ.get("GITHUB_SHA") or _get_local_sha()
    if sha:
        sha = sha[:8]  # Short SHA

    # Build label
    if branch and sha:
        return f"{branch}@{sha}"
    elif sha:
        return f"@{sha}"
    elif branch:
        return branch
    else:
        return ""


def _get_local_branch() -> str | None:
    """Get branch from local git as fallback."""
    try:
        output = subprocess.check_output(  # noqa: S603
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],  # noqa: S607
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        branch = output.decode().strip()
        return None if branch == "HEAD" else branch
    except Exception:  # pylint: disable=broad-except
        return None


def _get_local_sha() -> str | None:
    """Get SHA from local git as fallback."""
    try:
        output = subprocess.check_output(  # noqa: S603
            ["git", "rev-parse", "HEAD"],  # noqa: S607
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return output.decode().strip()
    except Exception:  # pylint: disable=broad-except
        return None
