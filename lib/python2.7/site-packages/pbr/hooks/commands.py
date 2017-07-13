# Copyright 2013 Hewlett-Packard Development Company, L.P.
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

import os

from setuptools.command import easy_install

from pbr.hooks import base
from pbr import options
from pbr import packaging


class CommandsConfig(base.BaseConfig):

    section = 'global'

    def __init__(self, config):
        super(CommandsConfig, self).__init__(config)
        self.commands = self.config.get('commands', "")

    def save(self):
        self.config['commands'] = self.commands
        super(CommandsConfig, self).save()

    def add_command(self, command):
        self.commands = "%s\n%s" % (self.commands, command)

    def hook(self):
        self.add_command('pbr.packaging.LocalEggInfo')
        self.add_command('pbr.packaging.LocalSDist')
        self.add_command('pbr.packaging.LocalInstallScripts')
        self.add_command('pbr.packaging.LocalDevelop')
        self.add_command('pbr.packaging.LocalRPMVersion')
        self.add_command('pbr.packaging.LocalDebVersion')
        if os.name != 'nt':
            easy_install.get_script_args = packaging.override_get_script_args

        if packaging.have_sphinx():
            self.add_command('pbr.builddoc.LocalBuildDoc')

        if os.path.exists('.testr.conf') and packaging.have_testr():
            # There is a .testr.conf file. We want to use it.
            self.add_command('pbr.packaging.TestrTest')
        elif self.config.get('nosetests', False) and packaging.have_nose():
            # We seem to still have nose configured
            self.add_command('pbr.packaging.NoseTest')

        use_egg = options.get_boolean_option(
            self.pbr_config, 'use-egg', 'PBR_USE_EGG')
        # We always want non-egg install unless explicitly requested
        if 'manpages' in self.pbr_config or not use_egg:
            self.add_command('pbr.packaging.LocalInstall')
        else:
            self.add_command('pbr.packaging.InstallWithGit')
