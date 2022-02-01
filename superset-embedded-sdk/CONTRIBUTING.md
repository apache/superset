# Contributing to the Superset Embedded SDK

The superset-embedded-sdk directory is a self contained sub-project in the Superset codebase.

This is because the SDK has different requirements from other parts of the Superset codebase:
Namely, we need to export a lightweight frontend library that can be used in as many environments as possible.
Having separate configs allows for better separation of concerns and allows the SDK code to remain simple.

## Building

The library is built in two modes: one for consumption by package managers
and subsequent build systems, and one for consumption directly by a web browser.

Babel is used to build the sdk into a relatively modern js package in the `lib` directory.
This is used by consumers who install the embedded sdk via npm, yarn, or other package manager.

Webpack is used to bundle the `bundle` directory,
for use directly in the browser with no build step e.g. when importing via unpkg.

Typescript outputs type definition files to the `dist` directory.

Which of these outputs is used by the library consumer is determined by our package.json's `main`, `module`, and `types` fields.

## Testing

You may notice a lack of tests in this directory. The functions used in the sdk so far are very closely tied to browser behavior,
and are not easily testable. We have instead opted to test the sdk behavior using end-to-end tests.
This way, the tests can assert that the sdk actually mounts the iframe and communicates with it correctly.

At time of writing, these tests are not written yet, because we haven't yet put together the demo app that they will leverage.

## Publishing

To publish a new version, first determine whether it will be a major/minor/patch version according to [semver rules](https://semver.org/).
Run `npm version [major|minor|patch]`, and commit the resulting version change.

Building the package and publishing to npm will be handled by github actions automatically on merge to master.
At least, in theory. It hasn't been implemented yet as I type this.
