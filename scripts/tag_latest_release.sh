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

run_git_tag () {
  if [ "$DRY_RUN" = "false" ] && [ "$SKIP_TAG" = "false" ]
  then
    git tag -a -f latest "${GITHUB_TAG_NAME}" -m "latest tag"
    echo "${GITHUB_TAG_NAME} has been tagged 'latest'"
  fi
  exit 0
}

echo "::set-output name=SKIP_TAG::false"
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
    exit 1
fi

if [ -z "$(git show-ref ${GITHUB_TAG_NAME})" ]; then
    echo "The tag ${GITHUB_TAG_NAME} does not exist. Please use a different tag."
    exit 1
fi

# check that this tag only contains a proper semantic version
if ! [[ ${GITHUB_TAG_NAME} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
then
  echo "This tag ${GITHUB_TAG_NAME} is not a valid release version. Not tagging."
  echo "::set-output name=SKIP_TAG::true"
  exit 0
fi

## split the current GITHUB_TAG_NAME into an array at the dot
IFS=$'.'
THIS_TAG_NAME=(${GITHUB_TAG_NAME})  || echo 'not found'

# look up the 'latest' tag on git
LATEST_TAG_LIST=$(git show-ref latest && git show --pretty=tformat:%d -s latest | grep tag:) || echo 'not found'

# if 'latest' tag doesn't exist, then set this commit to latest
if [[ -z "$LATEST_TAG_LIST" ]]
then
  # move on to next task
  echo "there are no latest tags yet, so I'm going to start by tagging this sha as the latest"
  run_git_tag
fi

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
      echo "'Latest' has been associated with tag ${LATEST_RELEASE_TAG} which is not a valid release version. Looking for another."
      continue
    fi
    echo "The current release with the latest tag is version ${LATEST_RELEASE_TAG}"

    ## remove the sha from the latest tag and split into an array- split at the dot
    IFS=$'.'
    LATEST_RELEASE_TAG_SPLIT=(${LATEST_RELEASE_TAG})

    for (( j=0; j<${#THIS_TAG_NAME[@]}; j++ ))
    do
      ## if this value is greater than the latest release, then tag it, if it's lower, then stop, if it's
      ## the same then move on to the next index
      if [[ ${THIS_TAG_NAME[$j]} -gt ${LATEST_RELEASE_TAG_SPLIT[$j]} ]]
      then
        echo "This release tag ${GITHUB_TAG_NAME} is the latest. Tagging it"
        run_git_tag

      elif [[ ${THIS_TAG_NAME[$j]} -lt ${LATEST_RELEASE_TAG_SPLIT[$j]} ]]
      then
        continue
      fi
    done
  fi
done

echo "This release tag ${GITHUB_TAG_NAME} is not the latest. Not tagging."
# if you've gotten this far, then we don't want to run any tags in the next step
echo "::set-output name=SKIP_TAG::true"
