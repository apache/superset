#!/usr/bin/env bash
rm -r _build
make html
cp -r _build/html/ ../../panoramix-docs/
