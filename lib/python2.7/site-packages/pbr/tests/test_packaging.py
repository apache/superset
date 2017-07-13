# Copyright (c) 2013 New Dream Network, LLC (DreamHost)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
# implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Copyright (C) 2013 Association of Universities for Research in Astronomy
#                    (AURA)
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#     1. Redistributions of source code must retain the above copyright
#        notice, this list of conditions and the following disclaimer.
#
#     2. Redistributions in binary form must reproduce the above
#        copyright notice, this list of conditions and the following
#        disclaimer in the documentation and/or other materials provided
#        with the distribution.
#
#     3. The name of AURA and its representatives may not be used to
#        endorse or promote products derived from this software without
#        specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY AURA ``AS IS'' AND ANY EXPRESS OR IMPLIED
# WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL AURA BE LIABLE FOR ANY DIRECT, INDIRECT,
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
# BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS

import email
import email.errors
import imp
import os
import re
import sysconfig
import tempfile
import textwrap

import fixtures
import mock
import pkg_resources
import six
import testtools
from testtools import matchers
import virtualenv
import wheel.install

from pbr import git
from pbr import packaging
from pbr.tests import base


PBR_ROOT = os.path.abspath(os.path.join(__file__, '..', '..', '..'))


class TestRepo(fixtures.Fixture):
    """A git repo for testing with.

    Use of TempHomeDir with this fixture is strongly recommended as due to the
    lack of config --local in older gits, it will write to the users global
    configuration without TempHomeDir.
    """

    def __init__(self, basedir):
        super(TestRepo, self).__init__()
        self._basedir = basedir

    def setUp(self):
        super(TestRepo, self).setUp()
        base._run_cmd(['git', 'init', '.'], self._basedir)
        base._config_git()
        base._run_cmd(['git', 'add', '.'], self._basedir)

    def commit(self, message_content='test commit'):
        files = len(os.listdir(self._basedir))
        path = self._basedir + '/%d' % files
        open(path, 'wt').close()
        base._run_cmd(['git', 'add', path], self._basedir)
        base._run_cmd(['git', 'commit', '-m', message_content], self._basedir)

    def uncommit(self):
        base._run_cmd(['git', 'reset', '--hard', 'HEAD^'], self._basedir)

    def tag(self, version):
        base._run_cmd(
            ['git', 'tag', '-sm', 'test tag', version], self._basedir)


class GPGKeyFixture(fixtures.Fixture):
    """Creates a GPG key for testing.

    It's recommended that this be used in concert with a unique home
    directory.
    """

    def setUp(self):
        super(GPGKeyFixture, self).setUp()
        tempdir = self.useFixture(fixtures.TempDir())
        gnupg_version_re = re.compile('^gpg\s.*\s([\d+])\.([\d+])\.([\d+])')
        gnupg_version = base._run_cmd(['gpg', '--version'], tempdir.path)
        for line in gnupg_version[0].split('\n'):
            gnupg_version = gnupg_version_re.match(line)
            if gnupg_version:
                gnupg_version = (int(gnupg_version.group(1)),
                                 int(gnupg_version.group(2)),
                                 int(gnupg_version.group(3)))
                break
        else:
            if gnupg_version is None:
                gnupg_version = (0, 0, 0)
        config_file = tempdir.path + '/key-config'
        f = open(config_file, 'wt')
        try:
            if gnupg_version[0] == 2 and gnupg_version[1] >= 1:
                f.write("""
                %no-protection
                %transient-key
                """)
            f.write("""
            %no-ask-passphrase
            Key-Type: RSA
            Name-Real: Example Key
            Name-Comment: N/A
            Name-Email: example@example.com
            Expire-Date: 2d
            Preferences: (setpref)
            %commit
            """)
        finally:
            f.close()
        # Note that --quick-random (--debug-quick-random in GnuPG 2.x)
        # does not have a corresponding preferences file setting and
        # must be passed explicitly on the command line instead
        if gnupg_version[0] == 1:
            gnupg_random = '--quick-random'
        elif gnupg_version[0] >= 2:
            gnupg_random = '--debug-quick-random'
        else:
            gnupg_random = ''
        base._run_cmd(
            ['gpg', '--gen-key', '--batch', gnupg_random, config_file],
            tempdir.path)


