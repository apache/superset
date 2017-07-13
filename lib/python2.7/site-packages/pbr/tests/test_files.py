# Copyright (c) 2013 Hewlett-Packard Development Company, L.P.
# All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

from __future__ import print_function

import os

import fixtures

from pbr.hooks import files
from pbr.tests import base


class FilesConfigTest(base.BaseTestCase):

    def setUp(self):
        super(FilesConfigTest, self).setUp()

        pkg_fixture = fixtures.PythonPackage(
            "fake_package", [
                ("fake_module.py", b""),
                ("other_fake_module.py", b""),
            ])
        self.useFixture(pkg_fixture)
        pkg_etc = os.path.join(pkg_fixture.base, 'etc')
        pkg_sub = os.path.join(pkg_etc, 'sub')
        subpackage = os.path.join(
            pkg_fixture.base, 'fake_package', 'subpackage')
        os.makedirs(pkg_sub)
        os.makedirs(subpackage)
        with open(os.path.join(pkg_etc, "foo"), 'w') as foo_file:
            foo_file.write("Foo Data")
        with open(os.path.join(pkg_sub, "bar"), 'w') as foo_file:
            foo_file.write("Bar Data")
        with open(os.path.join(subpackage, "__init__.py"), 'w') as foo_file:
            foo_file.write("# empty")

        self.useFixture(base.DiveDir(pkg_fixture.base))

    def test_implicit_auto_package(self):
        config = dict(
            files=dict(
            )
        )
        files.FilesConfig(config, 'fake_package').run()
        self.assertIn('subpackage', config['files']['packages'])

    def test_auto_package(self):
        config = dict(
            files=dict(
                packages='fake_package',
            )
        )
        files.FilesConfig(config, 'fake_package').run()
        self.assertIn('subpackage', config['files']['packages'])

    def test_data_files_globbing(self):
        config = dict(
            files=dict(
                data_files="\n  etc/pbr = etc/*"
            )
        )
        files.FilesConfig(config, 'fake_package').run()
        self.assertIn(
            '\netc/pbr/ = \n etc/foo\netc/pbr/sub = \n etc/sub/bar',
            config['files']['data_files'])
