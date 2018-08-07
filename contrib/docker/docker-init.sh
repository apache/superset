#!/usr/bin/env bash

set -ex

# set up Superset if we haven't already
if [ ! -f $HOME/incubator-superset/.setup-complete ]; then
  echo "Running first time setup for Superset"

  echo "Creating admin user ${ADMIN_USERNAME}"
  cat > $HOME/incubator-superset/admin.config <<EOF
${ADMIN_USERNAME}
${ADMIN_FIRST_NAME}
${ADMIN_LAST_NAME}
${ADMIN_EMAIL}
${ADMIN_PWD}
${ADMIN_PWD}

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # Load some data to play with
    superset load_examples
fi

# Create default roles and permissions
superset init
