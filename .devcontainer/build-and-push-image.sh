#!/bin/bash
#
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
#
# Script to build and push the devcontainer image to GitHub Container Registry
# This allows caching the image between Codespace sessions

# You'll need to run this with appropriate GitHub permissions
# gh auth login --scopes write:packages

REGISTRY="ghcr.io"
OWNER="apache"
REPO="superset"
TAG="devcontainer-base"

echo "Building devcontainer image..."
docker build -t $REGISTRY/$OWNER/$REPO:$TAG .devcontainer/

echo "Pushing to GitHub Container Registry..."
docker push $REGISTRY/$OWNER/$REPO:$TAG

echo "Done! Update .devcontainer/devcontainer.json to use:"
echo "  \"image\": \"$REGISTRY/$OWNER/$REPO:$TAG\""
