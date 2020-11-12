#!/usr/bin/env bash

echo "${GITHUB_REF#refs/heads/}"
git rev-parse HEAD

env

# Login first
docker login -u "${DOCKERHUB_USER}" -p "${DOCKERHUB_TOKEN}"
