#!/bin/bash
set -e
cd "${0%/*}"

echo "Building superset image locally"
docker build --platform=linux/amd64 -t "aven-superset:latest" .
echo "Done building superset image locally"

IMAGE_NAME="199658938451.dkr.ecr.us-east-2.amazonaws.com/superset:latest"
echo "Building image $IMAGE_NAME"
docker build --platform=linux/amd64 -t "$IMAGE_NAME" -f ./aven.Dockerfile .