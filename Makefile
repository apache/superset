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

# Python version installed; we need 3.11-3.12
PYTHON=`command -v python3.11 || command -v python3.12`

.PHONY: install superset venv pre-commit up down logs ps nuke ports open enable-claude-zai

install: superset pre-commit

superset:
	# Bootstrap uv (the project's installer) into the active environment
	pip install uv

	# Install external dependencies
	uv pip install -r requirements/development.txt

	# Install Superset in editable (development) mode
	uv pip install -e .

	# Create an admin user in your metadata database
	superset fab create-admin \
                    --username admin \
                    --firstname "Admin I."\
                    --lastname Strator \
                    --email admin@superset.io \
                    --password general

	# Initialize the database
	superset db upgrade

	# Create default roles and permissions
	superset init

	# Load some data to play with
	superset load-examples

	# Install node packages
	cd superset-frontend; npm ci

update: update-py update-js

update-py:
	# Bootstrap uv (the project's installer) into the active environment
	pip install uv

	# Install external dependencies
	uv pip install -r requirements/development.txt

	# Install Superset in editable (development) mode
	uv pip install -e .

	# Initialize the database
	superset db upgrade

	# Create default roles and permissions
	superset init

update-js:
	# Install js packages
	cd superset-frontend; npm ci

venv:
	# Create a virtual environment and activate it (recommended)
	if ! [ -x "${PYTHON}" ]; then echo "You need Python 3.11 or 3.12 installed"; exit 1; fi
	test -d venv || ${PYTHON} -m venv venv # setup a python3 virtualenv
	. venv/bin/activate

activate:
	. venv/bin/activate

pre-commit:
	# setup pre commit dependencies
	pip install uv
	uv pip install -r requirements/development.txt
	pre-commit install

format: py-format js-format

py-format: pre-commit
	pre-commit run black --all-files

js-format:
	cd superset-frontend; npm run prettier

flask-app:
	flask run -p 8088 --reload --debugger

node-app:
	cd superset-frontend; npm run dev-server

build-cypress:
	cd superset-frontend; npm run build-instrumented
	cd superset-frontend/cypress-base; npm ci

open-cypress:
	if ! [ $(port) ]; then cd superset-frontend/cypress-base; CYPRESS_BASE_URL=http://localhost:9000 npm run cypress open; fi
	cd superset-frontend/cypress-base; CYPRESS_BASE_URL=http://localhost:$(port) npm run cypress open

report-celery-worker:
	celery --app=superset.tasks.celery_app:app worker

report-celery-beat:
	celery --app=superset.tasks.celery_app:app beat --pidfile /tmp/celerybeat.pid --schedule /tmp/celerybeat-schedulecd

admin-user:
	superset fab create-admin

# Docker Compose with auto-assigned ports (for running multiple instances)
up:
	./scripts/docker-compose-up.sh

up-detached:
	./scripts/docker-compose-up.sh -d

down:
	./scripts/docker-compose-up.sh down

logs:
	./scripts/docker-compose-up.sh logs -f

ps:
	./scripts/docker-compose-up.sh ps

nuke:
	./scripts/docker-compose-up.sh nuke

ports:
	./scripts/docker-compose-up.sh ports

open:
	./scripts/docker-compose-up.sh open

# Configure Claude Code to use the z.ai GLM Coding Plan as its backend for
# THIS project only. Writes to .claude/settings.local.json, which is
# gitignored, so the API key never gets committed.
# Get a key at https://z.ai/manage-apikey/apikey-list
# Usage: make enable-claude-zai ZAI_API_KEY=your_zai_api_key
enable-claude-zai:
	@if [ -z "$(ZAI_API_KEY)" ]; then echo "ERROR: ZAI_API_KEY is required. Get one at https://z.ai/manage-apikey/apikey-list"; echo "Usage: make enable-claude-zai ZAI_API_KEY=your_zai_api_key"; exit 1; fi
	@mkdir -p .claude
	@ZAI_API_KEY="$(ZAI_API_KEY)" python3 -c "import json, os; path = '.claude/settings.local.json'; data = json.load(open(path)) if os.path.exists(path) else {}; data.setdefault('env', {}).update({'ANTHROPIC_BASE_URL': 'https://api.z.ai/api/anthropic', 'ANTHROPIC_AUTH_TOKEN': os.environ['ZAI_API_KEY'], 'ANTHROPIC_DEFAULT_OPUS_MODEL': 'glm-5.2[1m]', 'ANTHROPIC_DEFAULT_SONNET_MODEL': 'glm-5.2[1m]', 'ANTHROPIC_DEFAULT_HAIKU_MODEL': 'glm-4.5-air', 'CLAUDE_CODE_AUTO_COMPACT_WINDOW': '1000000', 'API_TIMEOUT_MS': '3000000'}); json.dump(data, open(path, 'w'), indent=2); print('Wrote', path)"
	@echo "Claude Code is now configured to use z.ai's GLM Coding Plan for this project."
	@echo "Run 'claude' inside this repo to start (fully restart it first if it's already running)."
