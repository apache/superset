#!/usr/bin/env bash

# fail on error
set -e

# install babel7 deps
yarn add -D babel-cli@^7.0.0-beta.3 babel-core@^7.0.0-beta.3 babel-register@^7.0.0-beta.3 babel-preset-env@^7.0.0-beta.3 @babel/core babel-plugin-transform-object-rest-spread@^7.0.0-beta.3 gulp-babel@7.0.0
