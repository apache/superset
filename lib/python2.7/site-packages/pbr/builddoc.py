# Copyright 2011 OpenStack Foundation
# Copyright 2012-2013 Hewlett-Packard Development Company, L.P.
# All Rights Reserved.
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

from distutils import log
import fnmatch
import os
import sys

try:
    import cStringIO
except ImportError:
    import io as cStringIO

try:
    from sphinx import apidoc
    from sphinx import application
    from sphinx import setup_command
except Exception as e:
    # NOTE(dhellmann): During the installation of docutils, setuptools
    # tries to import pbr code to find the egg_info.writer hooks. That
    # imports this module, which imports sphinx, which imports
    # docutils, which is being installed. Because docutils uses 2to3
    # to convert its code during installation under python 3, the
    # import fails, but it fails with an error other than ImportError
    # (today it's a NameError on StandardError, an exception base
    # class). Convert the exception type here so it can be caught in
    # packaging.py where we try to determine if we can import and use
    # sphinx by importing this module.  See bug #1403510 for details.
    raise ImportError(str(e))
from pbr import git
from pbr import options


_rst_template = """%(heading)s
%(underline)s

.. automodule:: %(module)s
  :members:
  :undoc-members:
  :show-inheritance:
"""


def _find_modules(arg, dirname, files):
    for filename in files:
        if filename.endswith('.py') and filename != '__init__.py':
            arg["%s.%s" % (dirname.replace('/', '.'),
                           filename[:-3])] = True


