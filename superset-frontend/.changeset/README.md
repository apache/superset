# Changesets

This folder is used by [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for the Superset frontend packages.

## How to add a changeset

When you make changes to packages that should be published, run:

```bash
npx changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the semver bump type (major/minor/patch)
3. Write a summary of the changes

A markdown file will be created in this folder describing your changes.

## Releasing

To create a new release:

```bash
# 1. Update versions and changelogs based on changesets
npm run changeset:version

# 2. Build all packages
npm run turbo:build

# 3. Publish to npm
npm run changeset:publish
```

## More information

- [Changesets documentation](https://github.com/changesets/changesets)
- [Using Changesets with Turborepo](https://turbo.build/repo/docs/handbook/publishing-packages/versioning-and-publishing)
