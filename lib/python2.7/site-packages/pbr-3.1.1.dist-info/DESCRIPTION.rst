Introduction
============

.. image:: https://img.shields.io/pypi/v/pbr.svg
    :target: https://pypi.python.org/pypi/pbr/
    :alt: Latest Version

.. image:: https://img.shields.io/pypi/dm/pbr.svg
    :target: https://pypi.python.org/pypi/pbr/
    :alt: Downloads

PBR is a library that injects some useful and sensible default behaviors
into your setuptools run. It started off life as the chunks of code that
were copied between all of the `OpenStack`_ projects. Around the time that
OpenStack hit 18 different projects each with at least 3 active branches,
it seemed like a good time to make that code into a proper reusable library.

PBR is only mildly configurable. The basic idea is that there's a decent
way to run things and if you do, you should reap the rewards, because then
it's simple and repeatable. If you want to do things differently, cool! But
you've already got the power of Python at your fingertips, so you don't
really need PBR.

PBR builds on top of the work that `d2to1`_ started to provide for declarative
configuration. `d2to1`_ is itself an implementation of the ideas behind
`distutils2`_. Although `distutils2`_ is now abandoned in favor of work towards
`PEP 426`_ and Metadata 2.0, declarative config is still a great idea and
specifically important in trying to distribute setup code as a library
when that library itself will alter how the setup is processed. As Metadata
2.0 and other modern Python packaging PEPs come out, PBR aims to support
them as quickly as possible.

* License: Apache License, Version 2.0
* Documentation: http://docs.openstack.org/developer/pbr
* Source: http://git.openstack.org/cgit/openstack-dev/pbr
* Bugs: http://bugs.launchpad.net/pbr
* Change Log: https://docs.openstack.org/developer/pbr/history.html

.. _d2to1: https://pypi.python.org/pypi/d2to1
.. _distutils2: https://pypi.python.org/pypi/Distutils2
.. _PEP 426: http://legacy.python.org/dev/peps/pep-0426/
.. _OpenStack: https://www.openstack.org/



