#! /bin/bash
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

run_git_tag () {
  if [[ "$DRY_RUN" == "false" ]] && [[ "$SKIP_TAG" == "false" ]]
  then
    git tag -a -f latest "${GITHUB_TAG_NAME}" -m "latest tag"
    echo "${GITHUB_TAG_NAME} has been tagged 'latest'"
  fi
  exit 0
}

###
# separating out git commands into functions so they can be mocked in unit tests
###
git_show_ref () {
  if [[ "$TEST_ENV" == "true" ]]
  then
    if [[ "$GITHUB_TAG_NAME" == "does_not_exist" ]]
        # mock return for testing only
    then
      echo ""
    else
      echo "2817aebd69dc7d199ec45d973a2079f35e5658b6 refs/tags/${GITHUB_TAG_NAME}"
    fi
  fi
  result=$(git show-ref "${GITHUB_TAG_NAME}")
  echo "${result}"
}

get_latest_tag_list () {
  if [[ "$TEST_ENV" == "true" ]]
  then
    echo "(tag: 2.1.0, apache/2.1test)"
  else
    result=$(git show-ref --tags --dereference latest | awk '{print $2}' | xargs git show --pretty=tformat:%d -s | grep tag:)
    echo "${result}"
  fi
}
###

split_string () {
  local version="$1"
  local delimiter="$2"
  local components=()
  local tmp=""
  for (( i=0; i<${#version}; i++ )); do
    local char="${version:$i:1}"
    if [[ "$char" != "$delimiter" ]]; then
      tmp="$tmp$char"
    elif [[ -n "$tmp" ]]; then
      components+=("$tmp")
      tmp=""
    fi
  done
  if [[ -n "$tmp" ]]; then
    components+=("$tmp")
  fi
  echo "${components[@]}"
}

DRY_RUN=false

# get params passed in with script when it was run
# --dry-run is optional and returns the value of SKIP_TAG, but does not run the git tag statement
# A tag name is required as a param. A SHA won't work. You must first tag a sha with a release number
# and then run this script
while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    --dry-run)
    DRY_RUN=true
    shift # past value
    ;;
    *)    # this should be the tag name
    GITHUB_TAG_NAME=$key
    shift # past value
    ;;
esac
done

if [ -z "${GITHUB_TAG_NAME}" ]; then
    echo "Missing tag parameter, usage: ./scripts/tag_latest_release.sh <GITHUB_TAG_NAME>"
    echo "SKIP_TAG=true" >> $GITHUB_OUTPUT
    exit 1
fi

if [ -z "$(git_show_ref)" ]; then
    echo "The tag ${GITHUB_TAG_NAME} does not exist. Please use a different tag."
    echo "SKIP_TAG=true" >> $GITHUB_OUTPUT
    exit 0
fi

# check that this tag only contains a proper semantic version
if ! [[ ${GITHUB_TAG_NAME} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
then
  echo "This tag ${GITHUB_TAG_NAME} is not a valid release version. Not tagging."
  echo "SKIP_TAG=true" >> $GITHUB_OUTPUT
  exit 1
fi

## split the current GITHUB_TAG_NAME into an array at the dot
THIS_TAG_NAME=$(split_string "${GITHUB_TAG_NAME}" ".")

# look up the 'latest' tag on git
LATEST_TAG_LIST=$(get_latest_tag_list) || echo 'not found'

# if 'latest' tag doesn't exist, then set this commit to latest
if [[ -z "$LATEST_TAG_LIST" ]]
then
  echo "there are no latest tags yet, so I'm going to start by tagging this sha as the latest"
  run_git_tag
  exit 0
fi

# remove parenthesis and tag: from the list of tags
LATEST_TAGS_STRINGS=$(echo "$LATEST_TAG_LIST" | sed 's/tag: \([^,]*\)/\1/g' | tr -d '()')

LATEST_TAGS=$(split_string "$LATEST_TAGS_STRINGS" ",")
TAGS=($(split_string "$LATEST_TAGS" " "))

# Initialize a flag for comparison result
compare_result=""

# Iterate through the tags of the latest release
for tag in $TAGS
do
  if [[ $tag == "latest" ]]; then
    continue
  else
    ## extract just the version from this tag
    LATEST_RELEASE_TAG="$tag"
    echo "LATEST_RELEASE_TAG: ${LATEST_RELEASE_TAG}"

    # check that this only contains a proper semantic version
    if ! [[ ${LATEST_RELEASE_TAG} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
    then
      echo "'Latest' has been associated with tag ${LATEST_RELEASE_TAG} which is not a valid release version. Looking for another."
      continue
    fi
    echo "The current release with the latest tag is version ${LATEST_RELEASE_TAG}"
    # Split the version strings into arrays
    THIS_TAG_NAME_ARRAY=($(split_string "$THIS_TAG_NAME" "."))
    LATEST_RELEASE_TAG_ARRAY=($(split_string "$LATEST_RELEASE_TAG" "."))

    # Iterate through the components of the version strings
    for (( j=0; j<${#THIS_TAG_NAME_ARRAY[@]}; j++ )); do
        echo "Comparing ${THIS_TAG_NAME_ARRAY[$j]} to ${LATEST_RELEASE_TAG_ARRAY[$j]}"
        if [[ $((THIS_TAG_NAME_ARRAY[$j])) > $((LATEST_RELEASE_TAG_ARRAY[$j])) ]]; then
            compare_result="greater"
            break
        elif [[ $((THIS_TAG_NAME_ARRAY[$j])) < $((LATEST_RELEASE_TAG_ARRAY[$j])) ]]; then
            compare_result="lesser"
            break
        fi
    done
  fi
done

# Determine the result based on the comparison
if [[ -z "$compare_result" ]]; then
    echo "Versions are equal"
    echo "SKIP_TAG=true" >> $GITHUB_OUTPUT
elif [[ "$compare_result" == "greater" ]]; then
    echo "This release tag ${GITHUB_TAG_NAME} is newer than the latest."
    echo "SKIP_TAG=false" >> $GITHUB_OUTPUT
    # Add other actions you want to perform for a newer version
elif [[ "$compare_result" == "lesser" ]]; then
    echo "This release tag ${GITHUB_TAG_NAME} is older than the latest."
    echo "This release tag ${GITHUB_TAG_NAME} is not the latest. Not tagging."
    # if you've gotten this far, then we don't want to run any tags in the next step
    echo "SKIP_TAG=true" >> $GITHUB_OUTPUT
fi
