========
 Flake8
========

Flake8 is a wrapper around these tools:

- PyFlakes
- pycodestyle
- Ned Batchelder's McCabe script

Flake8 runs all the tools by launching the single ``flake8`` command.
It displays the warnings in a per-file, merged output.

It also adds a few features:

- files that contain this line are skipped::

    # flake8: noqa

- lines that contain a ``# noqa`` comment at the end will not issue warnings.
- you can ignore specific errors on a line with ``# noqa: <error>``, e.g.,
  ``# noqa: E234``
- Git and Mercurial hooks
- extendable through ``flake8.extension`` and ``flake8.formatting`` entry
  points


Quickstart
==========

See our `quickstart documentation
<http://flake8.pycqa.org/en/latest/index.html#quickstart>`_ for how to install
and get started with Flake8.


Frequently Asked Questions
==========================

Flake8 maintains an `FAQ <http://flake8.pycqa.org/en/latest/faq.html>`_ in its
documentation.


Questions or Feedback
=====================

If you have questions you'd like to ask the developers, or feedback you'd like
to provide, feel free to use the mailing list: code-quality@python.org

We would love to hear from you. Additionally, if you have a feature you'd like
to suggest, the mailing list would be the best place for it.


Links
=====

* `Flake8 Documentation <http://flake8.pycqa.org/en/latest/>`_

* `GitLab Project <https://gitlab.com/pycqa/flake8>`_

* `All (Open and Closed) Issues
  <https://gitlab.com/pycqa/flake8/issues?scope=all&sort=updated_desc&state=all>`_

* `Code-Quality Archives
  <https://mail.python.org/mailman/listinfo/code-quality>`_

* `Code of Conduct
  <http://flake8.pycqa.org/en/latest/internal/contributing.html#code-of-conduct>`_

* `Getting Started Contributing
  <http://flake8.pycqa.org/en/latest/internal/contributing.html>`_


Maintenance
===========

Flake8 was created by Tarek Ziadé and is currently maintained by `Ian Cordasco
<https://coglib.com/~icordasc/>`_


