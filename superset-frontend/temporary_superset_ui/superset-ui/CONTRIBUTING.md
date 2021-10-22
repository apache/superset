## Contributing guidelines

### Setup local development

1. clone this repo
2. have `npm` install package dependencies and manage the symlinking between packages for you

```sh
git clone ...superset-ui && cd superset-ui
npm ci
npm build
```

To build only selected packages or plugins,

```bash
npm build "*chart-table"
```

### File organization

[lerna](https://github.com/lerna/lerna/) and [npm](https://www.npmjs.com/) are used to manage
versions and dependencies between packages in this monorepo.

```
superset-ui/
  lerna.json
  package.json
  ...
  packages/
    package1/
      package.json
      ...
      src/
      test/  # unit tests
      types/ # typescript type declarations
      ...
      lib/   # commonjs output
      esm/   # es module output
      ...
    ...
```

### Builds, linting, and testing

Each package defines its own build config, linting, and testing. You can have lerna run commands
across all packages using the syntax `npm run test` (or `npm run test:watch` for watch mode) from
the root `@superset-ui` directory.

- [Using Storybook](docs/storybook.md) - You can test your components independently from Superset
  app.
- [Debugging Superset plugins in Superset app](docs/debugging.md) - Sometimes something went wrong
  and you have to do it.

### Committing

This repository follows
[conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/) guideline for commit
messages and has a `commitlint` hook which will require you to have the valid commit message before
committing. You can use `npm run commit` to help you create a commit message.

### Publishing

**Prerequisite:** You'll need to be a committer on the `apache-superset` organization to be able to
publish new versions of `superset-ui`.

1. Checkout the `master` branch from the main repo at `apache-superset/superset-ui` - NOT A FORK!
2. run `npm run ci:create-patch-version` to bump the patch version (the most common case) or
   `npm run ci:create-minor-version` to bump the minor version. Once the process finishes and the
   commit has been pushed to GitHub, CI will complete publishing the release to npm (takes some time
   to complete).
