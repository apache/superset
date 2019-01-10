# requires github-changes, run
# `npm install -g github-changes`
# requires $GITHUB_TOKEN to be set

# usage:  ./github-changes 0.20.0 0.20.1
# will overwrites the local CHANGELOG.md, somehow you need to merge it in
github-changes -o apache -r incubator-superset --token $GITHUB_TOKEN --between-tags $1...$2
