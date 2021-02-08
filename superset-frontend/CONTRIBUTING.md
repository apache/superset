## Contributing guidelines

### Setup local development

1. clone this repo
2. have `yarn` install package dependencies and manage the symlinking between packages for you

```sh
git clone ...superset-ui && cd superset-ui
yarn install
yarn build
```

To build only selected packages or plugins,

```bash
yarn build "*chart-table"
```

### File organization

[lerna](https://github.com/lerna/lerna/) and [yarn](https://yarnpkg.com) are used to manage versions
and dependencies between packages in this monorepo.

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
across all packages using the syntax `yarn run test` (or `yarn run test:watch` for watch mode) from
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

**Prerequisite:** You'll need an [npmjs.com](https://npmjs.com) account that is part of the
`superset-ui` organization.

1. Make sure you're logged in to NPM from your shell. Run `npm login` if necessary.
2. To make the release, run `yarn run release` and follow the prompts.
