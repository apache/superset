#!/bin/bash
set -e
cd "$(dirname "$0")"
npm --version
node --version
npm ci
npm run lint
npm run cover  # this also runs the tests, so no need to 'npm run test'
npm run build
