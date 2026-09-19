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
"""Binds the hard-coded ``apache/superset-cache`` consumers to the Dockerfile.

``scripts/docker-build-extra-flags.sh`` derives the cache tag it *exports* from
the Dockerfile's ``ARG PY_VER`` default, but Compose files and the frontend
workflows spell the tag they *import* out in full. Without this check a routine
``PY_VER`` bump moves the exporter while every consumer keeps pulling a tag
nobody writes any more, silently turning warm builds into cold ones.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parents[3]

# Files that hard-code a cache tag and must track the Dockerfile default.
# scripts/docker-build-extra-flags.sh is deliberately absent: its py311/py312
# refs pin deliberately different base images.
CACHE_REF_CONSUMERS = (
    "docker-compose.yml",
    "docker-compose-non-dev.yml",
    "docker-compose-light.yml",
    ".github/workflows/superset-frontend.yml",
    ".github/workflows/frontend-bundle-size-nightly.yml",
)

# Suffixes docker-build-extra-flags.sh appends to isolate matrix targets from
# the shared `superset` cache ref.
PRESET_SUFFIXES = ("-dev", "-lean")

CACHE_REF_PATTERN = re.compile(r"apache/superset-cache:([^\s\"']+)")


def _dockerfile_py_ver() -> str:
    for line in (REPO_ROOT / "Dockerfile").read_text().splitlines():
        if line.startswith("ARG PY_VER="):
            return line.removeprefix("ARG PY_VER=").strip()
    raise AssertionError("Dockerfile no longer declares a default ARG PY_VER")


@pytest.mark.parametrize("relative_path", CACHE_REF_CONSUMERS)
def test_cache_ref_matches_dockerfile_py_ver(relative_path: str) -> None:
    path = REPO_ROOT / relative_path
    assert path.exists(), f"{relative_path} moved; update CACHE_REF_CONSUMERS"

    py_ver = _dockerfile_py_ver()
    allowed = {py_ver} | {f"{py_ver}{suffix}" for suffix in PRESET_SUFFIXES}

    refs = CACHE_REF_PATTERN.findall(path.read_text())
    assert refs, f"{relative_path} no longer references apache/superset-cache"

    for ref in refs:
        assert ref in allowed, (
            f"{relative_path} pulls apache/superset-cache:{ref}, but "
            f"scripts/docker-build-extra-flags.sh exports to "
            f"apache/superset-cache:{py_ver} (from the Dockerfile's "
            f"ARG PY_VER). Bump the two together."
        )
