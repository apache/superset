# Contributing

Contributions are welcome and are greatly appreciated! Every
little bit helps, and credit will always be given.

You can contribute in many ways:

## Types of Contributions

### Report Bugs

Report bugs through Gihub

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
made sure that this part of Airflow is extensible. New operators,
hooks and operators are very welcomed!

### Documentation

Airflow could always use better documentation,
whether as part of the official Airflow docs,
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

## Latests Documentation

[API Documentation](http://pythonhosted.com/airflow)

## Testing

Install development requirements:

    pip install -r requirements.txt

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
