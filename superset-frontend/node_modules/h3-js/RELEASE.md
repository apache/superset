# Release Process

Please note the [versioning guidelines](./README.md#versioning).

1. Create a PR "Preparing for release X.Y.Z" against master branch
    * Update `package.json` version to `X.Y.Z`
    * Alter CHANGELOG.md from `[Unreleased]` to `[X.Y.Z] YYYY-MM-DD`

2. Create a release "Release X.Y.Z" on Github
    * Create Tag `vX.Y.Z`
    * Copy CHANGELOG.md into the release notes

3. Publish to NPM
    * `npm publish`
