#!/usr/bin/env bash

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

set -e

ADDITIONAL_ARGS="$@"

# Generate the requirements/base.txt file
uv pip compile pyproject.toml requirements/base.in -o requirements/base.txt $ADDITIONAL_ARGS

# Hack to remove "Unnamed requirements are not allowed as constraints" error from base requirements
grep --invert-match "./superset-core" requirements/base.txt > requirements/base-constraint.txt

# Generate the requirements/development.txt file, making sure the base requirements are used as a constraint to keep the versions in sync. Note that `development.txt` is a Superset of `base.txt` where version for the shared libs should match their version.
uv pip compile requirements/development.in -c requirements/base-constraint.txt -o requirements/development.txt $ADDITIONAL_ARGS

# Remove temporary base requirement file
rm requirements/base-constraint.txt

uv pip compile requirements/translations.in -o requirements/translations.txt $ADDITIONAL_ARGS
