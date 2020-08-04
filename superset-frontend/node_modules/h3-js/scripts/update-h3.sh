#!/usr/bin/env bash

# Copyright 2018-2019 Uber Technologies, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -ex

rm -rf h3c

# Clone the core C repo and check out the appropriate tag
git clone https://github.com/uber/h3.git h3c
pushd h3c
git pull origin master --tags
git checkout "v$(cat ../H3_VERSION)"
