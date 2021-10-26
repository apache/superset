#!/bin/bash

lernaVersionArg="$1"
if [[ -z $lernaVersionArg ]]; then
  echo 'Please provide argument for "lerna version".'
  exit 1
fi

# Ignore Lerna's tag and push
lerna version $1 --no-push --no-git-tag-version --yes

if [[ -z $(git diff --stat) ]]; then
  echo 'No changed packages to version.'
  exit 1
fi

# Get the current tag version
tag=v$(node -e "process.stdout.write(require('./lerna.json').version)");
message="chore: publish $tag"

# Update the lock file here
npm i --package-lock-only

# Auto-tag and auto-commit like usual
git commit --all -m ${message}
git tag -a ${tag} -m ${tag}
git push origin ${tag}
git push
