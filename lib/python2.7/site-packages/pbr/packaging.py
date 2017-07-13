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

"""
Utilities with minimum-depends for use in setup.py
"""

from __future__ import unicode_literals

from distutils.command import install as du_install
from distutils import log
import email
import email.errors
import os
import re
import sys

import pkg_resources
import setuptools
from setuptools.command import develop
from setuptools.command import easy_install
from setuptools.command import egg_info
from setuptools.command import install
from setuptools.command import install_scripts
from setuptools.command import sdist

from pbr import extra_files
from pbr import git
from pbr import options
import pbr.pbr_json
from pbr import testr_command
from pbr import version

REQUIREMENTS_FILES = ('requirements.txt', 'tools/pip-requires')
TEST_REQUIREMENTS_FILES = ('test-requirements.txt', 'tools/test-requires')


def get_requirements_files():
    files = os.environ.get("PBR_REQUIREMENTS_FILES")
    if files:
        return tuple(f.strip() for f in files.split(','))
    # Returns a list composed of:
    # - REQUIREMENTS_FILES with -py2 or -py3 in the name
    #   (e.g. requirements-py3.txt)
    # - REQUIREMENTS_FILES
    return (list(map(('-py' + str(sys.version_info[0])).join,
                     map(os.path.splitext, REQUIREMENTS_FILES)))
            + list(REQUIREMENTS_FILES))


def append_text_list(config, key, text_list):
    """Append a \n separated list to possibly existing value."""
    new_value = []
    current_value = config.get(key, "")
    if current_value:
        new_value.append(current_value)
    new_value.extend(text_list)
    config[key] = '\n'.join(new_value)


def _any_existing(file_list):
    return [f for f in file_list if os.path.exists(f)]


# Get requirements from the first file that exists
def get_reqs_from_files(requirements_files):
    for requirements_file in _any_existing(requirements_files):
        with open(requirements_file, 'r') as fil:
            return fil.read().split('\n')
    return []


def parse_requirements(requirements_files=None, strip_markers=False):

    if requirements_files is None:
        requirements_files = get_requirements_files()

    def egg_fragment(match):
        # take a versioned egg fragment and return a
        # versioned package requirement e.g.
        # nova-1.2.3 becomes nova>=1.2.3
        return re.sub(r'([\w.]+)-([\w.-]+)',
                      r'\1>=\2',
                      match.groups()[-1])

    requirements = []
    for line in get_reqs_from_files(requirements_files):
        # Ignore comments
        if (not line.strip()) or line.startswith('#'):
            continue

        # Ignore index URL lines
        if re.match(r'^\s*(-i|--index-url|--extra-index-url).*', line):
            continue

        # Handle nested requirements files such as:
        # -r other-requirements.txt
        if line.startswith('-r'):
            req_file = line.partition(' ')[2]
            requirements += parse_requirements(
                [req_file], strip_markers=strip_markers)
            continue

        try:
            project_name = pkg_resources.Requirement.parse(line).project_name
        except ValueError:
            project_name = None

        # For the requirements list, we need to inject only the portion
        # after egg= so that distutils knows the package it's looking for
        # such as:
        # -e git://github.com/openstack/nova/master#egg=nova
        # -e git://github.com/openstack/nova/master#egg=nova-1.2.3
        if re.match(r'\s*-e\s+', line):
            line = re.sub(r'\s*-e\s+.*#egg=(.*)$', egg_fragment, line)
        # such as:
        # http://github.com/openstack/nova/zipball/master#egg=nova
        # http://github.com/openstack/nova/zipball/master#egg=nova-1.2.3
        elif re.match(r'\s*(https?|git(\+(https|ssh))?):', line):
            line = re.sub(r'\s*(https?|git(\+(https|ssh))?):.*#egg=(.*)$',
                          egg_fragment, line)
        # -f lines are for index locations, and don't get used here
        elif re.match(r'\s*-f\s+', line):
            line = None
            reason = 'Index Location'

        if line is not None:
            line = re.sub('#.*$', '', line)
            if strip_markers:
                semi_pos = line.find(';')
                if semi_pos < 0:
                    semi_pos = None
                line = line[:semi_pos]
            requirements.append(line)
        else:
            log.info(
                '[pbr] Excluding %s: %s' % (project_name, reason))

    return requirements