class LocalBuildDoc(setup_command.BuildDoc):

    builders = ['html']
    command_name = 'build_sphinx'
    sphinx_initialized = False

    def _get_source_dir(self):
        option_dict = self.distribution.get_option_dict('build_sphinx')
        pbr_option_dict = self.distribution.get_option_dict('pbr')
        _, api_doc_dir = pbr_option_dict.get('api_doc_dir', (None, 'api'))
        if 'source_dir' in option_dict:
            source_dir = os.path.join(option_dict['source_dir'][1],
                                      api_doc_dir)
        else:
            source_dir = 'doc/source/' + api_doc_dir
        if not os.path.exists(source_dir):
            os.makedirs(source_dir)
        return source_dir

    def generate_autoindex(self, excluded_modules=None):
        log.info("[pbr] Autodocumenting from %s"
                 % os.path.abspath(os.curdir))
        modules = {}
        source_dir = self._get_source_dir()
        for pkg in self.distribution.packages:
            if '.' not in pkg:
                for dirpath, dirnames, files in os.walk(pkg):
                    _find_modules(modules, dirpath, files)

        def include(module):
            return not any(fnmatch.fnmatch(module, pat)
                           for pat in excluded_modules)

        module_list = sorted(mod for mod in modules.keys() if include(mod))
        autoindex_filename = os.path.join(source_dir, 'autoindex.rst')
        with open(autoindex_filename, 'w') as autoindex:
            autoindex.write(""".. toctree::
   :maxdepth: 1

""")
            for module in module_list:
                output_filename = os.path.join(source_dir,
                                               "%s.rst" % module)
                heading = "The :mod:`%s` Module" % module
                underline = "=" * len(heading)
                values = dict(module=module, heading=heading,
                              underline=underline)

                log.info("[pbr] Generating %s"
                         % output_filename)
                with open(output_filename, 'w') as output_file:
                    output_file.write(_rst_template % values)
                autoindex.write("   %s.rst\n" % module)

    def _sphinx_tree(self):
            source_dir = self._get_source_dir()
            cmd = ['apidoc', '.', '-H', 'Modules', '-o', source_dir]
            apidoc.main(cmd + self.autodoc_tree_excludes)

    def _sphinx_run(self):
        if not self.verbose:
            status_stream = cStringIO.StringIO()
        else:
            status_stream = sys.stdout
        confoverrides = {}
        if self.project:
            confoverrides['project'] = self.project
        if self.version:
            confoverrides['version'] = self.version
        if self.release:
            confoverrides['release'] = self.release
        if self.today:
            confoverrides['today'] = self.today
        if self.sphinx_initialized:
            confoverrides['suppress_warnings'] = [
                'app.add_directive', 'app.add_role',
                'app.add_generic_role', 'app.add_node',
                'image.nonlocal_uri',
            ]
        app = application.Sphinx(
            self.source_dir, self.config_dir,
            self.builder_target_dir, self.doctree_dir,
            self.builder, confoverrides, status_stream,
            freshenv=self.fresh_env, warningiserror=self.warning_is_error)
        self.sphinx_initialized = True

        try:
            app.build(force_all=self.all_files)
        except Exception as err:
            from docutils import utils
            if isinstance(err, utils.SystemMessage):
                sys.stder.write('reST markup error:\n')
                sys.stderr.write(err.args[0].encode('ascii',
                                                    'backslashreplace'))
                sys.stderr.write('\n')
            else:
                raise

        if self.link_index:
            src = app.config.master_doc + app.builder.out_suffix
            dst = app.builder.get_outfilename('index')
            os.symlink(src, dst)

    def run(self):
        option_dict = self.distribution.get_option_dict('pbr')
        if git._git_is_installed():
            git.write_git_changelog(option_dict=option_dict)
            git.generate_authors(option_dict=option_dict)
        tree_index = options.get_boolean_option(option_dict,
                                                'autodoc_tree_index_modules',
                                                'AUTODOC_TREE_INDEX_MODULES')
        auto_index = options.get_boolean_option(option_dict,
                                                'autodoc_index_modules',
                                                'AUTODOC_INDEX_MODULES')
        if not os.getenv('SPHINX_DEBUG'):
            # NOTE(afazekas): These options can be used together,
            # but they do a very similar thing in a different way
            if tree_index:
                self._sphinx_tree()
            if auto_index:
                self.generate_autoindex(
                    set(option_dict.get(
                        "autodoc_exclude_modules",
                        [None, ""])[1].split()))

        # TODO(stephenfin): Deprecate this functionality once we depend on
        # Sphinx 1.6, which includes a similar feature, in g-r
        # https://github.com/sphinx-doc/sphinx/pull/3476
        self.finalize_options()
        if hasattr(self, "builder_target_dirs"):
            # Sphinx >= 1.6.1
            return setup_command.BuildDoc.run(self)
        # Sphinx < 1.6
        for builder in self.builders:
            self.builder = builder
            self.finalize_options()
            self._sphinx_run()

    def initialize_options(self):
        # Not a new style class, super keyword does not work.
        setup_command.BuildDoc.initialize_options(self)

        # NOTE(dstanek): exclude setup.py from the autodoc tree index
        # builds because all projects will have an issue with it
        self.autodoc_tree_excludes = ['setup.py']

    def finalize_options(self):
        # Not a new style class, super keyword does not work.
        setup_command.BuildDoc.finalize_options(self)

        # Handle builder option from command line - override cfg
        option_dict = self.distribution.get_option_dict('build_sphinx')
        if 'command line' in option_dict.get('builder', [[]])[0]:
            self.builders = option_dict['builder'][1]
        # Allow builders to be configurable - as a comma separated list.
        if not isinstance(self.builders, list) and self.builders:
            self.builders = self.builders.split(',')

        self.project = self.distribution.get_name()
        self.version = self.distribution.get_version()
        self.release = self.distribution.get_version()

        # NOTE(dstanek): check for autodoc tree exclusion overrides
        # in the setup.cfg
        opt = 'autodoc_tree_excludes'
        option_dict = self.distribution.get_option_dict('pbr')
        if opt in option_dict:
            self.autodoc_tree_excludes = option_dict[opt][1]
            self.ensure_string_list(opt)

        # handle Sphinx < 1.5.0
        if not hasattr(self, 'warning_is_error'):
            self.warning_is_error = False
