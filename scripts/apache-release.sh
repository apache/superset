#!/usr/bin/env bash
set -e

export VERSION=0.31.0rc18

git tag -f ${VERSION}
#git clean -fxd
git archive --format=tar.gz ${VERSION} --prefix=apache-superset-${VERSION}/ -o apache-superset-${VERSION}-source.tar.gz
scripts/sign.sh apache-superset-${VERSION}-source.tar.gz
