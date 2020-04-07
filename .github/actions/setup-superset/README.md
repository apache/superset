# Setup Superset in GitHub Actions

A [Github Action](https://help.github.com/en/actions) with a couple of short hands
for setting up Superset in GitHub CI workflows.

Mostly for reducing redundant code between workflows.

After making edits to `/src`, make sure to run `npm run package` and
commit `dist/index.js` to Git.
