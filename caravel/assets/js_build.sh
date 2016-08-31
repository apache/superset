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
./node_modules/.bin/codeclimate-test-reporter < ./coverage/lcov.info
