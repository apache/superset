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

.PHONY: install superset venv pre-commit up down logs ps nuke ports open

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
	cd superset-frontend; npm run format

flask-app:
	flask run -p 8088 --reload --debugger

node-app:
	cd superset-frontend; npm run dev-server

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

# ---------------------------------------------------------------------------
# Asset approval QA environment (docker-compose-light)
#
#   make asset-demo-help   print these instructions, the logins and the happy flow
#   make asset-demo        build the extension, start the stack, wait, seed the cast
#
# Needs Docker with ~8 GB. The first run takes 15-25 minutes (image builds and
# example loading); later runs only rebuild the extension and re-seed.
# Override the port or project:  make asset-demo ASSET_DEMO_PORT=9003 ASSET_DEMO_PROJECT=my-qa
# The README's "Asset approval -- QA build" section has the full walkthrough.
# ---------------------------------------------------------------------------
ASSET_DEMO_PROJECT ?= asset-approval-qa
ASSET_DEMO_PORT ?= 9002
ASSET_DEMO_COMPOSE = NODE_PORT=$(ASSET_DEMO_PORT) docker compose -p $(ASSET_DEMO_PROJECT) -f docker-compose-light.yml
ASSET_DEMO_EXT = local_extensions/asset-approval
# Matches `engines.node` in superset-frontend/package.json and the node stage
# in the Dockerfile. Node 20 cannot install this workspace.
ASSET_DEMO_NODE ?= node:24

.PHONY: asset-demo asset-demo-help asset-demo-packages asset-demo-extension asset-demo-up asset-demo-seed asset-demo-examples asset-demo-logs asset-demo-down asset-demo-nuke

asset-demo: asset-demo-extension asset-demo-up asset-demo-seed
	@echo ""
	@echo "Asset approval is up: http://localhost:$(ASSET_DEMO_PORT)"
	@echo "Sign in as alex, priya, sam or morgan (password: general)."
	@echo "Logins, commands and the happy flow: make asset-demo-help"

asset-demo-help:
	@echo ""
	@echo "Asset approval -- QA environment"
	@echo "================================"
	@echo ""
	@echo "Commands"
	@echo "  make asset-demo            build the extension, start the stack, wait until healthy, seed"
	@echo "  make asset-demo-seed       back to one change waiting for review"
	@echo "  make asset-demo-examples   load the example dashboards if your environment skipped them"
	@echo "  make asset-demo-logs       follow the init and Superset logs"
	@echo "  make asset-demo-down       stop the stack, keeping its data"
	@echo "  make asset-demo-nuke       stop the stack and delete its database"
	@echo ""
	@echo "Open  http://localhost:$(ASSET_DEMO_PORT)   (project: $(ASSET_DEMO_PROJECT))"
	@echo ""
	@echo "Logins (local QA fixtures, never used anywhere real)"
	@echo "  alex     general   Alpha               Alex Rivera  -- the author: makes changes"
	@echo "  priya    general   Alpha               Priya Shah   -- the approver: reviews them"
	@echo "  sam      general   Gamma + data access Sam Carter   -- the viewer: sees only what is live"
	@echo "  morgan   general   Admin               Morgan Lee   -- admin, editor of nothing: no bypass"
	@echo "  admin    admin     Admin               setup only -- never test as admin"
	@echo ""
	@echo "Seeded assets"
	@echo "  USA Births Names   editors alex + priya   the main walkthrough"
	@echo "  Sales Dashboard    editor  alex only      nobody else can approve"
	@echo "  first chart / first dataset   editors alex + priya"
	@echo ""
	@echo "Happy flow (the seed leaves one change from alex waiting for priya)"
	@echo "  1. sam     USA Births Names still shows the old title; no banner, no bell count."
	@echo "  2. morgan  no banner and no Approve button: admin is not an editor, no bypass."
	@echo "  3. priya   bell shows 1; Settings > Manage > Approvals lists it; Review opens the dashboard."
	@echo "  4. priya   banner + review panel beside the charts; Show changes previews it."
	@echo "  5. priya   Edit dashboard -> lock dialog: Alex Rivera is changing this dashboard."
	@echo "  6. priya   Request changes with a note -> alex sees it returned, with the note."
	@echo "  7. alex    edit + Save -> toast: viewers still see the live version; Request review."
	@echo "  8. priya   Approve -> confirm -> the new title is live; sam sees it; version history lists it."
	@echo "  9. alex    chart: Explore save held, Charts list tag 'Changes pending'; request, priya approves."
	@echo " 10. alex    dataset: save -> Review changes -> Submitted by me -> Request review;"
	@echo "             priya reviews it from Approvals (Source / Metrics / Columns diff) and approves."
	@echo " 11. alex    delete a chart -> held for review, still listed until approved."
	@echo " 12. alex    Sales Dashboard -> Request review: 'No one else can approve'; add priya in"
	@echo "             the Editors picker -> warning clears -> send. (make asset-demo-seed resets it.)"
	@echo " 13. morgan  Settings > Manage > Change review: read-only, 'Admin bypass: Not available'."
	@echo ""
	@echo "Full step-by-step with what to expect: README.md, section 'The happy flow, step by step'."
	@echo ""

