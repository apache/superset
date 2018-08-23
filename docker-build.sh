#!/usr/bin/env bash

set -ex
START=$(date +%s)
docker build -t guavus-superset -f Dockerfile .
END=$(date +%s)
DIFF=$(( $END - $START ))
echo "Build completed in $DIFF seconds"
