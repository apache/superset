#!/usr/bin/env bash
rm -rf _build
make html
#cp -r ../superset/assets/images/ _build/html/_static/img/
cp -r ../superset/assets/images/ _static/img/
rm -rf /tmp/superset-docs
cp -r _build/html /tmp/superset-docs