class Venv(fixtures.Fixture):
    """Create a virtual environment for testing with.

    :attr path: The path to the environment root.
    :attr python: The path to the python binary in the environment.
    """

    def __init__(self, reason, modules=(), pip_cmd=None):
        """Create a Venv fixture.

        :param reason: A human readable string to bake into the venv
            file path to aid diagnostics in the case of failures.
        :param modules: A list of modules to install, defaults to latest
            pip, wheel, and the working copy of PBR.
        :attr pip_cmd: A list to override the default pip_cmd passed to
            python for installing base packages.
        """
        self._reason = reason
        if modules == ():
            pbr = 'file://%s#egg=pbr' % PBR_ROOT
            modules = ['pip', 'wheel', pbr]
        self.modules = modules
        if pip_cmd is None:
            self.pip_cmd = ['-m', 'pip', 'install']
        else:
            self.pip_cmd = pip_cmd

    def _setUp(self):
        path = self.useFixture(fixtures.TempDir()).path
        virtualenv.create_environment(path, clear=True)
        python = os.path.join(path, 'bin', 'python')
        command = [python] + self.pip_cmd + ['-U']
        if self.modules and len(self.modules) > 0:
            command.extend(self.modules)
            self.useFixture(base.CapturedSubprocess(
                'mkvenv-' + self._reason, command))
        self.addCleanup(delattr, self, 'path')
        self.addCleanup(delattr, self, 'python')
        self.path = path
        self.python = python
        return path, python


class CreatePackages(fixtures.Fixture):
    """Creates packages from dict with defaults

        :param package_dirs: A dict of package name to directory strings
        {'pkg_a': '/tmp/path/to/tmp/pkg_a', 'pkg_b': '/tmp/path/to/tmp/pkg_b'}
    """

    defaults = {
        'setup.py': textwrap.dedent(six.u("""\
            #!/usr/bin/env python
            import setuptools
            setuptools.setup(
                setup_requires=['pbr'],
                pbr=True,
            )
        """)),
        'setup.cfg': textwrap.dedent(six.u("""\
            [metadata]
            name = {pkg_name}
        """))
    }

    def __init__(self, packages):
        """Creates packages from dict with defaults

            :param packages: a dict where the keys are the package name and a
            value that is a second dict that may be empty, containing keys of
            filenames and a string value of the contents.
            {'package-a': {'requirements.txt': 'string', 'setup.cfg': 'string'}
        """
        self.packages = packages

    def _writeFile(self, directory, file_name, contents):
        path = os.path.abspath(os.path.join(directory, file_name))
        path_dir = os.path.dirname(path)
        if not os.path.exists(path_dir):
            if path_dir.startswith(directory):
                os.makedirs(path_dir)
            else:
                raise ValueError
        with open(path, 'wt') as f:
            f.write(contents)

    def _setUp(self):
        tmpdir = self.useFixture(fixtures.TempDir()).path
        package_dirs = {}
        for pkg_name in self.packages:
            pkg_path = os.path.join(tmpdir, pkg_name)
            package_dirs[pkg_name] = pkg_path
            os.mkdir(pkg_path)
            for cf in ['setup.py', 'setup.cfg']:
                if cf in self.packages[pkg_name]:
                    contents = self.packages[pkg_name].pop(cf)
                else:
                    contents = self.defaults[cf].format(pkg_name=pkg_name)
                self._writeFile(pkg_path, cf, contents)

            for cf in self.packages[pkg_name]:
                self._writeFile(pkg_path, cf, self.packages[pkg_name][cf])
            self.useFixture(TestRepo(pkg_path)).commit()
        self.addCleanup(delattr, self, 'package_dirs')
        self.package_dirs = package_dirs
        return package_dirs


