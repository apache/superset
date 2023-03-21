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
SUPERSET_RC_VERSION ?= $(shell bash -c 'read -p "Superset RC Version: " rc_version; echo $$rc_version')
APACHE_USER_EMAIL ?= $(shell bash -c 'read -p "Apache user email: " user_email; echo $$user_email')
GET_TOKEN ?= $(shell bash -c 'read -p "Github token: " github_token; echo $$github_token')
$(eval dry-run:;@:)
$(eval e-break:;@:)

.PHONY: install setup cherry-tree cut-branch get-branch

install:
	pip install -r RELEASING/requirements.txt

setup:
	. set_release_env.sh $(SUPERSET_RC_VERSION) $(APACHE_USER_EMAIL)

get_set_env:
	if [[ -f releasing_env ]]; then \
		export $(cat ./releasing_env | xargs) \
	else \
		make setup; \
	fi

cherry-tree:
ifndef GITHUB_TOKEN
	$(eval TOKEN=$(GET_TOKEN))
else
	$(eval TOKEN=${GITHUB_TOKEN})
endif

ifeq (dry-run, $(filter dry-run,$(MAKECMDGOALS)))
	$(eval DRY_RUN=-nd)
endif

ifeq (e-break, $(filter e-break,$(MAKECMDGOALS)))
	$(eval ERROR_MODE_BREAK=--error-mode break)
endif
	cherrytree bake -r apache/superset -m master -l v${SUPERSET_GITHUB_BRANCH} ${DRY_RUN} ${ERROR_MODE_BREAK} ${SUPERSET_GITHUB_BRANCH} --access-token ${TOKEN}

cut-branch:
ifndef ${SUPERSET_GITHUB_BRANCH}
	make get_set_env
	make cut-branch
else
	git checkout master
	git pull
	git checkout -b ${SUPERSET_GITHUB_BRANCH}
	git push origin ${SUPERSET_GITHUB_BRANCH}
endif

get-branch:
ifndef ${SUPERSET_GITHUB_BRANCH}
	make get_set_env
	make get-branch
else
	git checkout master
	git pull
	git checkout ${SUPERSET_GITHUB_BRANCH}
endif

# clean:
# 	git checkout master

# test-get-branch:
#     # Test when SUPERSET_GITHUB_BRANCH is undefined
# 	make clean  # Optional, but recommended
# 	make get-branch SUPERSET_GITHUB_BRANCH=my_branch
# 		# Verify that git checkout master was executed
# 	if [ $$(git branch --show-current) != "master" ]; then \
# 			echo "Error: Expected 'git checkout master' to be executed"; \
# 			exit 1; \
# 	fi
# 	echo "Test for undefined SUPERSET_GITHUB_BRANCH passed"

# 	# Test when SUPERSET_GITHUB_BRANCH is defined
# 	make clean  # Optional, but recommended
# 	make get_set_env
# 	make get-branch SUPERSET_GITHUB_BRANCH=my_branch

# 	# Verify that git checkout my_branch was executed
# 	if [ $$(git branch --show-current) != "my_branch" ]; then \
# 			echo "Error: Expected 'git checkout my_branch' to be executed"; \
# 			exit 1; \
# 	fi
# 	echo "Test for defined SUPERSET_GITHUB_BRANCH passed"
