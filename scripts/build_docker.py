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
import re
import subprocess
from textwrap import dedent

import click

REPO = "apache/superset"
CACHE_REPO = f"{REPO}-cache"
BASE_PY_IMAGE = "3.10-slim-bookworm"


def run_cmd(command: str, raise_on_failure: bool = True) -> str:
    process = subprocess.Popen(
        command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )

    output = ""
    if process.stdout is not None:
        for line in iter(process.stdout.readline, ""):
            print(line.strip())  # Print the line to stdout in real-time
            output += line

    process.wait()  # Wait for the subprocess to finish

    if process.returncode != 0 and raise_on_failure:
        raise subprocess.CalledProcessError(process.returncode, command, output)
    return output


def get_git_sha() -> str:
    return run_cmd("git rev-parse HEAD").strip()


def get_build_context_ref(build_context: str) -> str:
    """
    Given a context, return a ref:
    - if context is pull_request, return the PR's id
    - if context is push, return the branch
    - if context is release, return the release ref
    """

    event = os.getenv("GITHUB_EVENT_NAME")
    github_ref = os.getenv("GITHUB_REF", "")

    if event == "pull_request":
        github_head_ref = os.getenv("GITHUB_HEAD_REF", "")
        return re.sub("[^a-zA-Z0-9]", "-", github_head_ref)[:40]
    elif event == "release":
        return re.sub("refs/tags/", "", github_ref)[:40]
    elif event == "push":
        return re.sub("[^a-zA-Z0-9]", "-", re.sub("refs/heads/", "", github_ref))[:40]
    return ""


def is_latest_release(release: str) -> bool:
    output = (
        run_cmd(
            f"./scripts/tag_latest_release.sh {release} --dry-run",
            raise_on_failure=False,
        )
        or ""
    )
    return "SKIP_TAG::false" in output


def make_docker_tag(l: list[str]) -> str:  # noqa: E741
    return f"{REPO}:" + "-".join([o for o in l if o])


def get_docker_tags(
    build_preset: str,
    build_platforms: list[str],
    sha: str,
    build_context: str,
    build_context_ref: str,
    force_latest: bool = False,
) -> set[str]:
    """
    Return a set of tags given a given build context
    """
    tags: set[str] = set()
    tag_chunks: list[str] = []

    is_latest = is_latest_release(build_context_ref)

    if build_preset != "lean":
        # Always add the preset_build name if different from default (lean)
        tag_chunks += [build_preset]

    if len(build_platforms) == 1:
        build_platform = build_platforms[0]
        short_build_platform = build_platform.replace("linux/", "").replace("64", "")
        if short_build_platform != "amd":
            # Always a platform indicator if different from default (amd)
            tag_chunks += [short_build_platform]

    # Always craft a tag for the SHA
    tags.add(make_docker_tag([sha] + tag_chunks))
    # also a short SHA, cause it's nice
    tags.add(make_docker_tag([sha[:7]] + tag_chunks))

    if build_context == "release":
        # add a release tag
        tags.add(make_docker_tag([build_context_ref] + tag_chunks))
        if is_latest or force_latest:
            # add a latest tag
            tags.add(make_docker_tag(["latest"] + tag_chunks))
    elif build_context == "push" and build_context_ref == "master":
        tags.add(make_docker_tag(["master"] + tag_chunks))
    elif build_context == "pull_request":
        tags.add(make_docker_tag([f"pr-{build_context_ref}"] + tag_chunks))
    return tags