class TestPackagingInGitRepoWithCommit(base.BaseTestCase):

    scenarios = [
        ('preversioned', dict(preversioned=True)),
        ('postversioned', dict(preversioned=False)),
    ]

    def setUp(self):
        super(TestPackagingInGitRepoWithCommit, self).setUp()
        self.repo = self.useFixture(TestRepo(self.package_dir))
        self.repo.commit()

    def test_authors(self):
        self.run_setup('sdist', allow_fail=False)
        # One commit, something should be in the authors list
        with open(os.path.join(self.package_dir, 'AUTHORS'), 'r') as f:
            body = f.read()
        self.assertNotEqual(body, '')

    def test_changelog(self):
        self.run_setup('sdist', allow_fail=False)
        with open(os.path.join(self.package_dir, 'ChangeLog'), 'r') as f:
            body = f.read()
        # One commit, something should be in the ChangeLog list
        self.assertNotEqual(body, '')

    def test_changelog_handles_astrisk(self):
        self.repo.commit(message_content="Allow *.openstack.org to work")
        self.run_setup('sdist', allow_fail=False)
        with open(os.path.join(self.package_dir, 'ChangeLog'), 'r') as f:
            body = f.read()
        self.assertIn('\*', body)

    def test_changelog_handles_dead_links_in_commit(self):
        self.repo.commit(message_content="See os_ for to_do about qemu_.")
        self.run_setup('sdist', allow_fail=False)
        with open(os.path.join(self.package_dir, 'ChangeLog'), 'r') as f:
            body = f.read()
        self.assertIn('os\_', body)
        self.assertIn('to\_do', body)
        self.assertIn('qemu\_', body)

    def test_changelog_handles_backticks(self):
        self.repo.commit(message_content="Allow `openstack.org` to `work")
        self.run_setup('sdist', allow_fail=False)
        with open(os.path.join(self.package_dir, 'ChangeLog'), 'r') as f:
            body = f.read()
        self.assertIn('\`', body)

    def test_manifest_exclude_honoured(self):
        self.run_setup('sdist', allow_fail=False)
        with open(os.path.join(
                self.package_dir,
                'pbr_testpackage.egg-info/SOURCES.txt'), 'r') as f:
            body = f.read()
        self.assertThat(
            body, matchers.Not(matchers.Contains('pbr_testpackage/extra.py')))
        self.assertThat(body, matchers.Contains('pbr_testpackage/__init__.py'))

    def test_install_writes_changelog(self):
        stdout, _, _ = self.run_setup(
            'install', '--root', self.temp_dir + 'installed',
            allow_fail=False)
        self.expectThat(stdout, matchers.Contains('Generating ChangeLog'))


class TestExtrafileInstallation(base.BaseTestCase):
    def test_install_glob(self):
        stdout, _, _ = self.run_setup(
            'install', '--root', self.temp_dir + 'installed',
            allow_fail=False)
        self.expectThat(
            stdout, matchers.Contains('copying data_files/a.txt'))
        self.expectThat(
            stdout, matchers.Contains('copying data_files/b.txt'))


class TestPackagingInGitRepoWithoutCommit(base.BaseTestCase):

    def setUp(self):
        super(TestPackagingInGitRepoWithoutCommit, self).setUp()
        self.useFixture(TestRepo(self.package_dir))
        self.run_setup('sdist', allow_fail=False)

    def test_authors(self):
        # No commits, no authors in list
        with open(os.path.join(self.package_dir, 'AUTHORS'), 'r') as f:
            body = f.read()
        self.assertEqual('\n', body)

    def test_changelog(self):
        # No commits, nothing should be in the ChangeLog list
        with open(os.path.join(self.package_dir, 'ChangeLog'), 'r') as f:
            body = f.read()
        self.assertEqual('CHANGES\n=======\n\n', body)


