#!/usr/bin/env bash

set -e

ADDITIONAL_ARGS="$@"

# Generate the requirements/base.txt file
uv pip compile pyproject.toml -c requirements/base.in -o requirements/base.txt $ADDITIONAL_ARGS

# Generate the requirements/development.txt file, making sure requirements/base.txt is a constraint to keep the versions in sync
uv pip compile pyproject.toml requirements/development.in -c requirements/base.txt -o requirements/development.txt $ADDITIONAL_ARGS
