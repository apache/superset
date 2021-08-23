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

# Python version installed; we need 3.8 or 3.7
PYTHON=`command -v python3.8 || command -v python3.7`

.PHONY: install superset venv pre-commit

install: superset pre-commit

superset:
	# Install external dependencies
	pip install -r requirements/local.txt

	# Install Superset in editable (development) mode
	pip install -e .

	# Create an admin user in your metadata database
	superset fab create-admin

	# Initialize the database
	superset db upgrade

	# Create default roles and permissions
	superset init

	# Load some data to play with
	superset load-examples

update: update-py update-js

update-py:
	# Install external dependencies
	pip install -r requirements/local.txt

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
	if ! [ -x "${PYTHON}" ]; then echo "You need Python 3.7 or 3.8 installed"; exit 1; fi
	test -d venv || ${PYTHON} -m venv venv # setup a python3 virtualenv
	. venv/bin/activate

make activate:
	source venv/bin/activate

pre-commit:
	# setup pre commit dependencies
	pip3 install -r requirements/integration.txt
	pre-commit install

format: py-format js-format

py-format: pre-commit
	pre-commit run black --all-files

py-lint: pre-commit
	pylint -j 0 superset

js-format:
	cd superset-frontend; npm run prettier

flask-app:
	flask run -p 8088 --with-threads --reload --debugger

node-app:
	cd superset-frontend; npm run dev-server
