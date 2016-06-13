#!/bin/bash
cd "$(dirname "$0")"
npm --version
npm install
npm run lint
npm run prod
