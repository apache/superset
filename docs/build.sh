#!/usr/bin/env bash
rm -rf _build
make html
#cp -r ../caravel/assets/images/ _build/html/_static/img/
cp -r ../caravel/assets/images/ _static/img/
rm -rf /tmp/caravel-docs
cp -r _build/html /tmp/caravel-docs
