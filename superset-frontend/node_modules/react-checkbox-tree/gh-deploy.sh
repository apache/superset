#!/bin/bash
VERSION="$(cat ./package.json | python -c "import sys, json; print(json.load(sys.stdin)['version'])")"
git diff --exit-code

if [[ $? == 0 ]]
then
    sed -i '\:/examples/dist:d' ./.gitignore
    git add .
    git commit -m "Publish v${VERSION} examples"
    git push origin `git subtree split --prefix examples/dist master`:gh-pages --force
    git reset HEAD~
    git checkout .gitignore
else
    echo "Need clean working directory to publish"
fi
