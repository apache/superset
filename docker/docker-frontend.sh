#!/bin/bash
cd /app/superset-frontend
npm install -f --no-optional --global webpack webpack-cli
npm install -f --no-optional

echo "Running frontend"
npm run dev
