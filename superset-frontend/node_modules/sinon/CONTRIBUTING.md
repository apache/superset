# Contributing to Sinon.JS

There are several ways of contributing to Sinon.JS

* Look into [issues tagged `help-wanted`](https://github.com/sinonjs/sinon/issues?q=is%3Aopen+is%3Aissue+label%3A%22Help+wanted%22)
* Help [improve the documentation](https://github.com/sinonjs/sinon/tree/master/docs) published
  at [the Sinon.JS website](https://sinonjs.org). [Documentation issues](https://github.com/sinonjs/sinon/issues?q=is%3Aopen+is%3Aissue+label%3ADocumentation).
* Help someone understand and use Sinon.JS on [Stack Overflow](https://stackoverflow.com/questions/tagged/sinon)
* Report an issue, please read instructions below
* Help with triaging the [issues](https://github.com/sinonjs/sinon/issues). The clearer they are, the more likely they are to be fixed soon.
* Contribute to the code base.

## Contributor Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Reporting an issue

To save everyone time and make it much more likely for your issue to be understood, worked on and resolved quickly, it would help if you're mindful of [How to Report Bugs Effectively](http://www.chiark.greenend.org.uk/~sgtatham/bugs.html) when pressing the "Submit new issue" button.

As a minimum, please report the following:

* Which environment are you using? Browser? Node? Which version(s)?
* Which version of SinonJS?
* How are you loading SinonJS?
* What other libraries are you using?
* What you expected to happen
* What actually happens
* Describe **with code** how to reproduce the faulty behaviour

See [our issue template](https://github.com/sinonjs/sinon/blob/master/.github/) for all details.

## Contributing to the code base

Pick [an issue](https://github.com/sinonjs/sinon/issues) to fix, or pitch
new features. To avoid wasting your time, please ask for feedback on feature
suggestions with [an issue](https://github.com/sinonjs/sinon/issues/new).

Make sure you have read [GitHub's guide on forking](https://guides.github.com/activities/forking/). It explains the general contribution process and key concepts.

### Making a pull request

Please try to [write great commit messages](http://chris.beams.io/posts/git-commit/).

There are numerous benefits to great commit messages

* They allow Sinon.JS users to understand the consequences of updating to a newer version
* They help contributors understand what is going on with the codebase, allowing features and fixes to be developed faster
* They save maintainers time when compiling the changelog for a new release

If you're already a few commits in by the time you read this, you can still [change your commit messages](https://help.github.com/articles/changing-a-commit-message/).

Also, before making your pull request, consider if your commits make sense on their own (and potentially should be multiple pull requests) or if they can be squashed down to one commit (with a great message). There are no hard and fast rules about this, but being mindful of your readers greatly help you author good commits.

### Use EditorConfig

To save everyone some time, please use [EditorConfig](http://editorconfig.org), so your editor helps make
sure we all use the same encoding, indentation, line endings, etc.

### Installation

The Sinon.JS developer environment requires Node/NPM. Please make sure you have
Node installed, and install Sinon's dependencies:

    $ npm install

This will also install a pre-commit hook, that runs style validation on staged files.


### Compatibility

For details on compatibility and browser support, please see [`COMPATIBILITY.md`](COMPATIBILITY.md)

### Linting and style

Sinon.JS uses [ESLint](http://eslint.org) to keep the codebase free of lint, and uses [Prettier](https://prettier.io) to keep consistent style.

If you are contributing to a Sinon project, you'll probably want to configure your editors ([ESLint](https://eslint.org/docs/user-guide/integrations#editors), [Prettier](https://prettier.io/docs/en/editors.html)) to make editing code a more enjoyable experience.

The ESLint verification (which includes Prettier) will be run before unit tests in the CI environment. The build will fail if the source code does not pass the style check.


You can run the linter locally:

```
$ npm run lint
```

You can fix a lot lint and style violations automatically:

```
$ npm run lint -- --fix
```

To ensure consistent reporting of lint warnings, you should use the same versions of ESLint and Prettier as defined in `package.json` (which is what the CI servers use).

### Run the tests

Following command runs unit tests in PhantomJS, Node and WebWorker

    $ npm test

##### Testing in development

Sinon.JS uses [Mocha](https://mochajs.org/), please read those docs if you're unfamiliar with it.

If you're doing more than a one line edit, you'll want to have finer control and less restarting of the Mocha

To start tests in dev mode run

    $ npm run test-dev

Dev mode features:
 * [watching related files](https://mochajs.org/#w---watch) to restart tests once changes are made
 * using [Min reporter](https://mochajs.org/#min), which cleans the console each time tests run, so test results are always on top

Note that in dev mode tests run only in Node. Before creating your PR please ensure tests are passing in Phantom and WebWorker as well. To check this please use [Run the tests](#run-the-tests) instructions.

### Compiling a built version

Build requires Node. Under the hood [Browserify](http://browserify.org/) is used.

To build run

    $ node build.js


