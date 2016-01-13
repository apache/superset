# Contributing

Contributions are welcome and are greatly appreciated! Every
little bit helps, and credit will always be given.

You can contribute in many ways:

## Types of Contributions

### Report Bugs

Report bugs through Github

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

We've created the operators, hooks, macros and executors we needed, but we 
made sure that this part of Panoramix is extensible. New operators,
hooks and operators are very welcomed!

### Documentation

Panoramix could always use better documentation,
whether as part of the official Panoramix docs,
in docstrings, `docs/*.rst` or even on the web as blog posts or
articles.

### Submit Feedback

The best way to send feedback is to file an issue on Github.

If you are proposing a feature:

-   Explain in detail how it would work.
-   Keep the scope as narrow as possible, to make it easier to
    implement.
-   Remember that this is a volunteer-driven project, and that
    contributions are welcome :)

## Latest Documentation

[API Documentation](http://pythonhosted.com/panoramix)

## Setting up a development environment

    # fork the repo on github and then clone it
    # alternatively you may want to clone the main repo but that won't work
    # so well if you are planning on sending PRs
    # git clone git@github.com:mistercrunch/panoramix.git

    # [optional] setup a virtual env and activate it
    virtualenv env
    source env/bin/activate

    # install for development
    python setup.py develop

    # Create an admin user
    fabmanager create-admin --app panoramix

    # Initialize the database
    panoramix db upgrade

    # Create default roles and permissions
    panoramix init

    # Load some data to play with
    panoramix load_examples

    # start a dev web server
    panoramix runserver -d

For every development session you may have to 

## Testing

Tests can then be run with:

    ./run_unit_tests.sh

Lint the project with:

    flake8 changes tests

## API documentation

Generate the documentation with:

    cd docs && ./build.sh


## Pull Request Guidelines

Before you submit a pull request from your forked repo, check that it 
meets these guidelines:

1.  The pull request should include tests, either as doctests,
    unit tests, or both.
2.  If the pull request adds functionality, the docs should be updated
    as part of the same PR. Doc string are often sufficient, make 
    sure to follow the sphinx compatible standards.
3.  The pull request should work for Python 2.6, 2.7, and ideally python 3.3.
    `from __future__ import ` will be required in every `.py` file soon.
4.  Code will be reviewed by re running the unittests, flake8 and syntax
    should be as rigorous as the core Python project.
5.  Please rebase and resolve all conflicts before submitting.
