# Copyright (c) 2015 Hewlett-Packard Development Company, L.P. (HP)
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

import io
import textwrap

import six
from six.moves import configparser
import sys

from pbr.tests import base
from pbr import util


class TestExtrasRequireParsingScenarios(base.BaseTestCase):

    scenarios = [
        ('simple_extras', {
            'config_text': """
                [extras]
                first =
                    foo
                    bar==1.0
                second =
                    baz>=3.2
                    foo
                """,
            'expected_extra_requires': {'first': ['foo', 'bar==1.0'],
                                        'second': ['baz>=3.2', 'foo']}
        }),
        ('with_markers', {
            'config_text': """
                [extras]
                test =
                    foo:python_version=='2.6'
                    bar
                    baz<1.6 :python_version=='2.6'
                    zaz :python_version>'1.0'
                """,
            'expected_extra_requires': {
                "test:(python_version=='2.6')": ['foo', 'baz<1.6'],
                "test": ['bar', 'zaz']}}),
        ('no_extras', {
            'config_text': """
            [metadata]
            long_description = foo
            """,
            'expected_extra_requires':
            {}
        })]

    def config_from_ini(self, ini):
        config = {}
        if sys.version_info >= (3, 2):
            parser = configparser.ConfigParser()
        else:
            parser = configparser.SafeConfigParser()
        ini = textwrap.dedent(six.u(ini))
        parser.readfp(io.StringIO(ini))
        for section in parser.sections():
            config[section] = dict(parser.items(section))
        return config

    def test_extras_parsing(self):
        config = self.config_from_ini(self.config_text)
        kwargs = util.setup_cfg_to_setup_kwargs(config)

        self.assertEqual(self.expected_extra_requires,
                         kwargs['extras_require'])


class TestInvalidMarkers(base.BaseTestCase):

    def test_invalid_marker_raises_error(self):
        config = {'extras': {'test': "foo :bad_marker>'1.0'"}}
        self.assertRaises(SyntaxError, util.setup_cfg_to_setup_kwargs, config)
