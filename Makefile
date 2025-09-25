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

# Python version installed; we need 3.10-3.11
PYTHON=`command -v python3.11 || command -v python3.10`

.PHONY: install superset venv pre-commit

install: superset pre-commit

superset:
	# Install external dependencies
	pip install -r requirements/development.txt

	# Install Superset in editable (development) mode
	pip install -e .

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
	# Install external dependencies
	pip install -r requirements/development.txt

	# Install Superset in editable (development) mode
	pip install -e .

	# Initialize the database
	superset db upgrade

	# Create default roles and permissions
	superset init

update-js:
	# Install js packages
	cd superset-frontend; npm ci

venv:
	# Create a virtual environment and activate it (recommended)
	if ! [ -x "${PYTHON}" ]; then echo "You need Python 3.10 or 3.11 installed"; exit 1; fi
	test -d venv || ${PYTHON} -m venv venv # setup a python3 virtualenv
	. venv/bin/activate

activate:
	. venv/bin/activate

pre-commit:
	# setup pre commit dependencies
	pip3 install -r requirements/development.txt
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

# MCP Service Setup - Complete setup from fresh clone
mcp-setup: venv
	# Activate virtual environment and run setup
	. venv/bin/activate && \
	echo "Installing Python dependencies..." && \
	pip install -r requirements/development.txt && \
	pip install -e . && \
	echo "✓ Python dependencies installed" && \
	\
	# Ensure database is initialized before running MCP setup
	if ! superset db current 2>/dev/null | grep -q "head"; then \
		echo "Initializing database..." && \
		superset db upgrade && \
		superset init && \
		echo "✓ Database initialized"; \
	fi && \
	\
	# Install frontend dependencies if needed
	if [ ! -d "superset-frontend/node_modules" ]; then \
		echo "Installing frontend dependencies..." && \
		cd superset-frontend && npm ci && cd .. && \
		echo "✓ Frontend dependencies installed"; \
	fi && \
	\
	# Run the MCP setup CLI command
	superset mcp setup

# Quick MCP service runner
mcp-run:
	@echo "Starting MCP service..."
	superset mcp run

# Check MCP service health
mcp-check:
	@echo "Checking MCP service setup..."
	@echo ""
	@test -f superset_config.py && echo "✓ superset_config.py exists" || echo "✗ superset_config.py missing"
	@grep -q "ANTHROPIC_API_KEY" superset_config.py 2>/dev/null && echo "✓ Anthropic API key configured" || echo "✗ Anthropic API key not configured"
	@test -d superset/mcp_service && echo "✓ MCP service directory exists" || echo "✗ MCP service directory missing"
	@test -f superset/mcp_service/run_mcp_server.py && echo "✓ MCP server script exists" || echo "✗ MCP server script missing"
	@echo ""
	@echo "To set up MCP service, run: make mcp-setup"
