#!/usr/bin/env bash
rm -rf _build
make html
cp -r ../dashed/assets/images/ _build/html/_static/img/
