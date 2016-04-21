#!/usr/bin/env bash
rm -rf _build
make html
<<<<<<< a5f33fecd81ce1c86859856bdc1a3a4f73b7893c
#cp -r ../caravel/assets/images/ _build/html/_static/img/
cp -r ../caravel/assets/images/ _static/img/
rm -rf /tmp/caravel-docs
cp -r _build/html /tmp/caravel-docs
=======
>>>>>>> [panoramix] -> [dashed]
