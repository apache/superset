#!/bin/bash
set -e
cd "$(dirname "$0")"
npm --version
node --version
time npm ci
time npm run lint
time npm run cover  # this also runs the tests, so no need to 'npm run test'
time npm run build
