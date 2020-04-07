#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# default command to run when the `run` input is empty
default-setup-command() {
  pip-install
}

# install python dependencies
pip-install() {
  cd $GITHUB_WORKSPACE

  # Don't use pip cache as it doesn't seem to help much.
  # cache-restore pip

  echo "::group::Install Python pacakges"
  pip install -r requirements.txt
  pip install -r requirements-dev.txt
  pip install -e ".[postgres,mysql]"
  echo "::endgroup::"

  # cache-save pip
}

# prepare (lint and build) frontend code
npm-install() {
  cd $GITHUB_WORKSPACE/superset-frontend

  cache-restore npm

  echo "::group::Install npm packages"
  echo "npm: $(npm --version)"
  echo "node: $(node --version)"
  npm ci
  echo "::endgroup::"

  cache-save npm
}

build-assets() {
  cd $GITHUB_WORKSPACE/superset-frontend

  echo "::group::Build static assets"
  npm run build -- --no-progress
  echo "::endgroup::"
}

npm-build() {
  if [[ $1 = '--no-cache' ]]; then
    build-assets
  else
    cache-restore assets
    if [[ -f $GITHUB_WORKSPACE/superset/static/assets/manifest.json ]]; then
      echo 'Skip frontend build because static assets already exist.'
    else
      build-assets
      cache-save assets
    fi
  fi
}

cypress-install() {
  cd $GITHUB_WORKSPACE/superset-frontend/cypress-base

  cache-restore cypress

  echo "::group::Install Cypress"
  npm ci
  echo "::endgroup::"

  cache-save cypress
}

testdata() {
  cd $GITHUB_WORKSPACE

  echo "::group::Load test data"
  superset db upgrade
  superset load_test_users
  superset load_examples --load-test-data
  superset init
  echo "::endgroup::"
}
