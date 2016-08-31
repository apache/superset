#!/bin/bash
set -e
cd "$(dirname "$0")"
npm --version
node --version
npm install
npm run lint
npm run test
npm run prod
npm run cover
CODECLIMATE_REPO_TOKEN=5f3a06c425eef7be4b43627d7d07a3e46c45bdc07155217825ff7c49cb6a470c ./node_modules/.bin/codeclimate-test-reporter < ./coverage/lcov.info