class TestPackagingWheels(base.BaseTestCase):

    def setUp(self):
        super(TestPackagingWheels, self).setUp()
        self.useFixture(TestRepo(self.package_dir))
        # Build the wheel
        self.run_setup('bdist_wheel', allow_fail=False)
        # Slowly construct the path to the generated whl
        dist_dir = os.path.join(self.package_dir, 'dist')
        relative_wheel_filename = os.listdir(dist_dir)[0]
        absolute_wheel_filename = os.path.join(
            dist_dir, relative_wheel_filename)
        wheel_file = wheel.install.WheelFile(absolute_wheel_filename)
        wheel_name = wheel_file.parsed_filename.group('namever')
        # Create a directory path to unpack the wheel to
        self.extracted_wheel_dir = os.path.join(dist_dir, wheel_name)
        # Extract the wheel contents to the directory we just created
        wheel_file.zipfile.extractall(self.extracted_wheel_dir)
        wheel_file.zipfile.close()

    def test_data_directory_has_wsgi_scripts(self):
        # Build the path to the scripts directory
        scripts_dir = os.path.join(
            self.extracted_wheel_dir, 'pbr_testpackage-0.0.data/scripts')
        self.assertTrue(os.path.exists(scripts_dir))
        scripts = os.listdir(scripts_dir)

        self.assertIn('pbr_test_wsgi', scripts)
        self.assertIn('pbr_test_wsgi_with_class', scripts)
        self.assertNotIn('pbr_test_cmd', scripts)
        self.assertNotIn('pbr_test_cmd_with_class', scripts)

    def test_generates_c_extensions(self):
        built_package_dir = os.path.join(
            self.extracted_wheel_dir, 'pbr_testpackage')
        static_object_filename = 'testext.so'
        soabi = get_soabi()
        if soabi:
            static_object_filename = 'testext.{0}.so'.format(soabi)
        static_object_path = os.path.join(
            built_package_dir, static_object_filename)

        self.assertTrue(os.path.exists(built_package_dir))
        self.assertTrue(os.path.exists(static_object_path))


class TestPackagingHelpers(testtools.TestCase):

    def test_generate_script(self):
        group = 'console_scripts'
        entry_point = pkg_resources.EntryPoint(
            name='test-ep',
            module_name='pbr.packaging',
            attrs=('LocalInstallScripts',))
        header = '#!/usr/bin/env fake-header\n'
        template = ('%(group)s %(module_name)s %(import_target)s '
                    '%(invoke_target)s')

        generated_script = packaging.generate_script(
            group, entry_point, header, template)

        expected_script = (
            '#!/usr/bin/env fake-header\nconsole_scripts pbr.packaging '
            'LocalInstallScripts LocalInstallScripts'
        )
        self.assertEqual(expected_script, generated_script)

    def test_generate_script_validates_expectations(self):
        group = 'console_scripts'
        entry_point = pkg_resources.EntryPoint(
            name='test-ep',
            module_name='pbr.packaging')
        header = '#!/usr/bin/env fake-header\n'
        template = ('%(group)s %(module_name)s %(import_target)s '
                    '%(invoke_target)s')
        self.assertRaises(
            ValueError, packaging.generate_script, group, entry_point, header,
            template)

        entry_point = pkg_resources.EntryPoint(
            name='test-ep',
            module_name='pbr.packaging',
            attrs=('attr1', 'attr2', 'attr3'))
        self.assertRaises(
            ValueError, packaging.generate_script, group, entry_point, header,
            template)


class TestPackagingInPlainDirectory(base.BaseTestCase):

    def setUp(self):
        super(TestPackagingInPlainDirectory, self).setUp()

    def test_authors(self):
        self.run_setup('sdist', allow_fail=False)
        # Not a git repo, no AUTHORS file created
        filename = os.path.join(self.package_dir, 'AUTHORS')
        self.assertFalse(os.path.exists(filename))

    def test_changelog(self):
        self.run_setup('sdist', allow_fail=False)
        # Not a git repo, no ChangeLog created
        filename = os.path.join(self.package_dir, 'ChangeLog')
        self.assertFalse(os.path.exists(filename))

    def test_install_no_ChangeLog(self):
        stdout, _, _ = self.run_setup(
            'install', '--root', self.temp_dir + 'installed',
            allow_fail=False)
        self.expectThat(
            stdout, matchers.Not(matchers.Contains('Generating ChangeLog')))


