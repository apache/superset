Introduction
============
This package contains utilities used to package some of STScI's Python
projects; specifically those projects that comprise stsci_python_ and
Astrolib_.

It currently consists mostly of some setup_hook scripts meant for use with
`distutils2/packaging`_ and/or pbr_, and a customized easy_install command
meant for use with distribute_.

This package is not meant for general consumption, though it might be worth
looking at for examples of how to do certain things with your own packages, but
YMMV.

Features
========

Hook Scripts
------------
Currently the main features of this package are a couple of setup_hook scripts.
In distutils2, a setup_hook is a script that runs at the beginning of any
pysetup command, and can modify the package configuration read from setup.cfg.
There are also pre- and post-command hooks that only run before/after a
specific setup command (eg. build_ext, install) is run.

stsci.distutils.hooks.use_packages_root
'''''''''''''''''''''''''''''''''''''''
If using the ``packages_root`` option under the ``[files]`` section of
setup.cfg, this hook will add that path to ``sys.path`` so that modules in your
package can be imported and used in setup.  This can be used even if
``packages_root`` is not specified--in this case it adds ``''`` to
``sys.path``.

stsci.distutils.hooks.version_setup_hook
''''''''''''''''''''''''''''''''''''''''
Creates a Python module called version.py which currently contains four
variables:

* ``__version__`` (the release version)
* ``__svn_revision__`` (the SVN revision info as returned by the ``svnversion``
  command)
* ``__svn_full_info__`` (as returned by the ``svn info`` command)
* ``__setup_datetime__`` (the date and time that setup.py was last run).

These variables can be imported in the package's `__init__.py` for degugging
purposes.  The version.py module will *only* be created in a package that
imports from the version module in its `__init__.py`.  It should be noted that
this is generally preferable to writing these variables directly into
`__init__.py`, since this provides more control and is less likely to
unexpectedly break things in `__init__.py`.

stsci.distutils.hooks.version_pre_command_hook
''''''''''''''''''''''''''''''''''''''''''''''
Identical to version_setup_hook, but designed to be used as a pre-command
hook.

stsci.distutils.hooks.version_post_command_hook
'''''''''''''''''''''''''''''''''''''''''''''''
The complement to version_pre_command_hook.  This will delete any version.py
files created during a build in order to prevent them from cluttering an SVN
working copy (note, however, that version.py is *not* deleted from the build/
directory, so a copy of it is still preserved).  It will also not be deleted
if the current directory is not an SVN working copy.  For example, if source
code extracted from a source tarball it will be preserved.

stsci.distutils.hooks.tag_svn_revision
''''''''''''''''''''''''''''''''''''''
A setup_hook to add the SVN revision of the current working copy path to the
package version string, but only if the version ends in .dev.

For example, ``mypackage-1.0.dev`` becomes ``mypackage-1.0.dev1234``.  This is
in accordance with the version string format standardized by PEP 386.

This should be used as a replacement for the ``tag_svn_revision`` option to
the egg_info command.  This hook is more compatible with packaging/distutils2,
which does not include any VCS support.  This hook is also more flexible in
that it turns the revision number on/off depending on the presence of ``.dev``
in the version string, so that it's not automatically added to the version in
final releases.

This hook does require the ``svnversion`` command to be available in order to
work.  It does not examine the working copy metadata directly.

stsci.distutils.hooks.numpy_extension_hook
''''''''''''''''''''''''''''''''''''''''''
This is a pre-command hook for the build_ext command.  To use it, add a
``[build_ext]`` section to your setup.cfg, and add to it::

    pre-hook.numpy-extension-hook = stsci.distutils.hooks.numpy_extension_hook

This hook must be used to build extension modules that use Numpy.   The primary
side-effect of this hook is to add the correct numpy include directories to
`include_dirs`.  To use it, add 'numpy' to the 'include-dirs' option of each
extension module that requires numpy to build.  The value 'numpy' will be
replaced with the actual path to the numpy includes.

stsci.distutils.hooks.is_display_option
'''''''''''''''''''''''''''''''''''''''
This is not actually a hook, but is a useful utility function that can be used
in writing other hooks.  Basically, it returns ``True`` if setup.py was run
with a "display option" such as --version or --help.  This can be used to
prevent your hook from running in such cases.

stsci.distutils.hooks.glob_data_files
'''''''''''''''''''''''''''''''''''''
A pre-command hook for the install_data command.  Allows filename wildcards as
understood by ``glob.glob()`` to be used in the data_files option.  This hook
must be used in order to have this functionality since it does not normally
exist in distutils.

This hook also ensures that data files are installed relative to the package
path.  data_files shouldn't normally be installed this way, but the
functionality is required for a few special cases.


Commands
--------
build_optional_ext
''''''''''''''''''
This serves as an optional replacement for the default built_ext command,
which compiles C extension modules.  Its purpose is to allow extension modules
to be *optional*, so that if their build fails the rest of the package is
still allowed to be built and installed.  This can be used when an extension
module is not definitely required to use the package.

To use this custom command, add::

    commands = stsci.distutils.command.build_optional_ext.build_optional_ext

under the ``[global]`` section of your package's setup.cfg.  Then, to mark
an individual extension module as optional, under the setup.cfg section for
that extension add::

    optional = True

Optionally, you may also add a custom failure message by adding::

    fail_message = The foobar extension module failed to compile.
                   This could be because you lack such and such headers.
                   This package will still work, but such and such features
                   will be disabled.


.. _stsci_python: http://www.stsci.edu/resources/software_hardware/pyraf/stsci_python
.. _Astrolib: http://www.scipy.org/AstroLib/
.. _distutils2/packaging: http://distutils2.notmyidea.org/
.. _d2to1: http://pypi.python.org/pypi/d2to1
.. _distribute: http://pypi.python.org/pypi/distribute