def parse_dependency_links(requirements_files=None):
    if requirements_files is None:
        requirements_files = get_requirements_files()
    dependency_links = []
    # dependency_links inject alternate locations to find packages listed
    # in requirements
    for line in get_reqs_from_files(requirements_files):
        # skip comments and blank lines
        if re.match(r'(\s*#)|(\s*$)', line):
            continue
        # lines with -e or -f need the whole line, minus the flag
        if re.match(r'\s*-[ef]\s+', line):
            dependency_links.append(re.sub(r'\s*-[ef]\s+', '', line))
        # lines that are only urls can go in unmolested
        elif re.match(r'\s*(https?|git(\+(https|ssh))?):', line):
            dependency_links.append(line)
    return dependency_links


class InstallWithGit(install.install):
    """Extracts ChangeLog and AUTHORS from git then installs.

    This is useful for e.g. readthedocs where the package is
    installed and then docs built.
    """

    command_name = 'install'

    def run(self):
        _from_git(self.distribution)
        return install.install.run(self)


class LocalInstall(install.install):
    """Runs python setup.py install in a sensible manner.

    Force a non-egg installed in the manner of
    single-version-externally-managed, which allows us to install manpages
    and config files.
    """

    command_name = 'install'

    def run(self):
        _from_git(self.distribution)
        return du_install.install.run(self)


class TestrTest(testr_command.Testr):
    """Make setup.py test do the right thing."""

    command_name = 'test'

    def run(self):
        # Can't use super - base class old-style class
        testr_command.Testr.run(self)


class LocalRPMVersion(setuptools.Command):
    __doc__ = """Output the rpm *compatible* version string of this package"""
    description = __doc__

    user_options = []
    command_name = "rpm_version"

    def run(self):
        log.info("[pbr] Extracting rpm version")
        name = self.distribution.get_name()
        print(version.VersionInfo(name).semantic_version().rpm_string())

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass


class LocalDebVersion(setuptools.Command):
    __doc__ = """Output the deb *compatible* version string of this package"""
    description = __doc__

    user_options = []
    command_name = "deb_version"

    def run(self):
        log.info("[pbr] Extracting deb version")
        name = self.distribution.get_name()
        print(version.VersionInfo(name).semantic_version().debian_string())

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass


def have_testr():
    return testr_command.have_testr


try:
    from nose import commands

    class NoseTest(commands.nosetests):
        """Fallback test runner if testr is a no-go."""

        command_name = 'test'

        def run(self):
            # Can't use super - base class old-style class
            commands.nosetests.run(self)

    _have_nose = True

except ImportError:
    _have_nose = False


def have_nose():
    return _have_nose

_wsgi_text = """#PBR Generated from %(group)r

import threading

from %(module_name)s import %(import_target)s

if __name__ == "__main__":
    import argparse
    import socket
    import sys
    import wsgiref.simple_server as wss

    my_ip = socket.gethostbyname(socket.gethostname())

    parser = argparse.ArgumentParser(
        description=%(import_target)s.__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
        usage='%%(prog)s [-h] [--port PORT] [--host IP] -- [passed options]')
    parser.add_argument('--port', '-p', type=int, default=8000,
                        help='TCP port to listen on')
    parser.add_argument('--host', '-b', default='',
                        help='IP to bind the server to')
    parser.add_argument('args',
                        nargs=argparse.REMAINDER,
                        metavar='-- [passed options]',
                        help="'--' is the separator of the arguments used "
                        "to start the WSGI server and the arguments passed "
                        "to the WSGI application.")
    args = parser.parse_args()
    if args.args:
        if args.args[0] == '--':
            args.args.pop(0)
        else:
            parser.error("unrecognized arguments: %%s" %% ' '.join(args.args))
    sys.argv[1:] = args.args
    server = wss.make_server(args.host, args.port, %(invoke_target)s())

    print("*" * 80)
    print("STARTING test server %(module_name)s.%(invoke_target)s")
    url = "http://%%s:%%d/" %% (server.server_name, server.server_port)
    print("Available at %%s" %% url)
    print("DANGER! For testing only, do not use in production")
    print("*" * 80)
    sys.stdout.flush()

    server.serve_forever()
else:
    application = None
    app_lock = threading.Lock()

    with app_lock:
        if application is None:
            application = %(invoke_target)s()

"""

_script_text = """# PBR Generated from %(group)r

import sys

from %(module_name)s import %(import_target)s


if __name__ == "__main__":
    sys.exit(%(invoke_target)s())
"""


# the following allows us to specify different templates per entry
# point group when generating pbr scripts.
ENTRY_POINTS_MAP = {
    'console_scripts': _script_text,
    'gui_scripts': _script_text,
    'wsgi_scripts': _wsgi_text
}