class TestPresenceOfGit(base.BaseTestCase):

    def testGitIsInstalled(self):
        with mock.patch.object(git,
                               '_run_shell_command') as _command:
            _command.return_value = 'git version 1.8.4.1'
            self.assertEqual(True, git._git_is_installed())

    def testGitIsNotInstalled(self):
        with mock.patch.object(git,
                               '_run_shell_command') as _command:
            _command.side_effect = OSError
            self.assertEqual(False, git._git_is_installed())


class TestIndexInRequirements(base.BaseTestCase):

    def test_index_in_requirement(self):
        tempdir = tempfile.mkdtemp()
        requirements = os.path.join(tempdir, 'requirements.txt')
        with open(requirements, 'w') as f:
            f.write('-i https://myindex.local')
            f.write('  --index-url https://myindex.local')
            f.write(' --extra-index-url https://myindex.local')
        result = packaging.parse_requirements([requirements])
        self.assertEqual([], result)


class TestNestedRequirements(base.BaseTestCase):

    def test_nested_requirement(self):
        tempdir = tempfile.mkdtemp()
        requirements = os.path.join(tempdir, 'requirements.txt')
        nested = os.path.join(tempdir, 'nested.txt')
        with open(requirements, 'w') as f:
            f.write('-r ' + nested)
        with open(nested, 'w') as f:
            f.write('pbr')
        result = packaging.parse_requirements([requirements])
        self.assertEqual(['pbr'], result)


