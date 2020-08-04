# Testing

Testing public exports can be done using the bundle, as the example d3-plugin
does, but this does not let you test internal functions.

[reify](https://github.com/benjamn/reify) lets you use ES6 modules in nodejs.

Run the tests using `npm test`.

# Releasing a new version

Check the tests run!

Bump the version with `npm version {major | minor | patch}` as appropriate.

Edit the changelog in the README.md to move the "unpublished" items into a new
section, and amend the version commit.

Publish the new version to npm with `npm publish`.
