#!/bin/bash

# This script installs Apache Superset from a specific GitHub repository and tag.
# It sets up logging, environment variables, enables memory overcommit for Redis,
# clones the Superset repository, copies custom installation files, builds the stock and custom Docker images,
# and starts the Superset components using Docker Compose.
# The script assumes that the following environment variables are set:
# - SUPERSET_GITHUB_URL: The URL of the Superset GitHub repository.
# - TAG: The tag or branch of the Superset repository to check out.

# Set up logging: define a log-step function, export it, create a log file, and redirect all output to the log file.
log-step() {
  printf "\n--> %s\n\n" "$(date): $1"
}
export -f log-step
LOG_FILE=$HOME/superset_installation.log
touch $LOG_FILE

# Redirect stdout and stderr to the log file and save the original stdout and stderr
# file descriptors (3 and 4) for later restoration.
# This allows us to log all output to the log file while still being able to see it in the terminal.
# The 'exec' command replaces the current shell with a new one, redirecting stdout and stderr to the log file.
# The '3>&1 4>&2' part saves the original stdout and stderr to file descriptors.
# The 'trap' command restores the original stdout and stderr when the script exits or is interrupted.
# The '0 1 2 3' arguments specify the signals that will trigger the trap: EXIT, SIGHUP, SIGINT, and SIGQUIT.
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>$LOG_FILE 2>&1

log-step "Superset Installation Log"

# Set environment variables for the installation process.
# The 'env_variables.sh' script is sourced to load required environment variables into the current shell session.
log-step "Set env variables."
source ./env_variables.sh

# The following commands are used to enable memory overcommit on the system,
# which is required for Redis to function optimally. The first command sets the kernel parameter
# which is required for Redis to function optimally. The first command sets the kernel parameter
# 'vm.overcommit_memory' to 1 for the current session. The second command ensures that this setting
# persists across reboots by adding it to /etc/sysctl.conf if it is not already present.
log-step "Enable memory overcommit for Redis"
sudo sysctl vm.overcommit_memory=1
grep -qxF 'vm.overcommit_memory = 1' /etc/sysctl.conf || echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf


# Clone the Superset repository from the specified GitHub URL, switch to the newly created directory,
# and check out the desired tag or branch. This prepares the source code for further adjustments and building.
log-step "Clone, adjust Superset repository and build"
cd $HOME
git clone $SUPERSET_GITHUB_URL superset
cd superset
git checkout $TAG

# Copy custom installation files into the Superset repository:
# - superset_config_docker.py: custom configuration
# - .env-local: environment variables.
# - requirements-local.txt: additional Python dependencies
# - Dockerfile-local.dockerfile: custom Dockerfile for local builds
# - docker_compose_overrides.yml: Docker Compose overrides
# Modify the source paths as needed to match the location of your custom files.
log-step "Copying installation files to the Superset repository"
cp $HOME/custom_docker_compose_installation_files/superset_config_docker.py $HOME/superset/docker/pythonpath_dev/superset_config_docker.py
cp $HOME/custom_docker_compose_installation_files/.env-local $HOME/superset/docker/.env-local
cp $HOME/custom_docker_compose_installation_files/requirements-local.txt $HOME/superset/docker/requirements-local.txt
cp $HOME/custom_docker_compose_installation_files/Dockerfile-local.dockerfile $HOME/superset/Dockerfile-local.dockerfile
cp $HOME/custom_docker_compose_installation_files/docker_compose_overrides.yml $HOME/superset/docker_compose_overrides.yml

# Build Superset from the current git branch and run it. 
# This will create a Docker image - using the offical Dockerfile - named 'superset-local' and tag it as 'latest'.
log-step "Building the stock Superset Docker image from the current Git checkout"
cd $HOME/superset
docker build -t superset-local .
docker tag superset-local custom/superset-local:latest

# Build a custom Docker image on top of the stock image.
# This will create a Docker image named 'superset-extended' and tag it as 'latest'.
# The custom image is built using the Dockerfile-local.dockerfile file, which is a modified version of the stock Dockerfile.
# The custom image includes additional Python dependencies specified in the requirements-local.txt file.
log-step "Building custom extended Superset Docker image on top of the stock image"
docker build --build-arg UPSTREAM=custom/superset-local --build-arg TAG=latest -t superset-extended -f Dockerfile-local.dockerfile .
docker tag superset-extended custom/superset-extended:latest

# Start the Superset components using Docker Compose.
# - Uses the docker-compose-image-tag.yml and docker_compose_overrides.yml files to define services and overrides.
# - Loads environment variables from docker/.env-local.
# - Runs all services in detached mode (-d).
log-step "Starting the Superset components using docker-compose"
docker compose -f docker-compose-image-tag.yml -f docker_compose_overrides.yml --env-file docker/.env-local up -d
