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

URL="https://api.github.com/repos/${GITHUB_REPO}/pulls/${PR_NUMBER}/files"
FILES=$(curl -s -X GET -G $URL | jq -r '.[] | .filename')

cat<<EOF
CHANGED FILES:
$FILES

EOF

if [[ "${FILES}" =~ (superset\/.+\.py|setup\.py|requirements\/.+\.txt) ]]; then
  echo "Detected changes in python files... Exiting with FAILURE code"
  exit 1
fi
echo "No changes in python... Exiting with SUCCESS code"
exit 0
