# Contributing

Contributions are welcome and are greatly appreciated! Every
little bit helps, and credit will always be given.

You can contribute in many ways:

## Types of Contributions

### Report Bugs

Report bugs through GitHub

If you are reporting a bug, please include:

-   Your operating system name and version.
-   Any details about your local setup that might be helpful in
    troubleshooting.
-   Detailed steps to reproduce the bug.

### Fix Bugs

Look through the GitHub issues for bugs. Anything tagged with "bug" is
open to whoever wants to implement it.

### Implement Features

Look through the GitHub issues for features. Anything tagged with
"feature" is open to whoever wants to implement it.

### Documentation

Superset could always use better documentation,
whether as part of the official Superset docs,
in docstrings, `docs/*.rst` or even on the web as blog posts or
articles.

### Submit Feedback

The best way to send feedback is to file an issue on GitHub.

If you are proposing a feature:

-   Explain in detail how it would work.
-   Keep the scope as narrow as possible, to make it easier to
    implement.
-   Remember that this is a volunteer-driven project, and that
    contributions are welcome :)

## Documentation

The latest documentation and tutorial are available [here](http://airbnb.io/superset).

Contributing to the official documentation is relatively easy, once you've setup
your environment and done an edit end-to-end. The docs can be found in the
`docs/` subdirectory of the repository, and are written in the
[reStructuredText format](https://en.wikipedia.org/wiki/ReStructuredText) (.rst).
If you've written Markdown before, you'll find the reStructuredText format familiar.

Superset uses [Sphinx](http://www.sphinx-doc.org/en/1.5.1/) to convert the rst files
in `docs/` to the final HTML output users see.

Before you start changing the docs, you'll want to
[fork the Superset project on Github](https://help.github.com/articles/fork-a-repo/).
Once that new repository has been created, clone it on your local machine:

    git clone git@github.com:your_username/superset.git

At this point, you may also want to create a
[Python virtual environment](http://docs.python-guide.org/en/latest/dev/virtualenvs/)
to manage the Python packages you're about to install:

    virtualenv superset-dev
    source superset-dev/bin/activate

Finally, to make changes to the rst files and build the docs using Sphinx, 
you'll need to install a handful of dependencies from the repo you cloned:

    cd superset
    pip install -r dev-reqs-for-docs.txt

To get the feel for how to edit and build the docs, let's edit a file, build
the docs and see our changes in action. First, you'll want to
[create a new branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
to work on your changes:

    git checkout -b changes-to-docs

Now, go ahead and edit one of the files under `docs/`, say `docs/tutorial.rst`
- change it however you want. Check out the
[ReStructuredText Primer](http://docutils.sourceforge.net/docs/user/rst/quickstart.html)
for a reference on the formatting of the rst files.

Once you've made your changes, run this command from the root of the Superset
repo to convert the docs into HTML:

    python setup.py build_sphinx

You'll see a lot of output as Sphinx handles the conversion. After it's done, the
HTML Sphinx generated should be in `docs/_build/html`. Go ahead and navigate there
and start a simple web server so we can check out the docs in a browser:

    cd docs/_build/html
    python -m SimpleHTTPServer

This will start a small Python web server listening on port 8000. Point your
browser to [http://localhost:8000/](http://localhost:8000/), find the file
you edited earlier, and check out your changes!

If you've made a change you'd like to contribute to the actual docs, just commit
your code, push your new branch to Github:

    git add docs/tutorial.rst
    git commit -m 'Awesome new change to tutorial'
    git push origin changes-to-docs

Then, [open a pull request](https://help.github.com/articles/about-pull-requests/).

If you're adding new images to the documentation, you'll notice that the images
referenced in the rst, e.g.

    .. image:: _static/img/tutorial/tutorial_01_sources_database.png

aren't actually included in that directory. _Instead_, you'll want to add and commit
images (and any other static assets) to the _superset/assets/images_ directory.
When the docs are being pushed to [airbnb.io](http://airbnb.io/superset/), images
will be moved from there to the _\_static/img_ directory, just like they're referenced
in the docs.

For example, the image referenced above actually lives in

    superset/assets/images/tutorial

Since the image is moved during the documentation build process, the docs reference the
image in

    _static/img/tutorial

instead.

## Setting up a Python development environment

Check the [OS dependencies](http://airbnb.io/superset/installation.html#os-dependencies) before follows these steps.

    # fork the repo on GitHub and then clone it
    # alternatively you may want to clone the main repo but that won't work
    # so well if you are planning on sending PRs
    # git clone git@github.com:airbnb/superset.git

    # [optional] setup a virtual env and activate it
    virtualenv env
    source env/bin/activate

    # install for development
    python setup.py develop

    # Create an admin user
    fabmanager create-admin --app superset

    # Initialize the database
    superset db upgrade

    # Create default roles and permissions
    superset init

    # Load some data to play with
    superset load_examples

    # start a dev web server
    superset runserver -d


## Setting up the node / npm javascript environment

`superset/assets` contains all npm-managed, front end assets.
Flask-Appbuilder itself comes bundled with jQuery and bootstrap.
While these may be phased out over time, these packages are currently not
managed with npm.

### Node/npm versions
Make sure you are using recent versions of node and npm. No problems have been found with node>=5.10 and 4.0. > npm>=3.9.

### Using npm to generate bundled files

#### npm
First, npm must be available in your environment. If it is not you can run the following commands
(taken from [this source](https://gist.github.com/DanHerbert/9520689))
```
brew install node --without-npm
echo prefix=~/.npm-packages >> ~/.npmrc
curl -L https://www.npmjs.com/install.sh | sh
```

The final step is to add `~/.npm-packages/bin` to your `PATH` so commands you install globally are usable.
Add something like this to your `.bashrc` file, then `source ~/.bashrc` to reflect the change.
```
export PATH="$HOME/.npm-packages/bin:$PATH"
```

#### npm packages
To install third party libraries defined in `package.json`, run the
following within the `superset/assets/` directory which will install them in a
new `node_modules/` folder within `assets/`.

```
npm install
```

To parse and generate bundled files for superset, run either of the
following commands. The `dev` flag will keep the npm script running and
re-run it upon any changes within the assets directory.

```
# Copies a conf file from the frontend to the backend
npm run sync-backend

# Compiles the production / optimized js & css
npm run prod

# Start a web server that manages and updates your assets as you modify them
npm run dev
```

For every development session you will have to start a flask dev server
as well as an npm watcher

```
superset runserver -d -p 8081
npm run dev
```

## Testing

Python tests can be run with:

    ./run_tests.sh

We use [Mocha](https://mochajs.org/), [Chai](http://chaijs.com/) and [Enzyme](http://airbnb.io/enzyme/) to test Javascript. Tests can be run with:

    cd /superset/superset/assets/javascripts
    npm i
    npm run test

## Linting

Lint the project with:

    # for python changes
    flake8 changes tests
    flake8 changes superset

    # for javascript
    npm run lint

## Linting with codeclimate
Codeclimate is a service we use to measure code quality and test coverage. To get codeclimate's report on your branch, ideally before sending your PR, you can setup codeclimate against your Superset fork. After you push to your fork, you should be able to get the report at http://codeclimate.com . Alternatively, if you prefer to work locally, you can install the codeclimate cli tool.

*Install the codeclimate cli tool*
```
curl -L https://github.com/docker/machine/releases/download/v0.7.0/docker-machine-`uname -s`-`uname -m` > /usr/local/bin/docker-machine && chmod +x /usr/local/bin/docker-machine 
brew install docker
docker-machine create --driver virtual box default
docker-machine env default
eval "$(docker-machine env default)"
docker pull codeclimate/codeclimate
brew tap codeclimate/formulae
brew install codeclimate
```

*Run the lint command:*
```
docker-machine start
eval "$(docker-machine env default)”
codeclimate analyze
```
More info can be found here: https://docs.codeclimate.com/docs/open-source-free


## API documentation

Generate the documentation with:

    cd docs && ./build.sh

## CSS Themes
As part of the npm build process, CSS for Superset is compiled from `Less`, a dynamic stylesheet language.

It's possible to customize or add your own theme to Superset, either by overriding CSS rules or preferably
by modifying the Less variables or files in `assets/stylesheets/less/`.

The `variables.less` and `bootswatch.less` files that ship with Superset are derived from
[Bootswatch](https://bootswatch.com) and thus extend Bootstrap. Modify variables in these files directly, or
swap them out entirely with the equivalent files from other Bootswatch (themes)[https://github.com/thomaspark/bootswatch.git]

## Pull Request Guidelines

Before you submit a pull request from your forked repo, check that it
meets these guidelines:

1.  The pull request should include tests, either as doctests,
    unit tests, or both.
2.  If the pull request adds functionality, the docs should be updated
    as part of the same PR. Doc string are often sufficient, make
    sure to follow the sphinx compatible standards.
3.  The pull request should work for Python 2.6, 2.7, and ideally python 3.3.
    ``from __future__ import`` will be required in every `.py` file soon.
4.  Code will be reviewed by re running the unittests, flake8 and syntax
    should be as rigorous as the core Python project.
5.  Please rebase and resolve all conflicts before submitting.


## Translations

We use [Babel](http://babel.pocoo.org/en/latest/) to translate Superset. The
key is to instrument the strings that need translation using
`from flask_babel import lazy_gettext as _`. Once this is imported in
a module, all you have to do is to `_("Wrap your strings")` using the
underscore `_` "function".

To enable changing language in your environment, you can simply add the
`LANGUAGES` parameter to your `superset_config.py`. Having more than one
options here will add a language selection dropdown on the right side of the
navigation bar.

    LANGUAGES = {
        'en': {'flag': 'us', 'name': 'English'},
        'fr': {'flag': 'fr', 'name': 'French'},
        'zh': {'flag': 'cn', 'name': 'Chinese'},
    }

As per the [Flask AppBuilder documentation] about translation, to create a
new language dictionary, run the following command:

    pybabel init -i ./babel/messages.pot -d superset/translations -l es

Then it's a matter of running the statement below to gather all stings that
need translation

    fabmanager babel-extract --target superset/translations/

You can then translate the strings gathered in files located under
`superset/translation`, where there's one per language. For the translations
to take effect, they need to be compiled using this command:

    fabmanager babel-compile --target superset/translations/


## Adding new datasources

1. Create Models and Views for the datasource, add them under superset folder, like a new my_models.py
    with models for cluster, datasources, columns and metrics and my_views.py with clustermodelview
    and datasourcemodelview.

2. Create db migration files for the new models

3. Specify this variable to add the datasource model and from which module it is from in config.py:

    For example:

    `ADDITIONAL_MODULE_DS_MAP = {'superset.my_models': ['MyDatasource', 'MyOtherDatasource']}`

    This means it'll register MyDatasource and MyOtherDatasource in superset.my_models module in the source registry.
