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

EOF

  /bin/sh -c '/usr/local/bin/fabmanager create-admin --app superset < $HOME/incubator-superset/admin.config'

  rm $HOME/incubator-superset/admin.config

  echo "Initializing database"
  superset db upgrade

  echo "Creating default roles and permissions"
  superset init

  cd superset/assets && npm run build && cd ../../

  echo $HOME;

  touch $HOME/incubator-superset/.setup-complete
else
  # always upgrade the database, running any pending migrations
  superset db upgrade
fi

# To start a development web server, use the -d switch
superset runserver -d
