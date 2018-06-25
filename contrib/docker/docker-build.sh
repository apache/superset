#!/usr/bin/env bash

set -ex

docker build -t apache/incubator-superset -f Dockerfile .
