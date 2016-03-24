#!/usr/bin/env bash
rm -rf _build
make html
cp -r ../dashed/assets/images/ _build/html/_static/img/
rm -rf /tmp/dashed-docs
cp -r _build/html /tmp/dashed-docs