def generate_script(group, entry_point, header, template):
    """Generate the script based on the template.

    :param str group:
        The entry-point group name, e.g., "console_scripts".
    :param str header:
        The first line of the script, e.g., "!#/usr/bin/env python".
    :param str template:
        The script template.
    :returns:
        The templated script content
    :rtype:
        str
    """
    if not entry_point.attrs or len(entry_point.attrs) > 2:
        raise ValueError("Script targets must be of the form "
                         "'func' or 'Class.class_method'.")
    script_text = template % dict(
        group=group,
        module_name=entry_point.module_name,
        import_target=entry_point.attrs[0],
        invoke_target='.'.join(entry_point.attrs),
    )
    return header + script_text


def override_get_script_args(
        dist, executable=os.path.normpath(sys.executable), is_wininst=False):
    """Override entrypoints console_script."""
    header = easy_install.get_script_header("", executable, is_wininst)
    for group, template in ENTRY_POINTS_MAP.items():
        for name, ep in dist.get_entry_map(group).items():
            yield (name, generate_script(group, ep, header, template))


class LocalDevelop(develop.develop):

    command_name = 'develop'

    def install_wrapper_scripts(self, dist):
        if sys.platform == 'win32':
            return develop.develop.install_wrapper_scripts(self, dist)
        if not self.exclude_scripts:
            for args in override_get_script_args(dist):
                self.write_script(*args)


class LocalInstallScripts(install_scripts.install_scripts):
    """Intercepts console scripts entry_points."""
    command_name = 'install_scripts'

    def _make_wsgi_scripts_only(self, dist, executable, is_wininst):
        header = easy_install.get_script_header("", executable, is_wininst)
        wsgi_script_template = ENTRY_POINTS_MAP['wsgi_scripts']
        for name, ep in dist.get_entry_map('wsgi_scripts').items():
            content = generate_script(
                'wsgi_scripts', ep, header, wsgi_script_template)
            self.write_script(name, content)

    def run(self):
        import distutils.command.install_scripts

        self.run_command("egg_info")
        if self.distribution.scripts:
            # run first to set up self.outfiles
            distutils.command.install_scripts.install_scripts.run(self)
        else:
            self.outfiles = []

        ei_cmd = self.get_finalized_command("egg_info")
        dist = pkg_resources.Distribution(
            ei_cmd.egg_base,
            pkg_resources.PathMetadata(ei_cmd.egg_base, ei_cmd.egg_info),
            ei_cmd.egg_name, ei_cmd.egg_version,
        )
        bs_cmd = self.get_finalized_command('build_scripts')
        executable = getattr(
            bs_cmd, 'executable', easy_install.sys_executable)
        is_wininst = getattr(
            self.get_finalized_command("bdist_wininst"), '_is_running', False
        )

        if 'bdist_wheel' in self.distribution.have_run:
            # We're building a wheel which has no way of generating mod_wsgi
            # scripts for us. Let's build them.
            # NOTE(sigmavirus24): This needs to happen here because, as the
            # comment below indicates, no_ep is True when building a wheel.
            self._make_wsgi_scripts_only(dist, executable, is_wininst)

        if self.no_ep:
            # no_ep is True if we're installing into an .egg file or building
            # a .whl file, in those cases, we do not want to build all of the
            # entry-points listed for this package.
            return

        if os.name != 'nt':
            get_script_args = override_get_script_args
        else:
            get_script_args = easy_install.get_script_args
            executable = '"%s"' % executable

        for args in get_script_args(dist, executable, is_wininst):
            self.write_script(*args)


class LocalManifestMaker(egg_info.manifest_maker):
    """Add any files that are in git and some standard sensible files."""

    def _add_pbr_defaults(self):
        for template_line in [
            'include AUTHORS',
            'include ChangeLog',
            'exclude .gitignore',
            'exclude .gitreview',
            'global-exclude *.pyc'
        ]:
            self.filelist.process_template_line(template_line)

    def add_defaults(self):
        option_dict = self.distribution.get_option_dict('pbr')

        sdist.sdist.add_defaults(self)
        self.filelist.append(self.template)
        self.filelist.append(self.manifest)
        self.filelist.extend(extra_files.get_extra_files())
        should_skip = options.get_boolean_option(option_dict, 'skip_git_sdist',
                                                 'SKIP_GIT_SDIST')
        if not should_skip:
            rcfiles = git._find_git_files()
            if rcfiles:
                self.filelist.extend(rcfiles)
        elif os.path.exists(self.manifest):
            self.read_manifest()
        ei_cmd = self.get_finalized_command('egg_info')
        self._add_pbr_defaults()
        self.filelist.include_pattern("*", prefix=ei_cmd.egg_info)


