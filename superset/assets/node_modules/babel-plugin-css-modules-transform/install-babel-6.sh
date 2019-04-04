#!/usr/bin/env bash

# fail on error
set -e

# remove babel core
yarn remove @babel/core

# install babel6
yarn add -D babel-cli@^6.26.0 babel-core@^6.26.0 babel-plugin-transform-object-rest-spread@^6.26.0 babel-preset-env@^1.6.1 babel-register@^6.26.0
