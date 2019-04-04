#!/bin/bash

# Validate arguments
versionBumpType=${1:-patch};

if [ "$versionBumpType" != "major" ] && [ "$versionBumpType" != "minor" ] && [ "$versionBumpType" != "patch" ]; then
  echo "Invalid version bump argument: ${versionBumpType}. Option must be one of the following: major, minor, patch"
  exit 1
else
  echo "Publishing and bumping with ${versionBumpType} version bump"
fi

echo "Running version bump + publish script..."
echo "."
echo "."
echo "Generating /dist and push changes + tags to Github remote 'origin'"
# Checkout master branch
git checkout master
# Version bump
grunt bump-only:"$versionBumpType"
# Generate new dist
grunt prod
# Generate new index.html page
grunt template
# Force add dist contents
git add dist/* --force
# Commit new release tag
grunt bump-commit
# Push commits/tags to master branch on remote 'origin'
git push origin master:master && git push --tags

## Update Github.io page
sh ./scripts/update-gh-pages.sh

## Publish to NPM
echo "."
echo "."
echo "Publishing to NPM"
echo "."
echo "."
npm publish

# Notify script is complete
echo "."
echo "."
echo "Script complete"
echo ""