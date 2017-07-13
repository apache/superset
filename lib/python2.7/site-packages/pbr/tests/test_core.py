# Copyright (c) 2013 Hewlett-Packard Development Company, L.P.
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

import glob
import os
import tarfile

import fixtures

from pbr.tests import base


class TestCore(base.BaseTestCase):

    cmd_names = ('pbr_test_cmd', 'pbr_test_cmd_with_class')

    def check_script_install(self, install_stdout):
        for cmd_name in self.cmd_names:
            install_txt = 'Installing %s script to %s' % (cmd_name,
                                                          self.temp_dir)
            self.assertIn(install_txt, install_stdout)

            cmd_filename = os.path.join(self.temp_dir, cmd_name)

            script_txt = open(cmd_filename, 'r').read()
            self.assertNotIn('pkg_resources', script_txt)

            stdout, _, return_code = self._run_cmd(cmd_filename)
            self.assertIn("PBR", stdout)

    def test_setup_py_keywords(self):
        """setup.py --keywords.

        Test that the `./setup.py --keywords` command returns the correct
        value without balking.
        """

        self.run_setup('egg_info')
        stdout, _, _ = self.run_setup('--keywords')
        assert stdout == 'packaging,distutils,setuptools'

    def test_setup_py_build_sphinx(self):
        stdout, _, return_code = self.run_setup('build_sphinx')
        self.assertEqual(0, return_code)

    def test_sdist_extra_files(self):
        """Test that the extra files are correctly added."""

        stdout, _, return_code = self.run_setup('sdist', '--formats=gztar')

        # There can be only one
        try:
            tf_path = glob.glob(os.path.join('dist', '*.tar.gz'))[0]
        except IndexError:
            assert False, 'source dist not found'

        tf = tarfile.open(tf_path)
        names = ['/'.join(p.split('/')[1:]) for p in tf.getnames()]

        self.assertIn('extra-file.txt', names)

    def test_console_script_install(self):
        """Test that we install a non-pkg-resources console script."""

        if os.name == 'nt':
            self.skipTest('Windows support is passthrough')

        stdout, _, return_code = self.run_setup(
            'install_scripts', '--install-dir=%s' % self.temp_dir)

        self.useFixture(
            fixtures.EnvironmentVariable('PYTHONPATH', '.'))

        self.check_script_install(stdout)

    def test_console_script_develop(self):
        """Test that we develop a non-pkg-resources console script."""

        if os.name == 'nt':
            self.skipTest('Windows support is passthrough')

        self.useFixture(
            fixtures.EnvironmentVariable(
                'PYTHONPATH', ".:%s" % self.temp_dir))

        stdout, _, return_code = self.run_setup(
            'develop', '--install-dir=%s' % self.temp_dir)

        self.check_script_install(stdout)


class TestGitSDist(base.BaseTestCase):

    def setUp(self):
        super(TestGitSDist, self).setUp()

        stdout, _, return_code = self._run_cmd('git', ('init',))
        if return_code:
            self.skipTest("git not installed")

        stdout, _, return_code = self._run_cmd('git', ('add', '.'))
        stdout, _, return_code = self._run_cmd(
            'git', ('commit', '-m', 'Turn this into a git repo'))

        stdout, _, return_code = self.run_setup('sdist', '--formats=gztar')

    def test_sdist_git_extra_files(self):
        """Test that extra files found in git are correctly added."""
        # There can be only one
        tf_path = glob.glob(os.path.join('dist', '*.tar.gz'))[0]
        tf = tarfile.open(tf_path)
        names = ['/'.join(p.split('/')[1:]) for p in tf.getnames()]

        self.assertIn('git-extra-file.txt', names)