def get_docker_command(
    build_preset: str,
    build_platforms: list[str],
    is_authenticated: bool,
    sha: str,
    build_context: str,
    build_context_ref: str,
    force_latest: bool = False,
) -> str:
    tag = ""  # noqa: F841
    build_target = ""
    py_ver = BASE_PY_IMAGE
    docker_context = "."

    if build_preset == "dev":
        build_target = "dev"
    elif build_preset == "lean":
        build_target = "lean"
    elif build_preset == "py311":
        build_target = "lean"
        py_ver = "3.11-slim-bookworm"
    elif build_preset == "websocket":
        build_target = ""
        docker_context = "superset-websocket"
    elif build_preset == "ci":
        build_target = "ci"
    elif build_preset == "dockerize":
        build_target = ""
        docker_context = "-f dockerize.Dockerfile ."
    else:
        print(f"Invalid build preset: {build_preset}")
        exit(1)

    # Try to get context reference if missing
    if not build_context_ref:
        build_context_ref = get_build_context_ref(build_context)

    tags = get_docker_tags(
        build_preset,
        build_platforms,
        sha,
        build_context,
        build_context_ref,
        force_latest,
    )
    docker_tags = ("\\\n" + 8 * " ").join([f"-t {s} " for s in tags])

    docker_args = "--load" if not is_authenticated else "--push"
    target_argument = f"--target {build_target}" if build_target else ""

    cache_ref = f"{CACHE_REPO}:{py_ver}"
    if len(build_platforms) == 1:
        build_platform = build_platforms[0]
        short_build_platform = build_platform.replace("linux/", "").replace("64", "")
        cache_ref = f"{CACHE_REPO}:{py_ver}-{short_build_platform}"
    platform_arg = "--platform " + ",".join(build_platforms)

    cache_from_arg = f"--cache-from=type=registry,ref={cache_ref}"
    cache_to_arg = (
        f"--cache-to=type=registry,mode=max,ref={cache_ref}" if is_authenticated else ""
    )
    build_arg = f"--build-arg PY_VER={py_ver}" if py_ver else ""
    actor = os.getenv("GITHUB_ACTOR")

    return dedent(
        f"""\
        docker buildx build \\
        {docker_args} \\
        {docker_tags} \\
        {cache_from_arg} \\
        {cache_to_arg} \\
        {build_arg} \\
        {platform_arg} \\
        {target_argument} \\
        --label sha={sha} \\
        --label target={build_target} \\
        --label build_trigger={build_context} \\
        --label base={py_ver} \\
        --label build_actor={actor} \\
        {docker_context}"""
    )


@click.command()
@click.argument(
    "build_preset",
    type=click.Choice(["lean", "dev", "dockerize", "websocket", "py311", "ci"]),
)
@click.argument("build_context", type=click.Choice(["push", "pull_request", "release"]))
@click.option(
    "--platform",
    type=click.Choice(["linux/arm64", "linux/amd64"]),
    default=["linux/amd64"],
    multiple=True,
)
@click.option("--build_context_ref", help="a reference to the pr, release or branch")
@click.option("--dry-run", is_flag=True, help="Run the command in dry-run mode.")
@click.option("--verbose", is_flag=True, help="Print more info")
@click.option(
    "--force-latest", is_flag=True, help="Force the 'latest' tag on the release"
)
def main(
    build_preset: str,
    build_context: str,
    build_context_ref: str,
    platform: list[str],
    dry_run: bool,
    force_latest: bool,
    verbose: bool,
) -> None:
    """
    This script executes docker build and push commands based on given arguments.
    """

    is_authenticated = (
        True if os.getenv("DOCKERHUB_TOKEN") and os.getenv("DOCKERHUB_USER") else False
    )

    if force_latest and build_context != "release":
        print(
            "--force-latest can only be applied if the build context is set to 'release'"
        )
        exit(1)

    if build_context == "release" and not build_context_ref.strip():
        print("Release number has to be provided")
        exit(1)

    docker_build_command = get_docker_command(
        build_preset,
        platform,
        is_authenticated,
        get_git_sha(),
        build_context,
        build_context_ref,
        force_latest,
    )

    if not dry_run:
        print("Executing Docker Build Command:")
        print(docker_build_command)
        script = ""
        if os.getenv("DOCKERHUB_USER"):
            script = dedent(
                f"""\
                docker logout
                docker login --username "{os.getenv("DOCKERHUB_USER")}" --password "{os.getenv("DOCKERHUB_TOKEN")}"
                DOCKER_ARGS="--push"
                """
            )
        script = script + docker_build_command
        if verbose:
            run_cmd("cat Dockerfile")
        stdout = run_cmd(script)  # noqa: F841
    else:
        print("Dry Run - Docker Build Command:")
        print(docker_build_command)


if __name__ == "__main__":
    main()