class LocalEggInfo(egg_info.egg_info):
    """Override the egg_info command to regenerate SOURCES.txt sensibly."""

    command_name = 'egg_info'

    def find_sources(self):
        """Generate SOURCES.txt only if there isn't one already.

        If we are in an sdist command, then we always want to update
        SOURCES.txt. If we are not in an sdist command, then it doesn't
        matter one flip, and is actually destructive.
        However, if we're in a git context, it's always the right thing to do
        to recreate SOURCES.txt
        """
        manifest_filename = os.path.join(self.egg_info, "SOURCES.txt")
        if (not os.path.exists(manifest_filename) or
                os.path.exists('.git') or
                'sdist' in sys.argv):
            log.info("[pbr] Processing SOURCES.txt")
            mm = LocalManifestMaker(self.distribution)
            mm.manifest = manifest_filename
            mm.run()
            self.filelist = mm.filelist
        else:
            log.info("[pbr] Reusing existing SOURCES.txt")
            self.filelist = egg_info.FileList()
            for entry in open(manifest_filename, 'r').read().split('\n'):
                self.filelist.append(entry)


def _from_git(distribution):
    option_dict = distribution.get_option_dict('pbr')
    changelog = git._iter_log_oneline()
    if changelog:
        changelog = git._iter_changelog(changelog)
    git.write_git_changelog(option_dict=option_dict, changelog=changelog)
    git.generate_authors(option_dict=option_dict)


class LocalSDist(sdist.sdist):
    """Builds the ChangeLog and Authors files from VC first."""

    command_name = 'sdist'

    def run(self):
        _from_git(self.distribution)
        # sdist.sdist is an old style class, can't use super()
        sdist.sdist.run(self)

try:
    from pbr import builddoc
    _have_sphinx = True
    # Import the symbols from their new home so the package API stays
    # compatible.
    LocalBuildDoc = builddoc.LocalBuildDoc
except ImportError:
    _have_sphinx = False
    LocalBuildDoc = None


def have_sphinx():
    return _have_sphinx


def _get_increment_kwargs(git_dir, tag):
    """Calculate the sort of semver increment needed from git history.

    Every commit from HEAD to tag is consider for Sem-Ver metadata lines.
    See the pbr docs for their syntax.

    :return: a dict of kwargs for passing into SemanticVersion.increment.
    """
    result = {}
    if tag:
        version_spec = tag + "..HEAD"
    else:
        version_spec = "HEAD"
    changelog = git._run_git_command(['log', version_spec], git_dir)
    header_len = len('    sem-ver:')
    commands = [line[header_len:].strip() for line in changelog.split('\n')
                if line.lower().startswith('    sem-ver:')]
    symbols = set()
    for command in commands:
        symbols.update([symbol.strip() for symbol in command.split(',')])

    def _handle_symbol(symbol, symbols, impact):
        if symbol in symbols:
            result[impact] = True
            symbols.discard(symbol)
    _handle_symbol('bugfix', symbols, 'patch')
    _handle_symbol('feature', symbols, 'minor')
    _handle_symbol('deprecation', symbols, 'minor')
    _handle_symbol('api-break', symbols, 'major')
    for symbol in symbols:
        log.info('[pbr] Unknown Sem-Ver symbol %r' % symbol)
    # We don't want patch in the kwargs since it is not a keyword argument -
    # its the default minimum increment.
    result.pop('patch', None)
    return result


def _get_revno_and_last_tag(git_dir):
    """Return the commit data about the most recent tag.

    We use git-describe to find this out, but if there are no
    tags then we fall back to counting commits since the beginning
    of time.
    """
    changelog = git._iter_log_oneline(git_dir=git_dir)
    row_count = 0
    for row_count, (ignored, tag_set, ignored) in enumerate(changelog):
        version_tags = set()
        semver_to_tag = dict()
        for tag in list(tag_set):
            try:
                semver = version.SemanticVersion.from_pip_string(tag)
                semver_to_tag[semver] = tag
                version_tags.add(semver)
            except Exception:
                pass
        if version_tags:
            return semver_to_tag[max(version_tags)], row_count
    return "", row_count


