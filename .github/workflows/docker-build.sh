#!/usr/bin/env bash

echo "${GITHUB_REF#refs/heads/}"
git rev-parse HEAD
