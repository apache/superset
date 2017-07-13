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

import os
import textwrap

from testtools import content
from testtools import matchers

from pbr.tests import base
from pbr.tests import util


class TestHooks(base.BaseTestCase):
    def setUp(self):
        super(TestHooks, self).setUp()
        with util.open_config(
                os.path.join(self.package_dir, 'setup.cfg')) as cfg:
            cfg.set('global', 'setup-hooks',
                    'pbr_testpackage._setup_hooks.test_hook_1\n'
                    'pbr_testpackage._setup_hooks.test_hook_2')
            cfg.set('build_ext', 'pre-hook.test_pre_hook',
                    'pbr_testpackage._setup_hooks.test_pre_hook')
            cfg.set('build_ext', 'post-hook.test_post_hook',
                    'pbr_testpackage._setup_hooks.test_post_hook')

    def test_global_setup_hooks(self):
        """Test setup_hooks.

        Test that setup_hooks listed in the [global] section of setup.cfg are
        executed in order.
        """

        stdout, _, return_code = self.run_setup('egg_info')
        assert 'test_hook_1\ntest_hook_2' in stdout
        assert return_code == 0

    def test_command_hooks(self):
        """Test command hooks.

        Simple test that the appropriate command hooks run at the
        beginning/end of the appropriate command.
        """

        stdout, _, return_code = self.run_setup('egg_info')
        assert 'build_ext pre-hook' not in stdout
        assert 'build_ext post-hook' not in stdout
        assert return_code == 0

        stdout, stderr, return_code = self.run_setup('build_ext')
        self.addDetailUniqueName('stderr', content.text_content(stderr))
        assert textwrap.dedent("""
            running build_ext
            running pre_hook pbr_testpackage._setup_hooks.test_pre_hook for command build_ext
            build_ext pre-hook
        """) in stdout  # flake8: noqa
        self.expectThat(stdout, matchers.EndsWith('build_ext post-hook'))
        assert return_code == 0

    def test_custom_commands_known(self):
        stdout, _, return_code = self.run_setup('--help-commands')
        self.assertFalse(return_code)
        self.assertThat(stdout, matchers.Contains(" testr "))
