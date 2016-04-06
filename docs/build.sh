#!/usr/bin/env bash
rm -rf _build
make html
<<<<<<< HEAD
=======
#cp -r ../caravel/assets/images/ _build/html/_static/img/
cp -r ../caravel/assets/images/ _static/img/
rm -rf /tmp/caravel-docs
cp -r _build/html /tmp/caravel-docs
>>>>>>> c2baa53b060cda4352582d238f53369e3f7773d0
