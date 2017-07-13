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

from testtools import content

from pbr.tests import base


class TestCommands(base.BaseTestCase):
    def test_custom_build_py_command(self):
        """Test custom build_py command.

        Test that a custom subclass of the build_py command runs when listed in
        the commands [global] option, rather than the normal build command.
        """

        stdout, stderr, return_code = self.run_setup('build_py')
        self.addDetail('stdout', content.text_content(stdout))
        self.addDetail('stderr', content.text_content(stderr))
        self.assertIn('Running custom build_py command.', stdout)
        self.assertEqual(0, return_code)

    def test_custom_deb_version_py_command(self):
        """Test custom deb_version command."""
        stdout, stderr, return_code = self.run_setup('deb_version')
        self.addDetail('stdout', content.text_content(stdout))
        self.addDetail('stderr', content.text_content(stderr))
        self.assertIn('Extracting deb version', stdout)
        self.assertEqual(0, return_code)

    def test_custom_rpm_version_py_command(self):
        """Test custom rpm_version command."""
        stdout, stderr, return_code = self.run_setup('rpm_version')
        self.addDetail('stdout', content.text_content(stdout))
        self.addDetail('stderr', content.text_content(stderr))
        self.assertIn('Extracting rpm version', stdout)
        self.assertEqual(0, return_code)

    def test_freeze_command(self):
        """Test that freeze output is sorted in a case-insensitive manner."""
        stdout, stderr, return_code = self.run_pbr('freeze')
        self.assertEqual(0, return_code)
        pkgs = []
        for l in stdout.split('\n'):
            pkgs.append(l.split('==')[0].lower())
        pkgs_sort = sorted(pkgs[:])
        self.assertEqual(pkgs_sort, pkgs)
