#! /bin/bash
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


get_latest_tag_list() {
 echo git show-ref latest && git show --pretty=tformat:%d -s latest | grep tag: || echo 'not found'
}

# look up the 'latest' tag on git
LATEST_TAG_LIST=$(get_latest_tag_list)

## get all tags that use the same sha as the latest tag. split at comma.
IFS=$','
LATEST_TAGS=($LATEST_TAG_LIST)

## loop over those tags and only take action on the one that isn't tagged 'latest'
## that one will have the version number tag
for (( i=0; i<${#LATEST_TAGS[@]}; i++ ))
do
  if [[ ${LATEST_TAGS[$i]} != *"latest"* ]]
  then
    ## extract just the version from this tag
    LATEST_RELEASE_TAG=$(echo "${LATEST_TAGS[$i]}" | sed -E -e 's/tag:|\(|\)|[[:space:]]*//g')

    # check that this only contains a proper semantic version
    if ! [[ ${LATEST_RELEASE_TAG} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
    then
      continue
    fi
    break
  fi
done

echo ${LATEST_RELEASE_TAG}
