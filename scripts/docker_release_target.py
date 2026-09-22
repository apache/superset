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
"""Decides whether `scheduled-docker-image-refresh.yml` needs to override the
Dockerfile target `supersetbot` resolved for a build preset.

supersetbot's preset -> Dockerfile-target mapping tracks current master, but
the scheduled refresh builds an arbitrary *historical* release ref. A preset
introduced after that release won't have a matching stage in its Dockerfile.
That's what broke in #44220: `superset` was added as both a new Dockerfile
stage and the preset backing the plain tags (`latest`, `<version>`, per-SHA)
by #44100. Releases cut before it (5.0.0, 6.0.0, 6.1.0 -- every release
published as of #44220) still have their plain tags built from the
pre-existing `lean` stage, so that's the correct substitute for `superset`
on those releases, not a guess -- see `docs/admin_docs/installation/
docker-builds.mdx` as of #44100 for the plain tag's pre-split source.
"""

import re
import sys
from pathlib import Path

# Matches the value of a `--target <stage>` flag on an assembled buildx
# command line. Restricted to Docker's own legal stage-name characters so an
# unrelated `--target` elsewhere in the output can't smuggle in a bogus value.
_TARGET_FLAG_RE = re.compile(r"--target\s+([A-Za-z0-9_.-]+)")


def _stage_exists(dockerfile_text: str, stage: str) -> bool:
    """Whether `dockerfile_text` defines a build stage named `stage`.

    Anchored to the start of a line (only whitespace may precede `FROM`) so a
    comment (`# FROM ... AS stage`) or a stage name merely mentioned in a RUN
    command can't produce a false positive. Case-insensitive and whitespace-
    tolerant because Dockerfile's own `FROM`/`AS` keywords are too.
    """
    pattern = re.compile(
        rf"^[ \t]*FROM\s+.*\s+AS\s+{re.escape(stage)}\s*$",
        re.IGNORECASE | re.MULTILINE,
    )
    return pattern.search(dockerfile_text) is not None


def resolve_extra_flags(
    build_preset: str,
    dry_run_output: str,
    dockerfile_text: str,
) -> str | None:
    """Returns the `--extra-flags` override for `supersetbot docker`, or
    `None` if the preset's own target already works as-is.

    Args:
        build_preset: the `--preset` value passed to `supersetbot docker`.
        dry_run_output: stdout of `supersetbot docker ... --dry-run` for
            this preset/release.
        dockerfile_text: the contents of the `Dockerfile` actually checked
            out for the release being refreshed.

    Raises:
        ValueError: the dry-run output named no `--target` at all, or named
            one that's missing from this release's Dockerfile with no
            known-safe substitute. Either way this is an unexpected
            condition the caller should fail loudly on rather than silently
            build the wrong thing (or nothing) -- see #44220.
    """
    # A repeated `--target` on a buildx command line resolves to its last
    # occurrence (buildx keeps the last value of any repeated flag), so the
    # effective target is the final match, not the first.
    matches = _TARGET_FLAG_RE.findall(dry_run_output)
    if not matches:
        raise ValueError(
            "supersetbot's --dry-run output did not contain a --target "
            "flag; cannot determine which Dockerfile stage this preset "
            "would build. Refusing to guess -- see #44220."
        )
    target_stage = matches[-1]

    if _stage_exists(dockerfile_text, target_stage):
        return None

    if build_preset == "superset" and _stage_exists(dockerfile_text, "lean"):
        return "--target lean --label target=lean"

    raise ValueError(
        f"Preset '{build_preset}' resolves to Dockerfile target "
        f"'{target_stage}', which does not exist in this release, and no "
        "known-safe substitute applies. Refusing to guess -- see #44220 for "
        "the same failure mode with the 'superset' preset."
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: docker_release_target.py <build_preset>", file=sys.stderr)
        sys.exit(2)

    try:
        result = resolve_extra_flags(
            build_preset=sys.argv[1],
            dry_run_output=sys.stdin.read(),
            dockerfile_text=Path("Dockerfile").read_text(),
        )
    except ValueError as ex:
        print(f"::error::{ex}", file=sys.stderr)
        sys.exit(1)

    if result:
        print(
            f"::notice::Preset '{sys.argv[1]}' needs an override for this "
            f"release; building with: {result}",
            file=sys.stderr,
        )
        print(result)