class TestVersions(base.BaseTestCase):

    scenarios = [
        ('preversioned', dict(preversioned=True)),
        ('postversioned', dict(preversioned=False)),
    ]

    def setUp(self):
        super(TestVersions, self).setUp()
        self.repo = self.useFixture(TestRepo(self.package_dir))
        self.useFixture(GPGKeyFixture())
        self.useFixture(base.DiveDir(self.package_dir))

    def test_email_parsing_errors_are_handled(self):
        mocked_open = mock.mock_open()
        with mock.patch('pbr.packaging.open', mocked_open):
            with mock.patch('email.message_from_file') as message_from_file:
                message_from_file.side_effect = [
                    email.errors.MessageError('Test'),
                    {'Name': 'pbr_testpackage'}]
                version = packaging._get_version_from_pkg_metadata(
                    'pbr_testpackage')

        self.assertTrue(message_from_file.called)
        self.assertIsNone(version)

    def test_capitalized_headers(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit('Sem-Ver: api-break')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('2.0.0.dev1'))

    def test_capitalized_headers_partial(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit('Sem-ver: api-break')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('2.0.0.dev1'))

    def test_tagged_version_has_tag_version(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        version = packaging._get_version_from_git('1.2.3')
        self.assertEqual('1.2.3', version)

    def test_non_canonical_tagged_version_bump(self):
        self.repo.commit()
        self.repo.tag('1.4')
        self.repo.commit('Sem-Ver: api-break')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('2.0.0.dev1'))

    def test_untagged_version_has_dev_version_postversion(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit()
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.2.4.dev1'))

    def test_untagged_pre_release_has_pre_dev_version_postversion(self):
        self.repo.commit()
        self.repo.tag('1.2.3.0a1')
        self.repo.commit()
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.2.3.0a2.dev1'))

    def test_untagged_version_minor_bump(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit('sem-ver: deprecation')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.3.0.dev1'))

    def test_untagged_version_major_bump(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit('sem-ver: api-break')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('2.0.0.dev1'))

    def test_untagged_version_has_dev_version_preversion(self):
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit()
        version = packaging._get_version_from_git('1.2.5')
        self.assertThat(version, matchers.StartsWith('1.2.5.dev1'))

    def test_untagged_version_after_pre_has_dev_version_preversion(self):
        self.repo.commit()
        self.repo.tag('1.2.3.0a1')
        self.repo.commit()
        version = packaging._get_version_from_git('1.2.5')
        self.assertThat(version, matchers.StartsWith('1.2.5.dev1'))

    def test_untagged_version_after_rc_has_dev_version_preversion(self):
        self.repo.commit()
        self.repo.tag('1.2.3.0a1')
        self.repo.commit()
        version = packaging._get_version_from_git('1.2.3')
        self.assertThat(version, matchers.StartsWith('1.2.3.0a2.dev1'))

    def test_preversion_too_low_simple(self):
        # That is, the target version is either already released or not high
        # enough for the semver requirements given api breaks etc.
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit()
        # Note that we can't target 1.2.3 anymore - with 1.2.3 released we
        # need to be working on 1.2.4.
        err = self.assertRaises(
            ValueError, packaging._get_version_from_git, '1.2.3')
        self.assertThat(err.args[0], matchers.StartsWith('git history'))

    def test_preversion_too_low_semver_headers(self):
        # That is, the target version is either already released or not high
        # enough for the semver requirements given api breaks etc.
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit('sem-ver: feature')
        # Note that we can't target 1.2.4, the feature header means we need
        # to be working on 1.3.0 or above.
        err = self.assertRaises(
            ValueError, packaging._get_version_from_git, '1.2.4')
        self.assertThat(err.args[0], matchers.StartsWith('git history'))

    def test_get_kwargs_corner_cases(self):
        # No tags:
        git_dir = self.repo._basedir + '/.git'
        get_kwargs = lambda tag: packaging._get_increment_kwargs(git_dir, tag)

        def _check_combinations(tag):
            self.repo.commit()
            self.assertEqual(dict(), get_kwargs(tag))
            self.repo.commit('sem-ver: bugfix')
            self.assertEqual(dict(), get_kwargs(tag))
            self.repo.commit('sem-ver: feature')
            self.assertEqual(dict(minor=True), get_kwargs(tag))
            self.repo.uncommit()
            self.repo.commit('sem-ver: deprecation')
            self.assertEqual(dict(minor=True), get_kwargs(tag))
            self.repo.uncommit()
            self.repo.commit('sem-ver: api-break')
            self.assertEqual(dict(major=True), get_kwargs(tag))
            self.repo.commit('sem-ver: deprecation')
            self.assertEqual(dict(major=True, minor=True), get_kwargs(tag))
        _check_combinations('')
        self.repo.tag('1.2.3')
        _check_combinations('1.2.3')

    def test_invalid_tag_ignored(self):
        # Fix for bug 1356784 - we treated any tag as a version, not just those
        # that are valid versions.
        self.repo.commit()
        self.repo.tag('1')
        self.repo.commit()
        # when the tree is tagged and its wrong:
        self.repo.tag('badver')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.0.1.dev1'))
        # When the tree isn't tagged, we also fall through.
        self.repo.commit()
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.0.1.dev2'))
        # We don't fall through x.y versions
        self.repo.commit()
        self.repo.tag('1.2')
        self.repo.commit()
        self.repo.tag('badver2')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.2.1.dev1'))
        # Or x.y.z versions
        self.repo.commit()
        self.repo.tag('1.2.3')
        self.repo.commit()
        self.repo.tag('badver3')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.2.4.dev1'))
        # Or alpha/beta/pre versions
        self.repo.commit()
        self.repo.tag('1.2.4.0a1')
        self.repo.commit()
        self.repo.tag('badver4')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('1.2.4.0a2.dev1'))
        # Non-release related tags are ignored.
        self.repo.commit()
        self.repo.tag('2')
        self.repo.commit()
        self.repo.tag('non-release-tag/2014.12.16-1')
        version = packaging._get_version_from_git()
        self.assertThat(version, matchers.StartsWith('2.0.1.dev1'))

    def test_valid_tag_honoured(self):
        # Fix for bug 1370608 - we converted any target into a 'dev version'
        # even if there was a distance of 0 - indicating that we were on the
        # tag itself.
        self.repo.commit()
        self.repo.tag('1.3.0.0a1')
        version = packaging._get_version_from_git()
        self.assertEqual('1.3.0.0a1', version)

    def test_skip_write_git_changelog(self):
        # Fix for bug 1467440
        self.repo.commit()
        self.repo.tag('1.2.3')
        os.environ['SKIP_WRITE_GIT_CHANGELOG'] = '1'
        version = packaging._get_version_from_git('1.2.3')
        self.assertEqual('1.2.3', version)

    def tearDown(self):
        super(TestVersions, self).tearDown()
        os.environ.pop('SKIP_WRITE_GIT_CHANGELOG', None)


class TestRequirementParsing(base.BaseTestCase):

    def test_requirement_parsing(self):
        pkgs = {
            'test_reqparse':
                {
                    'requirements.txt': textwrap.dedent("""\
                        bar
                        quux<1.0; python_version=='2.6'
                        requests-aws>=0.1.4    # BSD License (3 clause)
                        Routes>=1.12.3,!=2.0,!=2.1;python_version=='2.7'
                        requests-kerberos>=0.6;python_version=='2.7' # MIT
                    """),
                    'setup.cfg': textwrap.dedent("""\
                        [metadata]
                        name = test_reqparse

                        [extras]
                        test =
                            foo
                            baz>3.2 :python_version=='2.7' # MIT
                            bar>3.3 :python_version=='2.7' # MIT # Apache
                    """)},
        }
        pkg_dirs = self.useFixture(CreatePackages(pkgs)).package_dirs
        pkg_dir = pkg_dirs['test_reqparse']
        # pkg_resources.split_sections uses None as the title of an
        # anonymous section instead of the empty string. Weird.
        expected_requirements = {
            None: ['bar', 'requests-aws>=0.1.4'],
            ":(python_version=='2.6')": ['quux<1.0'],
            ":(python_version=='2.7')": ['Routes>=1.12.3,!=2.0,!=2.1',
                                         'requests-kerberos>=0.6'],
            'test': ['foo'],
            "test:(python_version=='2.7')": ['baz>3.2', 'bar>3.3']
        }
        venv = self.useFixture(Venv('reqParse'))
        bin_python = venv.python
        # Two things are tested by this
        # 1) pbr properly parses markers from requiremnts.txt and setup.cfg
        # 2) bdist_wheel causes pbr to not evaluate markers
        self._run_cmd(bin_python, ('setup.py', 'bdist_wheel'),
                      allow_fail=False, cwd=pkg_dir)
        egg_info = os.path.join(pkg_dir, 'test_reqparse.egg-info')

        requires_txt = os.path.join(egg_info, 'requires.txt')
        with open(requires_txt, 'rt') as requires:
            generated_requirements = dict(
                pkg_resources.split_sections(requires))

        self.assertEqual(expected_requirements, generated_requirements)


def get_soabi():
    soabi = None
    try:
        soabi = sysconfig.get_config_var('SOABI')
        arch = sysconfig.get_config_var('MULTIARCH')
    except IOError:
        pass
    if soabi and arch and 'pypy' in sysconfig.get_scheme_names():
        soabi = '%s-%s' % (soabi, arch)
    if soabi is None and 'pypy' in sysconfig.get_scheme_names():
        # NOTE(sigmavirus24): PyPy only added support for the SOABI config var
        # to sysconfig in 2015. That was well after 2.2.1 was published in the
        # Ubuntu 14.04 archive.
        for suffix, _, _ in imp.get_suffixes():
            if suffix.startswith('.pypy') and suffix.endswith('.so'):
                soabi = suffix.split('.')[1]
                break
    return soabi