def _get_version_from_git_target(git_dir, target_version):
    """Calculate a version from a target version in git_dir.

    This is used for untagged versions only. A new version is calculated as
    necessary based on git metadata - distance to tags, current hash, contents
    of commit messages.

    :param git_dir: The git directory we're working from.
    :param target_version: If None, the last tagged version (or 0 if there are
        no tags yet) is incremented as needed to produce an appropriate target
        version following semver rules. Otherwise target_version is used as a
        constraint - if semver rules would result in a newer version then an
        exception is raised.
    :return: A semver version object.
    """
    tag, distance = _get_revno_and_last_tag(git_dir)
    last_semver = version.SemanticVersion.from_pip_string(tag or '0')
    if distance == 0:
        new_version = last_semver
    else:
        new_version = last_semver.increment(
            **_get_increment_kwargs(git_dir, tag))
    if target_version is not None and new_version > target_version:
        raise ValueError(
            "git history requires a target version of %(new)s, but target "
            "version is %(target)s" %
            dict(new=new_version, target=target_version))
    if distance == 0:
        return last_semver
    new_dev = new_version.to_dev(distance)
    if target_version is not None:
        target_dev = target_version.to_dev(distance)
        if target_dev > new_dev:
            return target_dev
    return new_dev


def _get_version_from_git(pre_version=None):
    """Calculate a version string from git.

    If the revision is tagged, return that. Otherwise calculate a semantic
    version description of the tree.

    The number of revisions since the last tag is included in the dev counter
    in the version for untagged versions.

    :param pre_version: If supplied use this as the target version rather than
        inferring one from the last tag + commit messages.
    """
    git_dir = git._run_git_functions()
    if git_dir:
        try:
            tagged = git._run_git_command(
                ['describe', '--exact-match'], git_dir,
                throw_on_error=True).replace('-', '.')
            target_version = version.SemanticVersion.from_pip_string(tagged)
        except Exception:
            if pre_version:
                # not released yet - use pre_version as the target
                target_version = version.SemanticVersion.from_pip_string(
                    pre_version)
            else:
                # not released yet - just calculate from git history
                target_version = None
        result = _get_version_from_git_target(git_dir, target_version)
        return result.release_string()
    # If we don't know the version, return an empty string so at least
    # the downstream users of the value always have the same type of
    # object to work with.
    try:
        return unicode()
    except NameError:
        return ''


def _get_version_from_pkg_metadata(package_name):
    """Get the version from package metadata if present.

    This looks for PKG-INFO if present (for sdists), and if not looks
    for METADATA (for wheels) and failing that will return None.
    """
    pkg_metadata_filenames = ['PKG-INFO', 'METADATA']
    pkg_metadata = {}
    for filename in pkg_metadata_filenames:
        try:
            pkg_metadata_file = open(filename, 'r')
        except (IOError, OSError):
            continue
        try:
            pkg_metadata = email.message_from_file(pkg_metadata_file)
        except email.errors.MessageError:
            continue

    # Check to make sure we're in our own dir
    if pkg_metadata.get('Name', None) != package_name:
        return None
    return pkg_metadata.get('Version', None)


def get_version(package_name, pre_version=None):
    """Get the version of the project.

    First, try getting it from PKG-INFO or METADATA, if it exists. If it does,
    that means we're in a distribution tarball or that install has happened.
    Otherwise, if there is no PKG-INFO or METADATA file, pull the version
    from git.

    We do not support setup.py version sanity in git archive tarballs, nor do
    we support packagers directly sucking our git repo into theirs. We expect
    that a source tarball be made from our git repo - or that if someone wants
    to make a source tarball from a fork of our repo with additional tags in it
    that they understand and desire the results of doing that.

    :param pre_version: The version field from setup.cfg - if set then this
        version will be the next release.
    """
    version = os.environ.get(
        "PBR_VERSION",
        os.environ.get("OSLO_PACKAGE_VERSION", None))
    if version:
        return version
    version = _get_version_from_pkg_metadata(package_name)
    if version:
        return version
    version = _get_version_from_git(pre_version)
    # Handle http://bugs.python.org/issue11638
    # version will either be an empty unicode string or a valid
    # unicode version string, but either way it's unicode and needs to
    # be encoded.
    if sys.version_info[0] == 2:
        version = version.encode('utf-8')
    if version:
        return version
    raise Exception("Versioning for this project requires either an sdist"
                    " tarball, or access to an upstream git repository."
                    " It's also possible that there is a mismatch between"
                    " the package name in setup.cfg and the argument given"
                    " to pbr.version.VersionInfo. Project name {name} was"
                    " given, but was not able to be found.".format(
                        name=package_name))


# This is added because pbr uses pbr to install itself. That means that
# any changes to the egg info writer entrypoints must be forward and
# backward compatible. This maintains the pbr.packaging.write_pbr_json
# path.
write_pbr_json = pbr.pbr_json.write_pbr_json