# The workspace packages are compiled, not just installed: the extension and
# the host both import `@superset-ui/core` and `@apache-superset/core` by
# their built output, which a fresh checkout does not have. Without this the
# frontend fails with TS6305 ("output file has not been built from source
# file") and the extension build fails behind it -- which is what made
# `make asset-demo` unusable on a clean clone.
asset-demo-packages:
	@echo "Building the workspace packages (first run only; a few minutes)."
	# chart-controls is built on its own first, because `plugins:build` runs
	# its tsc phase as `lerna exec --concurrency 3`, and `lerna exec` does not
	# sort topologically. Seventeen plugins declare a project reference to
	# chart-controls, so on a tree with no `lib/` several `tsc --build`
	# processes race to produce the same declaration files and one of them
	# reads a half-written one:
	#
	#   src/controlPanel.tsx(996,19): error TS2339: Property
	#   'timeComparisonControls' does not exist on type 'typeof import(
	#   ".../superset-ui-chart-controls/lib/sections/index")'
	#
	# which made `make asset-demo` fail on the first run of a fresh clone and
	# succeed on the second. Building it once up front leaves the parallel
	# phase nothing to write. Its own references pull in superset-core and
	# superset-ui-core, so this covers all three shared packages.
	docker run --rm -v "$(CURDIR):/app" -w /app/superset-frontend $(ASSET_DEMO_NODE) bash -lc "\
	  [ -d node_modules ] || npm ci; \
	  npx tsc --build packages/superset-ui-chart-controls && \
	  npm run plugins:build"

asset-demo-extension: asset-demo-packages
	docker run --rm -v "$(CURDIR):/app" -w /app/$(ASSET_DEMO_EXT)/frontend $(ASSET_DEMO_NODE) bash -lc "npm install --legacy-peer-deps && npm run build"
	docker run --rm -v "$(CURDIR):/app" -w /app/$(ASSET_DEMO_EXT) $(ASSET_DEMO_NODE) bash -lc "bash build.sh"

asset-demo-up:
	@echo "Starting the stack. The first run builds images and loads examples: 15-25 minutes."
	@echo "Superset starts only after superset-init-light finishes, so this blocks until then."
	$(ASSET_DEMO_COMPOSE) up -d
	@code=$$(docker inspect --format '{{.State.ExitCode}}' $$($(ASSET_DEMO_COMPOSE) ps -aq superset-init-light) 2>/dev/null); \
	  [ "$$code" = "0" ] || { echo "superset-init-light exited with $$code -- see: make asset-demo-logs"; exit 1; }
	@echo "Waiting for Superset to report healthy..."
	@for i in $$(seq 1 120); do \
	  status=$$(docker inspect --format '{{.State.Health.Status}}' $$($(ASSET_DEMO_COMPOSE) ps -q superset-light) 2>/dev/null); \
	  [ "$$status" = "healthy" ] && break; \
	  [ $$i = 120 ] && { echo "superset-light did not become healthy in 10 minutes -- see: make asset-demo-logs"; exit 1; }; \
	  sleep 5; \
	done
	@echo "Waiting for http://localhost:$(ASSET_DEMO_PORT) (the frontend compiles on first start)..."
	@for i in $$(seq 1 120); do \
	  curl -sf -o /dev/null --max-time 5 http://localhost:$(ASSET_DEMO_PORT)/health && break; \
	  [ $$i = 120 ] && { echo "http://localhost:$(ASSET_DEMO_PORT) did not answer in 10 minutes -- see: make asset-demo-logs"; exit 1; }; \
	  sleep 5; \
	done

asset-demo-seed:
	@$(ASSET_DEMO_COMPOSE) exec superset-light /app/.venv/bin/python /app/$(ASSET_DEMO_EXT)/qa/seed.py || { \
	  echo "Seeding failed. If it says there is no \"USA Births Names\", load the examples first: make asset-demo-examples"; exit 1; }

asset-demo-examples:
	$(ASSET_DEMO_COMPOSE) exec superset-light /app/.venv/bin/superset load-examples

asset-demo-logs:
	$(ASSET_DEMO_COMPOSE) logs -f superset-init-light superset-light superset-node-light

asset-demo-down:
	$(ASSET_DEMO_COMPOSE) down

asset-demo-nuke:
	$(ASSET_DEMO_COMPOSE) down -v
