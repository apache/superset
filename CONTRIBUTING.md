# Contributing

Contributions are welcome and are greatly appreciated! Every
little bit helps, and credit will always be given.

## Table of Contents

- [Types of Contributions](#types-of-contributions)
  - [Report Bugs](#report-bugs)
  - [Fix Bugs](#fix-bugs)
  - [Implement Features](#implement-features)
  - [Improve Documentation](#improve-documentation)
  - [Add Translations](#add-translations)
  - [Submit Feedback](#submit-feedback)
  - [Ask Questions](#ask-questions)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Local development](#local-development)
  - [Documentation](#documentation)
  - [Flask server](#flask-server)
  - [Frontend assets](#frontend-assets)
- [Testing](#testing)
  - [JavaScript testing](#javascript-testing)
  - [Integration testing](#integration-testing)
  - [Linting](#linting)
- [Translating](#translating)
  - [Enabling language selection](#enabling-language-selection)
  - [Extracting new strings for translation](#extracting-new-strings-for-translation)
  - [Creating a new language dictionary](#creating-a-new-language-dictionary)
- [Tips](#tips)
  - [Adding a new datasource](#adding-a-new-datasource)
  - [Creating a new visualization type](#creating-a-new-visualization-type)
  - [Adding a DB migration](#adding-a-db-migration)
  - [Merging DB migrations](#merging-db-migrations)

## Types of Contributions

### Report Bugs

Report bugs through GitHub. If you are reporting a bug, please include:

- Your operating system name and version.
- Any details about your local setup that might be helpful in troubleshooting.
- Detailed steps to reproduce the bug.

When posting Python stack traces, please quote them using
[Markdown blocks](https://help.github.com/articles/creating-and-highlighting-code-blocks/).

### Fix Bugs

Look through the GitHub issues for bugs. Anything tagged with `bug` is
open to whoever wants to implement it.

### Implement Features

Look through the GitHub issues for features. Anything tagged with
`feature` or `starter_task` is open to whoever wants to implement it.

### Improve Documentation

Superset could always use better documentation,
whether as part of the official Superset docs,
in docstrings, `docs/*.rst` or even on the web as blog posts or
articles. See [Documentation](#documentation) for more details.

### Add Translations

If you are proficient in a non-English language, you can help translate text strings from Superset's UI. You can jump in to the existing language dictionaries at `superset/translations/<language_code>/LC_MESSAGES/messages.po`, or even create a dictionary for a new language altogether. See [Translating](#translating) for more details.

### Submit Feedback

The best way to send feedback is to file an issue on GitHub. If you are proposing a feature:

- Explain in detail how it would work.
- Keep the scope as narrow as possible, to make it easier to implement.
- Remember that this is a volunteer-driven project, and that contributions are welcome :)

### Ask Questions

There is a dedicated [`apache-superset` tag](https://stackoverflow.com/questions/tagged/apache-superset) on [StackOverflow](https://stackoverflow.com/). Please use it when asking questions.

## Pull Request Guidelines

Before you submit a pull request from your forked repo, check that it
meets these guidelines:

1.  The pull request should include tests, either as doctests,
    unit tests, or both.
2.  Run `tox` and resolve all errors and test failures.
3.  If the pull request adds functionality, the docs should be updated
    as part of the same PR. Doc string are often sufficient, make
    sure to follow the sphinx compatible standards.
4.  If the pull request adds a Python dependency include it in `setup.py`
    denoting any specific restrictions and in `requirements.txt` pinned to a
    specific version which ensures that the application build is deterministic.
5.  Please rebase and resolve all conflicts before submitting.
6.  Please ensure the necessary checks pass and that code coverage does not
    decrease.
7.  If you are asked to update your pull request with some changes there's
    no need to create a new one. Push your changes to the same branch.

## Local development

First, [fork the repository on GitHub](https://help.github.com/articles/about-forks/), then clone it. You can clone the main repository directly instead, but you won't be able to send pull requests.

```bash
git clone git@github.com:your-username/incubator-superset.git
cd incubator-superset
```

### Documentation

The latest documentation and tutorial are available at https://superset.incubator.apache.org/.

Contributing to the official documentation is relatively easy, once you've setup
your environment and done an edit end-to-end. The docs can be found in the
`docs/` subdirectory of the repository, and are written in the
[reStructuredText format](https://en.wikipedia.org/wiki/ReStructuredText) (.rst).
If you've written Markdown before, you'll find the reStructuredText format familiar.

Superset uses [Sphinx](http://www.sphinx-doc.org/en/1.5.1/) to convert the rst files
in `docs/` to the final HTML output users see.

Finally, to make changes to the rst files and build the docs using Sphinx,
you'll need to install a handful of dependencies from the repo you cloned:

```bash
pip install -r docs/requirements.txt
```

To get the feel for how to edit and build the docs, let's edit a file, build
the docs and see our changes in action. First, you'll want to
[create a new branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
to work on your changes:

```bash
git checkout -b changes-to-docs
```

Now, go ahead and edit one of the files under `docs/`, say `docs/tutorial.rst` - change
it however you want. Check out the
[ReStructuredText Primer](http://docutils.sourceforge.net/docs/user/rst/quickstart.html)
for a reference on the formatting of the rst files.

Once you've made your changes, run this command to convert the docs into HTML:

```bash
make html
```

You'll see a lot of output as Sphinx handles the conversion. After it's done, the
HTML Sphinx generated should be in `docs/_build/html`. Navigate there
and start a simple web server so we can check out the docs in a browser:

```bash
cd docs/_build/html
python -m SimpleHTTPServer
```

This will start a small Python web server listening on port 8000. Point your
browser to http://localhost:8000, find the file
you edited earlier, and check out your changes!

If you've made a change you'd like to contribute to the actual docs, just commit
your code, push your new branch to Github:

```bash
git add docs/tutorial.rst
git commit -m 'Awesome new change to tutorial'
git push origin changes-to-docs
```

Then, [open a pull request](https://help.github.com/articles/about-pull-requests/).

#### Images

If you're adding new images to the documentation, you'll notice that the images
referenced in the rst, e.g.

    .. image:: _static/img/tutorial/tutorial_01_sources_database.png

aren't actually stored in that directory. Instead, you should add and commit
images (and any other static assets) to the `superset/assets/images` directory.
When the docs are deployed to https://superset.incubator.apache.org/, images
are copied from there to the `_static/img` directory, just like they're referenced
in the docs.

For example, the image referenced above actually lives in `superset/assets/images/tutorial`. Since the image is moved during the documentation build process, the docs reference the image in `_static/img/tutorial` instead.

#### API documentation

Generate the API documentation with:

```bash
pip install -r docs/requirements.txt
python setup.py build_sphinx
```

### Flask server

Make sure your machine meets the [OS dependencies](https://superset.incubator.apache.org/installation.html#os-dependencies) before following these steps.

```bash
# Create a virtual environemnt and activate it (recommended)
virtualenv venv
source venv/bin/activate

# Install external dependencies
pip install -r requirements.txt
# Install Superset in editable (development) mode
pip install -e .

# Create an admin user
fabmanager create-admin --app superset

# Initialize the database
superset db upgrade

# Create default roles and permissions
superset init

# Load some data to play with
superset load_examples

# Start the Flask web server (but see below for frontend asset compilation)
superset runserver -d
```

#### Logging to the browser console

This feature is only available on Python 3. When debugging your application, you can have the server logs sent directly to the browser console:

```bash
superset runserver -d --console-log
```

You can log anything to the browser console, including objects:

```python
from superset import app
app.logger.error('An exception occurred!')
app.logger.info(form_data)
```

### Frontend assets

Frontend assets (JavaScript, CSS, and images) must be compiled in order to properly display the web UI. The `superset/assets` directory contains all NPM-managed front end assets. Note that there are additional frontend assets bundled with Flask-Appbuilder (e.g. jQuery and bootstrap); these are not managed by NPM, and may be phased out in the future.

First, be sure you are using recent versions of NodeJS and npm. Using [nvm](https://github.com/creationix/nvm) to manage them is recommended.

Install third-party dependencies listed in `package.json`:

```bash
# From the root of the repository
cd superset/assets

# Install yarn, a replacement for `npm install`
npm install -g yarn

# Install dependencies
yarn install
```

Finally, to compile frontend assets, run any of the following commands.

```bash
# Start a watcher that recompiles your assets as you modify them (reload your browser to see changes)
npm run dev

# Compile the Javascript and CSS in production/optimized mode for official releases
npm run prod

# Copy a conf file from the frontend to the backend
npm run sync-backend
```

#### Webpack dev server

Alternatively, you can run the Webpack dev server, which runs on port 9000 and proxies non-asset requests to the Flask server on port 8088. After pointing your browser to it, updates to asset sources will be reflected in-browser without a refresh.

```bash
# Run the dev server
npm run dev-server

# Run the dev server on a non-default port
npm run dev-server -- --port=9001

# Run the dev server proxying to a Flask server on a non-default port
npm run dev-server -- --supersetPort=8081
```

#### Upgrading NPM packages

After adding or upgrading an NPM package by changing `package.json`, you must run `yarn install`, which will regenerate the `yarn.lock` file. Then, be sure to commit the new `yarn.lock` so that other users' builds are reproducible. See [the Yarn docs](https://yarnpkg.com/blog/2016/11/24/lockfiles-for-all/) for more information.

#### Feature flags

Superset supports a server-wide feature flag system, which eases the incremental development of features. To add a new feature flag, simply modify `superset_config.py` with something like the following:
```
FEATURE_FLAGS = {
    'SCOPED_FILTER': True,
}
```
If you want to use the same flag in the client code, also add it to the FeatureFlag TypeScript enum in `superset/assets/src/featureFlags.ts`. For example,
```
export enum FeatureFlag {
  SCOPED_FILTER = 'SCOPED_FILTER',
}
```

## Testing

All tests are carried out in [tox](http://tox.readthedocs.io/en/latest/index.html)
a standardized testing framework mostly for Python (though we also used it for Javascript).
All python tests can be run with any of the tox [environments](http://tox.readthedocs.io/en/latest/example/basic.html#a-simple-tox-ini-default-environments), via,

```bash
tox -e <environment>
```

i.e.,

```bash
tox -e py27
tox -e py36
```

Alternatively, you can run all tests in a single file via,

```bash
tox -e <environment> -- tests/test_file.py
```

or for a specific test via,

```bash
tox -e <environment> -- tests/test_file.py:TestClassName.test_method_name
```

Note that the test environment uses a temporary directory for defining the
SQLite databases which will be cleared each time before the group of test
commands are invoked.

### JavaScript testing

We use [Jest](https://jestjs.io/) and [Enzyme](http://airbnb.io/enzyme/) to test Javascript. Tests can be run with:

```bash
cd superset/assets/spec
npm install
npm run test
```

### Integration testing

We use [Cypress](https://www.cypress.io/) for integration tests. Tests can be run by `tox -e cypress`. To open Cypress and explore tests first setup and run test server:

```bash
export SUPERSET_CONFIG=tests.superset_test_config
superset db upgrade
superset init
superset load_test_users
superset load_examples
superset runserver
```

Run Cypress tests:

```bash
cd /superset/superset/assets
npm run build
npm run cypress run
```

### Linting

Lint the project with:

```bash
# for python
tox -e flake8

# for javascript
tox -e eslint
```

## Translating

We use [Babel](http://babel.pocoo.org/en/latest/) to translate Superset. In Python files, we import the magic `_` function using:

```python
from flask_babel import lazy_gettext as _
```

then wrap our translatable strings with it, e.g. `_('Translate me')`. During extraction, string literals passed to `_` will be added to the generated `.po` file for each language for later translation.
At runtime, the `_` function will return the translation of the given string for the current language, or the given string itself if no translation is available.

In JavaScript, the technique is similar: we import `t` (simple translation), `tn` (translation containing a number), and `TCT` (translating entire React Components).

```javascript
import {t, tn, TCT} from locales;
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
fabmanager babel-extract --target superset/translations --output superset/translations/messages.pot --config superset/translations/babel.cfg -k _ -k __ -k t -k tn -k tct
```

You can then translate the strings gathered in files located under
`superset/translation`, where there's one per language. For the translations
to take effect:

```bash
# In the case of JS translation, we need to convert the PO file into a JSON file, and we need the global download of the npm package po2json.
npm install -g po2json
fabmanager babel-compile --target superset/translations
# Convert the en PO file into a JSON file
po2json -d superset -f jed1.x superset/translations/en/LC_MESSAGES/messages.po superset/translations/en/LC_MESSAGES/messages.json
```

If you get errors running `po2json`, you might be running the Ubuntu package with the same
name, rather than the NodeJS package (they have a different format for the arguments). If
there is a conflict, you may need to update your `PATH` environment variable or fully qualify
the executable path (e.g. `/usr/local/bin/po2json` instead of `po2json`).

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

### Creating a new visualization type

Here's an example as a Github PR with comments that describe what the
different sections of the code do:
https://github.com/apache/incubator-superset/pull/3013

### Adding a DB migration

1. Alter the model you want to change. This example will add a `Column` Annotations model.

    [Example commit](https://github.com/apache/incubator-superset/commit/6c25f549384d7c2fc288451222e50493a7b14104)

1. Generate the migration file

    ```bash
    superset db migrate -m 'add_metadata_column_to_annotation_model.py'
    ```

    This will generate a file in `migrations/version/{SHA}_this_will_be_in_the_migration_filename.py`.

    [Example commit](https://github.com/apache/incubator-superset/commit/d3e83b0fd572c9d6c1297543d415a332858e262)

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

    [Example commit](https://github.com/apache/incubator-superset/pull/5745/commits/6220966e2a0a0cf3e6d87925491f8920fe8a3458)

### Merging DB migrations

When two DB migrations collide, you'll get an error message like this one:

```
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

    This should list two or more migration hashes.

1. Create a new merge migration

    ```bash
    superset db merge {HASH1} {HASH2}
    ```

1. Upgrade the DB to the new checkpoint

    ```bash
    superset db upgrade
    ```
