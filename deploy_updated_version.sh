#!/bin/bash

# Enable debug mode to print each command before it gets executed, allowing easier traceability
set -x
# Show current user data
echo "Current user: $(whoami)"
echo "User ID: $(id -u)"
echo "Group ID: $(id -g)"
echo "Home Directory: $HOME"
echo "Full User Information: $(id)"
echo "User's Shell: $SHELL"

# Attempt Infisical login and capture the token
echo "Logging in to Infisical..."
export INFISICAL_TOKEN=$(infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain)
if [[ -z "$INFISICAL_TOKEN" ]]; then
  echo "Error: Failed to retrieve Infisical token" >&2
  exit 1
fi
echo "Successfully retrieved Infisical token."

# Change to the application directory
cd "$DIRECTORY_PATH" || exit

# Add GitHub to known hosts to prevent host key verification errors
ssh-keyscan -H github.com >> ~/.ssh/known_hosts
   
# Add the directory to the list of safe directories
git config --global --add safe.directory $DIRECTORY_PATH 

# Authenticate Docker with Google Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Ensure git actions are successful
echo "Resetting git repository to a clean state..."
git reset --hard

echo "Pulling latest code from development branch..."
git pull origin $GIT_BRANCH || { echo "Error: Git pull failed" >&2; exit 1; }

# Stop Backend service
echo "Stopping Docker containers"
docker compose down || { echo "Error: Docker compose down failed" >&2; exit 1; }

# Remove old Docker images images
echo "Removing Docker images..."
docker system prune -a -f --volumes || { echo "Error: Docker system prune failed" >&2; exit 1; }

# Pull the latest Docker images
echo "Pulling Docker images..."
docker compose pull || { echo "Error: Docker compose pull failed" >&2; exit 1; }

# Export environment variables from Infisical to a .env file
echo "Exporting environment variables from Infisical..."
infisical export --format=dotenv --projectId="$INFISICAL_PROJECT_ID" --env=prod --path="$INFISICAL_PATH" >> ./docker/.env
if [[ $? -ne 0 ]]; then
  echo "Error: Failed to export environment variables from Infisical" >&2
  exit 1
fi

# Start the application using Docker Compose
echo "Starting the application with Docker Compose..."
docker compose up -d --force-recreate --pull always || { echo "Error: Docker compose up failed" >&2; exit 1; }

# Disable debug mode
set +x

echo "Script completed successfully."
