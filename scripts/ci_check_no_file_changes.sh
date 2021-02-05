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

# Usage instructions:
#
# to check for python changes, run with CHECKS=python
# To check for frontend changes, run with CHECKS=frontend
# To check for python and frontend changes, run with CHECKS="python frontend"

URL="https://api.github.com/repos/${GITHUB_REPO}/pulls/${PR_NUMBER}/files"
FILES=$(curl -s -X GET -G "${URL}" | jq -r '.[] | .filename')

cat<<EOF
CHANGED FILES:
$FILES

EOF

for CHECK in "$@"
do
  if [[ ${CHECK} == "python" ]]; then
    REGEX="(^tests\/|^superset\/|^setup\.py|^requirements\/.+\.txt)"
    echo "Searching for changes in python files"
  elif [[ ${CHECK} == "frontend" ]]; then
    REGEX="(^superset-frontend\/)"
    echo "Searching for changes in frontend files"
  else
    echo "Invalid check: \"${CHECK}\". Falling back to exiting with FAILURE code"
    exit 1
  fi

  if [[ "${FILES}" =~ ${REGEX} ]]; then
    echo "Detected changes... Exiting with FAILURE code"
    exit 1
  fi
done
echo "No changes detected... Exiting with SUCCESS code"
exit 0
