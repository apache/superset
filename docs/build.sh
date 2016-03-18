#!/usr/bin/env bash
rm -r _build
make html
cp -r ../dashed/assets/images/ _build/html/_static/img/
