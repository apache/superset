#!/bin/bash
cd /app/superset-frontend
npm install -f --no-optional --global webpack webpack-cli
npm install -f --no-optional

if [[ "${ENABLE_WEBPACK_DEV_SERVER}" == 'yes' ]]; then
    echo "Running dev-server"
    npm run dev-server
fi
else 
    echo "Running dev"
    npm run dev
fi
