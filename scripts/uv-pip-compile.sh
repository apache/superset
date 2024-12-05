#!/usr/bin/env bash

set -e

ADDITIONAL_ARGS="$@"

uv pip compile pyproject.toml -c requirements/base.in -o requirements/base.txt $ADDITIONAL_ARGS
uv pip compile pyproject.toml requirements/development.in -c requirements/base.txt -o requirements/development.txt $ADDITIONAL_ARGS
