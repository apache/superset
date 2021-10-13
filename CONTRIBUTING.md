<!--
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
-->

# Contributing

Contributions are welcome and are greatly appreciated! Every
little bit helps, and credit will always be given.

## Table of Contents

- [Contributing](#contributing)
  - [Table of Contents](#table-of-contents)
  - [Orientation](#orientation)
  - [Types of Contributions](#types-of-contributions)
    - [Report Bug](#report-bug)
    - [Submit Ideas or Feature Requests](#submit-ideas-or-feature-requests)
    - [Fix Bugs](#fix-bugs)
    - [Implement Features](#implement-features)
    - [Improve Documentation](#improve-documentation)
    - [Add Translations](#add-translations)
    - [Ask Questions](#ask-questions)
  - [Pull Request Guidelines](#pull-request-guidelines)
    - [Protocol](#protocol)
      - [Authoring](#authoring)
      - [Reviewing](#reviewing)
      - [Test Environments](#test-environments)
      - [Merging](#merging)
      - [Post-merge Responsibility](#post-merge-responsibility)
  - [Design Guidelines](#design-guidelines)
    - [Capitalization guidelines](#capitalization-guidelines)
      - [Sentence case](#sentence-case)
      - [How to refer to UI elements](#how-to-refer-to-ui-elements)
      - [\*\*Exceptions to sentence case:](#exceptions-to-sentence-case)
  - [Managing Issues and PRs](#managing-issues-and-prs)
  - [Reporting a Security Vulnerability](#reporting-a-security-vulnerability)
  - [Revert Guidelines](#revert-guidelines)
  - [Setup Local Environment for Development](#setup-local-environment-for-development)
    - [Documentation](#documentation)
      - [Images](#images)
    - [Flask server](#flask-server)
      - [OS Dependencies](#os-dependencies)
      - [Logging to the browser console](#logging-to-the-browser-console)
    - [Frontend](#frontend)
      - [Prerequisite](#prerequisite)
        - [nvm and node](#nvm-and-node)
      - [Install dependencies](#install-dependencies)
      - [Build assets](#build-assets)
      - [Webpack dev server](#webpack-dev-server)
      - [Other npm commands](#other-npm-commands)
      - [Docker (docker-compose)](#docker-docker-compose)
      - [Updating NPM packages](#updating-npm-packages)
      - [Feature flags](#feature-flags)
  - [Git Hooks](#git-hooks)
  - [Linting](#linting)
  - [Conventions](#conventions)
    - [Python](#python)
  - [Typing](#typing)
    - [Python](#python-1)
    - [TypeScript](#typescript)
  - [Testing](#testing)
    - [Python Testing](#python-testing)
    - [Frontend Testing](#frontend-testing)
    - [Integration Testing](#integration-testing)
    - [Debugging Server App](#debugging-server-app)
    - [Debugging Server App in Kubernetes Environment](#debugging-server-app-in-kubernetes-environment)
    - [Storybook](#storybook)
  - [Translating](#translating)
    - [Enabling language selection](#enabling-language-selection)
    - [Extracting new strings for translation](#extracting-new-strings-for-translation)
    - [Updating language files](#updating-language-files)
    - [Creating a new language dictionary](#creating-a-new-language-dictionary)
  - [Tips](#tips)
    - [Adding a new datasource](#adding-a-new-datasource)
    - [Improving visualizations](#improving-visualizations)
    - [Visualization Plugins](#visualization-plugins)
    - [Adding a DB migration](#adding-a-db-migration)
    - [Merging DB migrations](#merging-db-migrations)
    - [SQL Lab Async](#sql-lab-async)
    - [Async Chart Queries](#async-chart-queries)
  - [Chart Parameters](#chart-parameters)
    - [Datasource & Chart Type](#datasource--chart-type)
    - [Time](#time)
    - [GROUP BY](#group-by)
    - [NOT GROUPED BY](#not-grouped-by)
    - [Y Axis 1](#y-axis-1)
    - [Y Axis 2](#y-axis-2)
    - [Query](#query)
    - [Chart Options](#chart-options)
    - [Y Axis](#y-axis)
    - [Other](#other)
    - [Unclassified](#unclassified)

## Orientation

Here's a list of repositories that contain Superset-related packages:

- [apache/superset](https://github.com/apache/superset)
  is the main repository containing the `apache-superset` Python package
  distributed on
  [pypi](https://pypi.org/project/apache-superset/). This repository
  also includes Superset's main TypeScript/JavaScript bundles and react apps under
  the [superset-frontend](https://github.com/apache/superset/tree/master/superset-frontend)
  folder.
- [apache-superset/superset-ui](https://github.com/apache-superset/superset-ui)
  contains core Superset's
  [npm packages](https://github.com/apache-superset/superset-ui/tree/master/packages).
  These packages are shared across the React apps in the main repository,
  and in visualization plugins.
- [apache-superset/superset-ui-plugins](https://github.com/apache-superset/superset-ui-plugins)
  contains the code for the default visualizations that ship with Superset
  and are maintained by the core community.
- [apache-superset/superset-ui-plugins-deckgl](https://github.com/apache-superset/superset-ui-plugins-deckgl)
  contains the code for the geospatial visualizations that ship with Superset
  and are maintained by the core community.
- [github.com/apache-superset](https://github.com/apache-superset) is the
  Github organization under which we manage Superset-related
  small tools, forks and Superset-related experimental ideas.

## Types of Contributions

### Report Bug

The best way to report a bug is to file an issue on GitHub. Please include:

- Your operating system name and version.
- Superset version.
- Detailed steps to reproduce the bug.
- Any details about your local setup that might be helpful in troubleshooting.

When posting Python stack traces, please quote them using
[Markdown blocks](https://help.github.com/articles/creating-and-highlighting-code-blocks/).

### Submit Ideas or Feature Requests

The best way is to file an issue on GitHub:

- Explain in detail how it would work.
- Keep the scope as narrow as possible, to make it easier to implement.
- Remember that this is a volunteer-driven project, and that contributions are welcome :)

For large features or major changes to codebase, please create **Superset Improvement Proposal (SIP)**. See template from [SIP-0](https://github.com/apache/superset/issues/5602)

### Fix Bugs

Look through the GitHub issues. Issues tagged with `#bug` are
open to whoever wants to implement them.

### Implement Features

Look through the GitHub issues. Issues tagged with
`#feature` is open to whoever wants to implement it.

### Improve Documentation

Superset could always use better documentation,
whether as part of the official Superset docs,
in docstrings, `docs/*.rst` or even on the web as blog posts or
articles. See [Documentation](#documentation) for more details.

### Add Translations

If you are proficient in a non-English language, you can help translate
text strings from Superset's UI. You can jump in to the existing
language dictionaries at
`superset/translations/<language_code>/LC_MESSAGES/messages.po`, or
even create a dictionary for a new language altogether.
See [Translating](#translating) for more details.

### Ask Questions

There is a dedicated [`apache-superset` tag](https://stackoverflow.com/questions/tagged/apache-superset) on [StackOverflow](https://stackoverflow.com/). Please use it when asking questions.

## Pull Request Guidelines

A philosophy we would like to strongly encourage is

> Before creating a PR, create an issue.

The purpose is to separate problem from possible solutions.

**Bug fixes:** If you’re only fixing a small bug, it’s fine to submit a pull request right away but we highly recommend to file an issue detailing what you’re fixing. This is helpful in case we don’t accept that specific fix but want to keep track of the issue. Please keep in mind that the project maintainers reserve the rights to accept or reject incoming PRs, so it is better to separate the issue and the code to fix it from each other. In some cases, project maintainers may request you to create a separate issue from PR before proceeding.

**Refactor:** For small refactors, it can be a standalone PR itself detailing what you are refactoring and why. If there are concerns, project maintainers may request you to create a `#SIP` for the PR before proceeding.

**Feature/Large changes:** If you intend to change the public API, or make any non-trivial changes to the implementation, we require you to file a new issue as `#SIP` (Superset Improvement Proposal). This lets us reach an agreement on your proposal before you put significant effort into it. You are welcome to submit a PR along with the SIP (sometimes necessary for demonstration), but we will not review/merge the code until the SIP is approved.

In general, small PRs are always easier to review than large PRs. The best practice is to break your work into smaller independent PRs and refer to the same issue. This will greatly reduce turnaround time.

If you wish to share your work which is not ready to merge yet, create a [Draft PR](https://github.blog/2019-02-14-introducing-draft-pull-requests/). This will enable maintainers and the CI runner to prioritize mature PR's.

Finally, never submit a PR that will put master branch in broken state. If the PR is part of multiple PRs to complete a large feature and cannot work on its own, you can create a feature branch and merge all related PRs into the feature branch before creating a PR from feature branch to master.

### Protocol

#### Authoring

- Fill in all sections of the PR template.
- Title the PR with one of the following semantic prefixes (inspired by [Karma](http://karma-runner.github.io/0.10/dev/git-commit-msg.html])):

  - `feat` (new feature)
  - `fix` (bug fix)
  - `docs` (changes to the documentation)
  - `style` (formatting, missing semi colons, etc; no application logic change)
  - `refactor` (refactoring code)
  - `test` (adding missing tests, refactoring tests; no application logic change)
  - `chore` (updating tasks etc; no application logic change)
  - `perf` (performance-related change)
  - `build` (build tooling, Docker configuration change)
  - `ci` (test runner, Github Actions workflow changes)
  - `other` (changes that don't correspond to the above -- should be rare!)
  - Examples:
    - `feat: export charts as ZIP files`
    - `perf(api): improve API info performance`
    - `fix(chart-api): cached-indicator always shows value is cached`

- Add prefix `[WIP]` to title if not ready for review (WIP = work-in-progress). We recommend creating a PR with `[WIP]` first and remove it once you have passed CI test and read through your code changes at least once.
- If you believe your PR contributes a potentially breaking change, put a `!` after the semantic prefix but before the colon in the PR title, like so: `feat!: Added foo functionality to bar`
- **Screenshots/GIFs:** Changes to user interface require before/after screenshots, or GIF for interactions
  - Recommended capture tools ([Kap](https://getkap.co/), [LICEcap](https://www.cockos.com/licecap/), [Skitch](https://download.cnet.com/Skitch/3000-13455_4-189876.html))
  - If no screenshot is provided, the committers will mark the PR with `need:screenshot` label and will not review until screenshot is provided.
- **Dependencies:** Be careful about adding new dependency and avoid unnecessary dependencies.
  - For Python, include it in `setup.py` denoting any specific restrictions and in `requirements.txt` pinned to a specific version which ensures that the application build is deterministic.
  - For TypeScript/JavaScript, include new libraries in `package.json`
- **Tests:** The pull request should include tests, either as doctests, unit tests, or both. Make sure to resolve all errors and test failures. See [Testing](#testing) for how to run tests.
- **Documentation:** If the pull request adds functionality, the docs should be updated as part of the same PR.
- **CI:** Reviewers will not review the code until all CI tests are passed. Sometimes there can be flaky tests. You can close and open PR to re-run CI test. Please report if the issue persists. After the CI fix has been deployed to `master`, please rebase your PR.
- **Code coverage:** Please ensure that code coverage does not decrease.
- Remove `[WIP]` when ready for review. Please note that it may be merged soon after approved so please make sure the PR is ready to merge and do not expect more time for post-approval edits.
- If the PR was not ready for review and inactive for > 30 days, we will close it due to inactivity. The author is welcome to re-open and update.

#### Reviewing

- Use constructive tone when writing reviews.
- If there are changes required, state clearly what needs to be done before the PR can be approved.
- If you are asked to update your pull request with some changes there's no need to create a new one. Push your changes to the same branch.
- The committers reserve the right to reject any PR and in some cases may request the author to file an issue.

#### Test Environments

- Members of the Apache GitHub org can launch an ephemeral test environment directly on a pull request by creating a comment containing (only) the command `/testenv up`.
  - Note that org membership must be public in order for this validation to function properly.
- Feature flags may be set for a test environment by specifying the flag name (prefixed with `FEATURE_`) and value after the command.
  - Format: `/testenv up FEATURE_<feature flag name>=true|false`
  - Example: `/testenv up FEATURE_DASHBOARD_NATIVE_FILTERS=true`
  - Multiple feature flags may be set in single command, separated by whitespace
- A comment will be created by the workflow script with the address and login information for the ephemeral environment.
- Test environments may be created once the Docker build CI workflow for the PR has completed successfully.
- Test environments do not currently update automatically when new commits are added to a pull request.
- Test environments do not currently support async workers, though this is planned.
- Running test environments will be shutdown upon closing the pull request.

#### Merging

- At least one approval is required for merging a PR.
- PR is usually left open for at least 24 hours before merging.
- After the PR is merged, [close the corresponding issue(s)](https://help.github.com/articles/closing-issues-using-keywords/).

#### Post-merge Responsibility

- Project maintainers may contact the PR author if new issues are introduced by the PR.
- Project maintainers may revert your changes if a critical issue is found, such as breaking master branch CI.

## Design Guidelines

### Capitalization guidelines

#### Sentence case

Use sentence-case capitalization for everything in the UI (except these \*\*).

Sentence case is predominantly lowercase. Capitalize only the initial character of the first word, and other words that require capitalization, like:

- **Proper nouns.** Objects in the product _are not_ considered proper nouns e.g. dashboards, charts, saved queries etc. Proprietary feature names eg. SQL Lab, Preset Manager _are_ considered proper nouns
- **Acronyms** (e.g. CSS, HTML)
- When referring to **UI labels that are themselves capitalized** from sentence case (e.g. page titles - Dashboards page, Charts page, Saved queries page, etc.)
- User input that is reflected in the UI. E.g. a user-named a dashboard tab

**Sentence case vs. Title case:**
Title case: "A Dog Takes a Walk in Paris"
Sentence case: "A dog takes a walk in Paris"

**Why sentence case?**

- It’s generally accepted as the quickest to read
- It’s the easiest form to distinguish between common and proper nouns

#### How to refer to UI elements

When writing about a UI element, use the same capitalization as used in the UI.

For example, if an input field is labeled “Name” then you refer to this as the “Name input field”. Similarly, if a button has the label “Save” in it, then it is correct to refer to the “Save button”.

Where a product page is titled “Settings”, you refer to this in writing as follows:
“Edit your personal information on the Settings page”.

Often a product page will have the same title as the objects it contains. In this case, refer to the page as it appears in the UI, and the objects as common nouns:

- Upload a dashboard on the Dashboards page
- Go to Dashboards
- View dashboard
- View all dashboards
- Upload CSS templates on the CSS templates page
- Queries that you save will appear on the Saved queries page
- Create custom queries in SQL Lab then create dashboards

#### \*\*Exceptions to sentence case:

- Input labels, buttons and UI tabs are all caps
- User input values (e.g. column names, SQL Lab tab names) should be in their original case

## Managing Issues and PRs

To handle issues and PRs that are coming in, committers read issues/PRs and flag them with labels to categorize and help contributors spot where to take actions, as contributors usually have different expertises.

Triaging goals

- **For issues:** Categorize, screen issues, flag required actions from authors.
- **For PRs:** Categorize, flag required actions from authors. If PR is ready for review, flag required actions from reviewers.

First, add **Category labels (a.k.a. hash labels)**. Every issue/PR must have one hash label (except spam entry). Labels that begin with `#` defines issue/PR type:

| Label           | for Issue                                                                                                                               | for PR                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#bug`          | Bug report                                                                                                                              | Bug fix                                                                                                                                           |
| `#code-quality` | Describe problem with code, architecture or productivity                                                                                | Refactor, tests, tooling                                                                                                                          |
| `#feature`      | New feature request                                                                                                                     | New feature implementation                                                                                                                        |
| `#refine`       | Propose improvement that does not provide new features and is also not a bug fix nor refactor, such as adjust padding, refine UI style. | Implementation of improvement that does not provide new features and is also not a bug fix nor refactor, such as adjust padding, refine UI style. |
| `#doc`          | Documentation                                                                                                                           | Documentation                                                                                                                                     |
| `#question`     | Troubleshooting: Installation, Running locally, Ask how to do something. Can be changed to `#bug` later.                                | N/A                                                                                                                                               |
| `#SIP`          | Superset Improvement Proposal                                                                                                           | N/A                                                                                                                                               |
| `#ASF`          | Tasks related to Apache Software Foundation policy                                                                                      | Tasks related to Apache Software Foundation policy                                                                                                |

Then add other types of labels as appropriate.

- **Descriptive labels (a.k.a. dot labels):** These labels that begin with `.` describe the details of the issue/PR, such as `.ui`, `.js`, `.install`, `.backend`, etc. Each issue/PR can have zero or more dot labels.
- **Need labels:** These labels have pattern `need:xxx`, which describe the work required to progress, such as `need:rebase`, `need:update`, `need:screenshot`.
- **Risk labels:** These labels have pattern `risk:xxx`, which describe the potential risk on adopting the work, such as `risk:db-migration`. The intention was to better understand the impact and create awareness for PRs that need more rigorous testing.
- **Status labels:** These labels describe the status (`abandoned`, `wontfix`, `cant-reproduce`, etc.) Issue/PRs that are rejected or closed without completion should have one or more status labels.
- **Version labels:** These have the pattern `vx.x` such as `v0.28`. Version labels on issues describe the version the bug was reported on. Version labels on PR describe the first release that will include the PR.

Committers may also update title to reflect the issue/PR content if the author-provided title is not descriptive enough.

If the PR passes CI tests and does not have any `need:` labels, it is ready for review, add label `review` and/or `design-review`.

If an issue/PR has been inactive for >=30 days, it will be closed. If it does not have any status label, add `inactive`.

When creating a PR, if you're aiming to have it included in a specific release, please tag it with the version label. For example, to have a PR considered for inclusion in Superset 1.1 use the label `v1.1`.

## Reporting a Security Vulnerability

Please report security vulnerabilities to private@superset.apache.org.

In the event a community member discovers a security flaw in Superset, it is important to follow the [Apache Security Guidelines](https://www.apache.org/security/committers.html) and release a fix as quickly as possible before public disclosure. Reporting security vulnerabilities through the usual GitHub Issues channel is not ideal as it will publicize the flaw before a fix can be applied.

## Revert Guidelines

Reverting changes that are causing issues in the master branch is a normal and expected part of the development process. In an open source community, the ramifications of a change cannot always be fully understood. With that in mind, here are some considerations to keep in mind when considering a revert:

- **Availability of the PR author:** If the original PR author or the engineer who merged the code is highly available and can provide a fix in a reasonable timeframe, this would counter-indicate reverting.
- **Severity of the issue:** How severe is the problem on master? Is it keeping the project from moving forward? Is there user impact? What percentage of users will experience a problem?
- **Size of the change being reverted:** Reverting a single small PR is a much lower-risk proposition than reverting a massive, multi-PR change.
- **Age of the change being reverted:** Reverting a recently-merged PR will be more acceptable than reverting an older PR. A bug discovered in an older PR is unlikely to be causing widespread serious issues.
- **Risk inherent in reverting:** Will the reversion break critical functionality? Is the medicine more dangerous than the disease?
- **Difficulty of crafting a fix:** In the case of issues with a clear solution, it may be preferable to implement and merge a fix rather than a revert.

Should you decide that reverting is desirable, it is the responsibility of the Contributor performing the revert to:

- **Contact the interested parties:** The PR's author and the engineer who merged the work should both be contacted and informed of the revert.
- **Provide concise reproduction steps:** Ensure that the issue can be clearly understood and duplicated by the original author of the PR.
- **Put the revert through code review:** The revert must be approved by another committer.

## Setup Local Environment for Development

First, [fork the repository on GitHub](https://help.github.com/articles/about-forks/), then clone it. You can clone the main repository directly, but you won't be able to send pull requests.

```bash
git clone git@github.com:your-username/superset.git
cd superset
```

### Documentation

The latest documentation and tutorial are available at https://superset.apache.org/.

The site is written using the Gatsby framework and docz for the
documentation subsection. Find out more about it in `docs/README.md`

#### Images

If you're adding new images to the documentation, you'll notice that the images
referenced in the rst, e.g.

    .. image:: _static/images/tutorial/tutorial_01_sources_database.png

aren't actually stored in that directory. Instead, you should add and commit
images (and any other static assets) to the `superset-frontend/src/assets/images` directory.
When the docs are deployed to https://superset.apache.org/, images
are copied from there to the `_static/images` directory, just like they're referenced
in the docs.

For example, the image referenced above actually lives in `superset-frontend/src/assets/images/tutorial`. Since the image is moved during the documentation build process, the docs reference the image in `_static/images/tutorial` instead.

### Flask server

#### OS Dependencies

Make sure your machine meets the [OS dependencies](https://superset.apache.org/docs/installation/installing-superset-from-scratch#os-dependencies) before following these steps.  
You also need to install MySQL or [MariaDB](https://mariadb.com/downloads).

Ensure that you are using Python version 3.7 or 3.8, then proceed with:

````bash
# Create a virtual environment and activate it (recommended)
python3 -m venv venv # setup a python3 virtualenv
source venv/bin/activate

# Install external dependencies
pip install -r requirements/testing.txt

# Install Superset in editable (development) mode
pip install -e .

# Create an admin user in your metadata database (use `admin` as username to be able to load the examples)
superset fab create-admin

# Initialize the database
superset db upgrade

# Create default roles and permissions
superset init

# Load some data to play with.
# Note: you MUST have previously created an admin user with the username `admin` for this command to work.
superset load-examples

# Start the Flask dev web server from inside your virtualenv.
# Note that your page may not have CSS at this point.
# See instructions below how to build the front-end assets.
FLASK_ENV=development superset run -p 8088 --with-threads --reload --debugger
```

Or you can install via our Makefile

```bash
# Create a virtual environment and activate it (recommended)
$ python3 -m venv venv # setup a python3 virtualenv
$ source venv/bin/activate

# install pip packages + pre-commit
$ make install

# Install superset pip packages and setup env only
$ make superset

# Setup pre-commit only
$ make pre-commit
````

**Note: the FLASK_APP env var should not need to be set, as it's currently controlled
via `.flaskenv`, however if needed, it should be set to `superset.app:create_app()`**

If you have made changes to the FAB-managed templates, which are not built the same way as the newer, React-powered front-end assets, you need to start the app without the `--with-threads` argument like so:
`FLASK_ENV=development superset run -p 8088 --reload --debugger`

#### Dependencies

If you add a new requirement or update an existing requirement (per the `install_requires` section in `setup.py`) you must recompile (freeze) the Python dependencies to ensure that for CI, testing, etc. the build is deterministic. This can be achieved via,

```bash
$ python3 -m venv venv
$ source venv/bin/activate
$ python3 -m pip install -r requirements/integration.txt
$ pip-compile-multi --no-upgrade
```

#### Logging to the browser console

This feature is only available on Python 3. When debugging your application, you can have the server logs sent directly to the browser console using the [ConsoleLog](https://github.com/betodealmeida/consolelog) package. You need to mutate the app, by adding the following to your `config.py` or `superset_config.py`:

```python
from console_log import ConsoleLog

def FLASK_APP_MUTATOR(app):
    app.wsgi_app = ConsoleLog(app.wsgi_app, app.logger)
```

Then make sure you run your WSGI server using the right worker type:

```bash
FLASK_ENV=development gunicorn "superset.app:create_app()" -k "geventwebsocket.gunicorn.workers.GeventWebSocketWorker" -b 127.0.0.1:8088 --reload
```

You can log anything to the browser console, including objects:

```python
from superset import app
app.logger.error('An exception occurred!')
app.logger.info(form_data)
```

### Frontend

Frontend assets (TypeScript, JavaScript, CSS, and images) must be compiled in order to properly display the web UI. The `superset-frontend` directory contains all NPM-managed frontend assets. Note that for some legacy pages there are additional frontend assets bundled with Flask-Appbuilder (e.g. jQuery and bootstrap). These are not managed by NPM and may be phased out in the future.

#### Prerequisite

##### nvm and node

First, be sure you are using the following versions of Node.js and npm:
- `Node.js`: Version 16
- `npm`: Version 7

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage your node environment:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.0/install.sh | bash

cd superset-frontend
nvm install --lts
nvm use --lts
```

Or if you use the default macOS starting with Catalina shell `zsh`, try:

```zsh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.0/install.sh)"
```

For those interested, you may also try out [avn](https://github.com/nvm-sh/nvm#deeper-shell-integration) to automatically switch to the node version that is required to run Superset frontend.

#### Install dependencies

Install third-party dependencies listed in `package.json` via:

```bash
# From the root of the repository
cd superset-frontend

# Install dependencies from `package-lock.json`
npm ci
```

#### Build assets

There are three types of assets you can build:

1. `npm run build`: the production assets, CSS/JSS minified and optimized
2. `npm run dev-server`: local development assets, with sourcemaps and hot refresh support
3. `npm run build-instrumented`: instrumented application code for collecting code coverage from Cypress tests

#### Webpack dev server

The dev server by default starts at `http://localhost:9000` and proxies the backend requests to `http://localhost:8088`. It's possible to change these settings:

```bash
# Start the dev server at http://localhost:9000
npm run dev-server

# Run the dev server on a non-default port
npm run dev-server -- --devserverPort=9001

# Proxy backend requests to a Flask server running on a non-default port
npm run dev-server -- --supersetPort=8081

# Proxy to a remote backend but serve local assets
npm run dev-server -- --superset=https://superset-dev.example.com
```

The `--superset=` option is useful in case you want to debug a production issue or have to setup Superset behind a firewall. It allows you to run Flask server in another environment while keep assets building locally for the best developer experience.

#### Other npm commands

Alternatively, there are other NPM commands you may find useful:

1. `npm run build-dev`: build assets in development mode.
2. `npm run dev`: built dev assets in watch mode, will automatically rebuild when a file changes

#### Docker (docker-compose)

See docs [here](docker/README.md)

#### Updating NPM packages

Use npm in the prescribed way, making sure that
`superset-frontend/package-lock.json` is updated according to `npm`-prescribed
best practices.

#### Feature flags

Superset supports a server-wide feature flag system, which eases the incremental development of features. To add a new feature flag, simply modify `superset_config.py` with something like the following:

```python
FEATURE_FLAGS = {
    'SCOPED_FILTER': True,
}
```

If you want to use the same flag in the client code, also add it to the FeatureFlag TypeScript enum in [@superset-ui/core](https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/utils/featureFlags.ts). For example,

```typescript
export enum FeatureFlag {
  SCOPED_FILTER = "SCOPED_FILTER",
}
```

`superset/config.py` contains `DEFAULT_FEATURE_FLAGS` which will be overwritten by
those specified under FEATURE_FLAGS in `superset_config.py`. For example, `DEFAULT_FEATURE_FLAGS = { 'FOO': True, 'BAR': False }` in `superset/config.py` and `FEATURE_FLAGS = { 'BAR': True, 'BAZ': True }` in `superset_config.py` will result
in combined feature flags of `{ 'FOO': True, 'BAR': True, 'BAZ': True }`.

The current status of the usability of each flag (stable vs testing, etc) can be found in `RESOURCES/FEATURE_FLAGS.md`.

## Git Hooks

Superset uses Git pre-commit hooks courtesy of [pre-commit](https://pre-commit.com/). To install run the following:

```bash
pip3 install -r requirements/integration.txt
pre-commit install
```

A series of checks will now run when you make a git commit.

Alternatively it is possible to run pre-commit via tox:

```bash
tox -e pre-commit
```

Or by running pre-commit manually:

```bash
pre-commit run --all-files
```

## Linting

### Python

We use [Pylint](https://pylint.org/) for linting which can be invoked via:

```bash
# for python
tox -e pylint
```

In terms of best practices please advoid blanket disablement of Pylint messages globally (via `.pylintrc`) or top-level within the file header, albeit there being a few exceptions. Disablement should occur inline as it prevents masking issues and provides context as to why said message is disabled.

Additionally the Python code is auto-formatted using [Black](https://github.com/python/black) which
is configured as a pre-commit hook. There are also numerous [editor integrations](https://black.readthedocs.io/en/stable/editor_integration.html)

### TypeScript

```bash
cd superset-frontend
npm ci
npm run lint
```

If using the eslint extension with vscode, put the following in your workspace `settings.json` file:

```json
"eslint.workingDirectories": [
  "superset-frontend"
]
```

## Conventions

### Python

Parameters in the `config.py` (which are accessible via the Flask app.config dictionary) are assumed to always be defined and thus should be accessed directly via,

```python
blueprints = app.config["BLUEPRINTS"]
```

rather than,

```python
blueprints = app.config.get("BLUEPRINTS")
```

or similar as the later will cause typing issues. The former is of type `List[Callable]` whereas the later is of type `Optional[List[Callable]]`.

## Typing

### Python

To ensure clarity, consistency, all readability, _all_ new functions should use
[type hints](https://docs.python.org/3/library/typing.html) and include a
docstring.

Note per [PEP-484](https://www.python.org/dev/peps/pep-0484/#exceptions) no
syntax for listing explicitly raised exceptions is proposed and thus the
recommendation is to put this information in a docstring, i.e.,

```python
import math
from typing import Union


def sqrt(x: Union[float, int]) -> Union[float, int]:
    """
    Return the square root of x.

    :param x: A number
    :returns: The square root of the given number
    :raises ValueError: If the number is negative
    """

    return math.sqrt(x)
```

### TypeScript

TypeScript is fully supported and is the recommended language for writing all new frontend components. When modifying existing functions/components, migrating to TypeScript is appreciated, but not required. Examples of migrating functions/components to TypeScript can be found in [#9162](https://github.com/apache/superset/pull/9162) and [#9180](https://github.com/apache/superset/pull/9180).

## Testing

### Python Testing

All python tests are carried out in [tox](https://tox.readthedocs.io/en/latest/index.html)
a standardized testing framework.
All python tests can be run with any of the tox [environments](https://tox.readthedocs.io/en/latest/example/basic.html#a-simple-tox-ini-default-environments), via,

```bash
tox -e <environment>
```

For example,

```bash
tox -e py38
```

Alternatively, you can run all tests in a single file via,

```bash
tox -e <environment> -- tests/test_file.py
```

or for a specific test via,

```bash
tox -e <environment> -- tests/test_file.py::TestClassName::test_method_name
```

Note that the test environment uses a temporary directory for defining the
SQLite databases which will be cleared each time before the group of test
commands are invoked.

There is also a utility script included in the Superset codebase to run python tests. The [readme can be
found here](https://github.com/apache/superset/tree/master/scripts/tests)

To run all tests for example, run this script from the root directory:

```bash
scripts/tests/run.sh
```

### Frontend Testing

We use [Jest](https://jestjs.io/) and [Enzyme](https://airbnb.io/enzyme/) to test TypeScript/JavaScript. Tests can be run with:

```bash
cd superset-frontend
npm run test
```

To run a single test file:

```bash
npm run test -- path/to/file.js
```

### Integration Testing

We use [Cypress](https://www.cypress.io/) for integration tests. Tests can be run by `tox -e cypress`. To open Cypress and explore tests first setup and run test server:

```bash
export SUPERSET_CONFIG=tests.integration_tests.superset_test_config
export SUPERSET_TESTENV=true
export ENABLE_REACT_CRUD_VIEWS=true
export CYPRESS_BASE_URL="http://localhost:8081"
superset db upgrade
superset load_test_users
superset load-examples --load-test-data
superset init
superset run --port 8081
```

Run Cypress tests:

```bash
cd superset-frontend
npm run build-instrumented

cd cypress-base
npm install

# run tests via headless Chrome browser (requires Chrome 64+)
npm run cypress-run-chrome

# run tests from a specific file
npm run cypress-run-chrome -- --spec cypress/integration/explore/link.test.ts

# run specific file with video capture
npm run cypress-run-chrome -- --spec cypress/integration/dashboard/index.test.js --config video=true

# to open the cypress ui
npm run cypress-debug

# to point cypress to a url other than the default (http://localhost:8088) set the environment variable before running the script
# e.g., CYPRESS_BASE_URL="http://localhost:9000"
CYPRESS_BASE_URL=<your url> npm run cypress open
```

See [`superset-frontend/cypress_build.sh`](https://github.com/apache/superset/blob/master/superset-frontend/cypress_build.sh).

As an alternative you can use docker-compose environment for testing:

Make sure you have added below line to your /etc/hosts file:
`127.0.0.1 db`

If you already have launched Docker environment please use the following command to assure a fresh database instance:
`docker-compose down -v`

Launch environment:

`CYPRESS_CONFIG=true docker-compose up`

It will serve backend and frontend on port 8088.

Run Cypress tests:

```bash
cd cypress-base
npm install
npm run cypress open
```

### Debugging Server App

Follow these instructions to debug the Flask app running inside a docker container.

First add the following to the ./docker-compose.yaml file

```diff
superset:
    env_file: docker/.env
    image: *superset-image
    container_name: superset_app
    command: ["/app/docker/docker-bootstrap.sh", "app"]
    restart: unless-stopped
+   cap_add:
+     - SYS_PTRACE
    ports:
      - 8088:8088
+     - 5678:5678
    user: "root"
    depends_on: *superset-depends-on
    volumes: *superset-volumes
    environment:
      CYPRESS_CONFIG: "${CYPRESS_CONFIG}"
```

Start Superset as usual

```bash
docker-compose up
```

Install the required libraries and packages to the docker container

Enter the superset_app container

```bash
docker exec -it superset_app /bin/bash
root@39ce8cf9d6ab:/app#
```

Run the following commands inside the container

```bash
apt update
apt install -y gdb
apt install -y net-tools
pip install debugpy
```

Find the PID for the Flask process. Make sure to use the first PID. The Flask app will re-spawn a sub-process everytime you change any of the python code. So it's important to use the first PID.

```bash
ps -ef

UID        PID  PPID  C STIME TTY          TIME CMD
root         1     0  0 14:09 ?        00:00:00 bash /app/docker/docker-bootstrap.sh app
root         6     1  4 14:09 ?        00:00:04 /usr/local/bin/python /usr/bin/flask run -p 8088 --with-threads --reload --debugger --host=0.0.0.0
root        10     6  7 14:09 ?        00:00:07 /usr/local/bin/python /usr/bin/flask run -p 8088 --with-threads --reload --debugger --host=0.0.0.0
```

Inject debugpy into the running Flask process. In this case PID 6.

```bash
python3 -m debugpy --listen 0.0.0.0:5678 --pid 6
```

Verify that debugpy is listening on port 5678

```bash
netstat -tunap

Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name
tcp        0      0 0.0.0.0:5678            0.0.0.0:*               LISTEN      462/python
tcp        0      0 0.0.0.0:8088            0.0.0.0:*               LISTEN      6/python
```

You are now ready to attach a debugger to the process. Using VSCode you can configure a launch configuration file .vscode/launch.json like so.

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Attach to Superset App in Docker Container",
            "type": "python",
            "request": "attach",
            "connect": {
                "host": "127.0.0.1",
                "port": 5678
            },
            "pathMappings": [
                {
                    "localRoot": "${workspaceFolder}",
                    "remoteRoot": "/app"
                }
            ]
        },
    ]
}
```

VSCode will not stop on breakpoints right away. We've attached to PID 6 however it does not yet know of any sub-processes. In order to "wakeup" the debugger you need to modify a python file. This will trigger Flask to reload the code and create a new sub-process. This new sub-process will be detected by VSCode and breakpoints will be activated.

### Debugging Server App in Kubernetes Environment

To debug Flask running in POD inside kubernetes cluster. You'll need to make sure the pod runs as root and is granted the SYS_TRACE capability.These settings should not be used in production environments.

```
  securityContext:
    capabilities:
      add: ["SYS_PTRACE"]
```

See (set capabilities for a container)[https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-capabilities-for-a-container] for more details.

Once the pod is running as root and has the SYS_PTRACE capability it will be able to debug the Flask app.

You can follow the same instructions as in the docker-compose. Enter the pod and install the required library and packages; gdb, netstat and debugpy.

Often in a kuernetes environment nodes are not addressable from ouside the cluster. VSCode will thus be unable to remotely connect to port 5678 on a kubernetes node. In order to do this you need to create a tunnel that port forwards 5678 to your local machine.

```
kubectl port-forward  pod/superset-<some random id> 5678:5678
```

You can now launch your VSCode debugger with the same config as above. VSCode will connect to to 127.0.0.1:5678 which is forwarded by kubectl to your remote kubernetes POD.

### Storybook

Superset includes a [Storybook](https://storybook.js.org/) to preview the layout/styling of various Superset components, and variations thereof. To open and view the Storybook:

```bash
cd superset-frontend
npm run storybook
```

When contributing new React components to Superset, please try to add a Story alongside the component's `jsx/tsx` file.

## Translating

We use [Babel](http://babel.pocoo.org/en/latest/) to translate Superset.
In Python files, we import the magic `_` function using:

```python
from flask_babel import lazy_gettext as _
```

then wrap our translatable strings with it, e.g. `_('Translate me')`.
During extraction, string literals passed to `_` will be added to the
generated `.po` file for each language for later translation.

At runtime, the `_` function will return the translation of the given
string for the current language, or the given string itself
if no translation is available.

In TypeScript/JavaScript, the technique is similar:
we import `t` (simple translation), `tn` (translation containing a number).

```javascript
import { t, tn } from "@superset-ui/translation";
```

### Enabling language selection

Add the `LANGUAGES` variable to your `superset_config.py`. Having more than one
option inside will add a language selection dropdown to the UI on the right side
of the navigation bar.

```python
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'fr': {'flag': 'fr', 'name': 'French'},
    'zh': {'flag': 'cn', 'name': 'Chinese'},
}
```

### Extracting new strings for translation

```bash
pybabel extract -F superset/translations/babel.cfg -o superset/translations/messages.pot -k _ -k __ -k t -k tn -k tct .
```

This will update the template file `superset/translations/messages.pot` with current application strings. Do not forget to update
this file with the appropriate license information.

### Updating language files

```bash
 pybabel update -i superset/translations/messages.pot -d superset/translations --ignore-obsolete
```

This will update language files with the new extracted strings.

You can then translate the strings gathered in files located under
`superset/translation`, where there's one per language. You can use [Poedit](https://poedit.net/features)
to translate the `po` file more conveniently.
There are some [tutorials in the wiki](https://wiki.lxde.org/en/Translate_*.po_files_with_Poedit).

In the case of JS translation, we need to convert the PO file into a JSON file, and we need the global download of the npm package po2json.

```bash
npm install -g po2json
```

To convert all PO files to formatted JSON files you can use the `po2json.sh` script.

```bash
./scripts/po2json.sh
```

If you get errors running `po2json`, you might be running the Ubuntu package with the same
name, rather than the Node.js package (they have a different format for the arguments). If
there is a conflict, you may need to update your `PATH` environment variable or fully qualify
the executable path (e.g. `/usr/local/bin/po2json` instead of `po2json`).
If you get a lot of `[null,***]` in `messages.json`, just delete all the `null,`.
For example, `"year":["年"]` is correct while `"year":[null,"年"]`is incorrect.

For the translations to take effect we need to compile translation catalogs into binary MO files.

```bash
pybabel compile -d superset/translations
```

### Creating a new language dictionary

To create a dictionary for a new language, run the following, where `LANGUAGE_CODE` is replaced with
the language code for your target language, e.g. `es` (see [Flask AppBuilder i18n documentation](https://flask-appbuilder.readthedocs.io/en/latest/i18n.html) for more details):

```bash
pip install -r superset/translations/requirements.txt
pybabel init -i superset/translations/messages.pot -d superset/translations -l LANGUAGE_CODE
```

Then, [extract strings for the new language](#extracting-new-strings-for-translation).

## Tips

### Adding a new datasource

1. Create Models and Views for the datasource, add them under superset folder, like a new my_models.py
   with models for cluster, datasources, columns and metrics and my_views.py with clustermodelview
   and datasourcemodelview.

1. Create DB migration files for the new models

1. Specify this variable to add the datasource model and from which module it is from in config.py:

   For example:

   ```python
   ADDITIONAL_MODULE_DS_MAP = {'superset.my_models': ['MyDatasource', 'MyOtherDatasource']}
   ```

   This means it'll register MyDatasource and MyOtherDatasource in superset.my_models module in the source registry.

### Improving visualizations

To edit the frontend code for visualizations, you will have to check out a copy of [apache-superset/superset-ui](https://github.com/apache-superset/superset-ui):

```bash
git clone https://github.com/apache-superset/superset-ui.git
cd superset-ui
yarn
yarn build
```

Then use `npm link` to create symlinks of the plugins/superset-ui packages you want to edit in `superset-frontend/node_modules`:

```bash
# Since npm 7, you have to install plugin dependencies separately, too
cd ../../superset-ui/plugins/[PLUGIN NAME] && npm install --legacy-peer-deps

cd superset/superset-frontend
npm link ../../superset-ui/plugins/[PLUGIN NAME]

# Or to link all core superset-ui and plugin packages:
# npm link ../../superset-ui/{packages,plugins}/*

# Start developing
npm run dev-server
```

When `superset-ui` packages are linked with `npm link`, the dev server will automatically load a package's source code from its `/src` directory, instead of the built modules in `lib/` or `esm/`.

Note that every time you do `npm install`, you will lose the symlink(s) and may have to run `npm link` again.

### Visualization Plugins

The topic of authoring new plugins, whether you'd like to contribute
it back or not has been well documented in the
[So, You Want to Build a Superset Viz Plugin...](https://preset.io/blog/2020-07-02-hello-world/) blog post

To contribute a plugin to Superset-UI, your plugin must meet the following criteria:

- The plugin should be applicable to the community at large, not a particularly specialized use case
- The plugin should be written with TypeScript
- The plugin should contain sufficient unit/e2e tests
- The plugin should use appropriate namespacing, e.g. a folder name of `plugin-chart-whatever` and a package name of `@superset-ui/plugin-chart-whatever`
- The plugin should use them variables via Emotion, as passed in by the ThemeProvider
- The plugin should provide adequate error handling (no data returned, malformatted data, invalid controls, etc.)
- The plugin should contain documentation in the form of a populated `README.md` file
- The plugin should have a meaningful and unique icon
- Above all else, the plugin should come with a _commitment to maintenance_ from the original author(s)

Submissions will be considered for submission (or removal) on a case-by-case basis.

### Adding a DB migration

1. Alter the model you want to change. This example will add a `Column` Annotations model.

   [Example commit](https://github.com/apache/superset/commit/6c25f549384d7c2fc288451222e50493a7b14104)

1. Generate the migration file

   ```bash
   superset db migrate -m 'add_metadata_column_to_annotation_model'
   ```

   This will generate a file in `migrations/version/{SHA}_this_will_be_in_the_migration_filename.py`.

   [Example commit](https://github.com/apache/superset/commit/d3e83b0fd572c9d6c1297543d415a332858e262)

1. Upgrade the DB

   ```bash
   superset db upgrade
   ```

   The output should look like this:

   ```
   INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
   INFO  [alembic.runtime.migration] Will assume transactional DDL.
   INFO  [alembic.runtime.migration] Running upgrade 1a1d627ebd8e -> 40a0a483dd12, add_metadata_column_to_annotation_model.py
   ```

1. Add column to view

   Since there is a new column, we need to add it to the AppBuilder Model view.

   [Example commit](https://github.com/apache/superset/pull/5745/commits/6220966e2a0a0cf3e6d87925491f8920fe8a3458)

1. Test the migration's `down` method

   ```bash
   superset db downgrade
   ```

   The output should look like this:

   ```
   INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
   INFO  [alembic.runtime.migration] Will assume transactional DDL.
   INFO  [alembic.runtime.migration] Running downgrade 40a0a483dd12 -> 1a1d627ebd8e, add_metadata_column_to_annotation_model.py
   ```

### Merging DB migrations

When two DB migrations collide, you'll get an error message like this one:

```text
alembic.util.exc.CommandError: Multiple head revisions are present for
given argument 'head'; please specify a specific target
revision, '<branchname>@head' to narrow to a specific head,
or 'heads' for all heads`
```

To fix it:

1. Get the migration heads

   ```bash
   superset db heads
   ```

   This should list two or more migration hashes. E.g.

   ```bash
   1412ec1e5a7b (head)
   67da9ef1ef9c (head)
   ```

2. Pick one of them as the parent revision, open the script for the other revision
   and update `Revises` and `down_revision` to the new parent revision. E.g.:

   ```diff
   --- a/67da9ef1ef9c_add_hide_left_bar_to_tabstate.py
   +++ b/67da9ef1ef9c_add_hide_left_bar_to_tabstate.py
   @@ -17,14 +17,14 @@
   """add hide_left_bar to tabstate

   Revision ID: 67da9ef1ef9c
   -Revises: c501b7c653a3
   +Revises: 1412ec1e5a7b
   Create Date: 2021-02-22 11:22:10.156942

   """

   # revision identifiers, used by Alembic.
   revision = "67da9ef1ef9c"
   -down_revision = "c501b7c653a3"
   +down_revision = "1412ec1e5a7b"

   import sqlalchemy as sa
   from alembic import op
   ```

   Alternatively you may also run `superset db merge` to create a migration script
   just for merging the heads.

   ```bash
   superset db merge {HASH1} {HASH2}
   ```

3. Upgrade the DB to the new checkpoint

   ```bash
   superset db upgrade
   ```

### SQL Lab Async

It's possible to configure a local database to operate in `async` mode,
to work on `async` related features.

To do this, you'll need to:

- Add an additional database entry. We recommend you copy the connection
  string from the database labeled `main`, and then enable `SQL Lab` and the
  features you want to use. Don't forget to check the `Async` box
- Configure a results backend, here's a local `FileSystemCache` example,
  not recommended for production,
  but perfect for testing (stores cache in `/tmp`)

  ```python
  from cachelib.file import FileSystemCache
  RESULTS_BACKEND = FileSystemCache('/tmp/sqllab')
  ```

- Start up a celery worker

  ```shell script
  celery --app=superset.tasks.celery_app:app worker -Ofair
  ```

Note that:

- for changes that affect the worker logic, you'll have to
  restart the `celery worker` process for the changes to be reflected.
- The message queue used is a `sqlite` database using the `SQLAlchemy`
  experimental broker. Ok for testing, but not recommended in production
- In some cases, you may want to create a context that is more aligned
  to your production environment, and use the similar broker as well as
  results backend configuration

### Async Chart Queries

It's possible to configure database queries for charts to operate in `async` mode. This is especially useful for dashboards with many charts that may otherwise be affected by browser connection limits. To enable async queries for dashboards and Explore, the following dependencies are required:

- Redis 5.0+ (the feature utilizes [Redis Streams](https://redis.io/topics/streams-intro))
- Cache backends enabled via the `CACHE_CONFIG` and `DATA_CACHE_CONFIG` config settings
- Celery workers configured and running to process async tasks

The following configuration settings are available for async queries (see config.py for default values)

- `GLOBAL_ASYNC_QUERIES` (feature flag) - enable or disable async query operation
- `GLOBAL_ASYNC_QUERIES_REDIS_CONFIG` - Redis connection info
- `GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX` - the prefix used with Redis Streams
- `GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT` - the maximum number of events for each user-specific event stream (FIFO eviction)
- `GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT_FIREHOSE` - the maximum number of events for all users (FIFO eviction)
- `GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME` - the async query feature uses a [JWT](https://tools.ietf.org/html/rfc7519) cookie for authentication, this setting is the cookie's name
- `GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE` - JWT cookie secure option
- `GLOBAL_ASYNC_QUERIES_JWT_COOKIE_DOMAIN` - JWT cookie domain option ([see docs for set_cookie](https://tedboy.github.io/flask/interface_api.response_object.html#flask.Response.set_cookie))
- `GLOBAL_ASYNC_QUERIES_JWT_SECRET` - JWT's use a secret key to sign and validate the contents. This value should be at least 32 bytes and have sufficient randomness for proper security
- `GLOBAL_ASYNC_QUERIES_TRANSPORT` - available options: "polling" (HTTP, default), "ws" (WebSocket, requires running superset-websocket server)
- `GLOBAL_ASYNC_QUERIES_POLLING_DELAY` - the time (in ms) between polling requests

More information on the async query feature can be found in [SIP-39](https://github.com/apache/superset/issues/9190).

## Chart Parameters

Chart parameters are stored as a JSON encoded string the `slices.params` column and are often referenced throughout the code as form-data. Currently the form-data is neither versioned nor typed as thus is somewhat free-formed. Note in the future there may be merit in using something like [JSON Schema](https://json-schema.org/) to both annotate and validate the JSON object in addition to using a Mypy `TypedDict` (introduced in Python 3.8) for typing the form-data in the backend. This section serves as a potential primer for that work.

The following tables provide a non-exhausive list of the various fields which can be present in the JSON object grouped by the Explorer pane sections. These values were obtained by extracting the distinct fields from a legacy deployment consisting of tens of thousands of charts and thus some fields may be missing whilst others may be deprecated.

Note not all fields are correctly catagorized. The fields vary based on visualization type and may apprear in different sections depending on the type. Verified deprecated columns may indicate a missing migration and/or prior migrations which were unsucessful and thus future work may be required to clean up the form-data.

### Datasource & Chart Type

| Field             | Type     | Notes                               |
| ----------------- | -------- | ----------------------------------- |
| `database_name`   | _string_ | _Deprecated?_                       |
| `datasource`      | _string_ | `<datasouce_id>__<datasource_type>` |
| `datasource_id`   | _string_ | _Deprecated?_ See `datasource`      |
| `datasource_name` | _string_ | _Deprecated?_                       |
| `datasource_type` | _string_ | _Deprecated?_ See `datasource`      |
| `viz_type`        | _string_ | The **Visualization Type** widget   |

### Time

| Field               | Type     | Notes                                 |
| ------------------- | -------- | ------------------------------------- |
| `druid_time_origin` | _string_ | The Druid **Origin** widget           |
| `granularity`       | _string_ | The Druid **Time Granularity** widget |
| `granularity_sqla`  | _string_ | The SQLA **Time Column** widget       |
| `time_grain_sqla`   | _string_ | The SQLA **Time Grain** widget        |
| `time_range`        | _string_ | The **Time range** widget             |

### GROUP BY

| Field                     | Type            | Notes             |
| ------------------------- | --------------- | ----------------- |
| `metrics`                 | _array(string)_ | See Query section |
| `order_asc`               | -               | See Query section |
| `row_limit`               | -               | See Query section |
| `timeseries_limit_metric` | -               | See Query section |

### NOT GROUPED BY

| Field           | Type            | Notes                   |
| --------------- | --------------- | ----------------------- |
| `order_by_cols` | _array(string)_ | The **Ordering** widget |
| `row_limit`     | -               | See Query section       |

### Y Axis 1

| Field           | Type | Notes                                              |
| --------------- | ---- | -------------------------------------------------- |
| `metric`        | -    | The **Left Axis Metric** widget. See Query section |
| `y_axis_format` | -    | See Y Axis section                                 |

### Y Axis 2

| Field      | Type | Notes                                               |
| ---------- | ---- | --------------------------------------------------- |
| `metric_2` | -    | The **Right Axis Metric** widget. See Query section |

### Query

| Field                                                                                                  | Type                                              | Notes                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| `adhoc_filters`                                                                                        | _array(object)_                                   | The **Filters** widget                            |
| `extra_filters`                                                                                        | _array(object)_                                   | Another pathway to the **Filters** widget.<br/>It is generally used to pass dashboard filter parameters to a chart.<br/>It can be used for appending additional filters to a chart that has been saved with its own filters on an ad-hoc basis if the chart is being used as a standalone widget.<br/><br/>For implementation examples see : [utils test.py](https://github.com/apache/superset/blob/66a4c94a1ed542e69fe6399bab4c01d4540486cf/tests/utils_tests.py#L181)<br/>For insight into how superset processes the contents of this parameter see: [exploreUtils/index.js](https://github.com/apache/superset/blob/93c7f5bb446ec6895d7702835f3157426955d5a9/superset-frontend/src/explore/exploreUtils/index.js#L159)                         |
| `columns`                                                                                              | _array(string)_                                   | The **Breakdowns** widget                         |
| `groupby`                                                                                              | _array(string)_                                   | The **Group by** or **Series** widget             |
| `limit`                                                                                                | _number_                                          | The **Series Limit** widget                       |
| `metric`<br>`metric_2`<br>`metrics`<br>`percent_mertics`<br>`secondary_metric`<br>`size`<br>`x`<br>`y` | _string_,_object_,_array(string)_,_array(object)_ | The metric(s) depending on the visualization type |
| `order_asc`                                                                                            | _boolean_                                         | The **Sort Descending** widget                    |
| `row_limit`                                                                                            | _number_                                          | The **Row limit** widget                          |
| `timeseries_limit_metric`                                                                              | _object_                                          | The **Sort By** widget                            |

The `metric` (or equivalent) and `timeseries_limit_metric` fields are all composed of either metric names or the JSON representation of the `AdhocMetric` TypeScript type. The `adhoc_filters` is composed of the JSON represent of the `AdhocFilter` TypeScript type (which can comprise of columns or metrics depending on whether it is a WHERE or HAVING clause). The `all_columns`, `all_columns_x`, `columns`, `groupby`, and `order_by_cols` fields all represent column names.

### Chart Options

| Field          | Type      | Notes                       |
| -------------- | --------- | --------------------------- |
| `color_picker` | _object_  | The **Fixed Color** widget  |
| `label_colors` | _object_  | The **Color Scheme** widget |
| `normalized`   | _boolean_ | The **Normalized** widget   |

### Y Axis

| Field            | Type     | Notes                        |
| ---------------- | -------- | ---------------------------- |
| `y_axis_2_label` | _N/A_    | _Deprecated?_                |
| `y_axis_format`  | _string_ | The **Y Axis Format** widget |
| `y_axis_zero`    | _N/A_    | _Deprecated?_                |

Note the `y_axis_format` is defined under various section for some charts.

### Other

| Field          | Type     | Notes |
| -------------- | -------- | ----- |
| `color_scheme` | _string_ |       |

### Unclassified

| Field                         | Type  | Notes |
| ----------------------------- | ----- | ----- |
| `add_to_dash`                 | _N/A_ |       |
| `code`                        | _N/A_ |       |
| `collapsed_fieldsets`         | _N/A_ |       |
| `comparison type`             | _N/A_ |       |
| `country_fieldtype`           | _N/A_ |       |
| `default_filters`             | _N/A_ |       |
| `entity`                      | _N/A_ |       |
| `expanded_slices`             | _N/A_ |       |
| `filter_immune_slice_fields`  | _N/A_ |       |
| `filter_immune_slices`        | _N/A_ |       |
| `flt_col_0`                   | _N/A_ |       |
| `flt_col_1`                   | _N/A_ |       |
| `flt_eq_0`                    | _N/A_ |       |
| `flt_eq_1`                    | _N/A_ |       |
| `flt_op_0`                    | _N/A_ |       |
| `flt_op_1`                    | _N/A_ |       |
| `goto_dash`                   | _N/A_ |       |
| `import_time`                 | _N/A_ |       |
| `label`                       | _N/A_ |       |
| `linear_color_scheme`         | _N/A_ |       |
| `new_dashboard_name`          | _N/A_ |       |
| `new_slice_name`              | _N/A_ |       |
| `num_period_compare`          | _N/A_ |       |
| `period_ratio_type`           | _N/A_ |       |
| `perm`                        | _N/A_ |       |
| `rdo_save`                    | _N/A_ |       |
| `refresh_frequency`           | _N/A_ |       |
| `remote_id`                   | _N/A_ |       |
| `resample_fillmethod`         | _N/A_ |       |
| `resample_how`                | _N/A_ |       |
| `rose_area_proportion`        | _N/A_ |       |
| `save_to_dashboard_id`        | _N/A_ |       |
| `schema`                      | _N/A_ |       |
| `series`                      | _N/A_ |       |
| `show_bubbles`                | _N/A_ |       |
| `slice_name`                  | _N/A_ |       |
| `timed_refresh_immune_slices` | _N/A_ |       |
| `userid`                      | _N/A_ |       |
