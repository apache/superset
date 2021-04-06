# This is the default target, which will be built when 
# you invoke make
.PHONY: all
all: install

# This rule tells make how to build hello from hello.cpp
install:
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
    
venv:
	# Create a virtual environment and activate it (recommended)
	python3 -m venv venv # setup a python3 virtualenv
	source venv/bin/activate