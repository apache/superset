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
import sys

from pbr import find_package
from pbr.hooks import base


def get_manpath():
    manpath = 'share/man'
    if os.path.exists(os.path.join(sys.prefix, 'man')):
        # This works around a bug with install where it expects every node
        # in the relative data directory to be an actual directory, since at
        # least Debian derivatives (and probably other platforms as well)
        # like to symlink Unixish /usr/local/man to /usr/local/share/man.
        manpath = 'man'
    return manpath


def get_man_section(section):
    return os.path.join(get_manpath(), 'man%s' % section)


class FilesConfig(base.BaseConfig):

    section = 'files'

    def __init__(self, config, name):
        super(FilesConfig, self).__init__(config)
        self.name = name
        self.data_files = self.config.get('data_files', '')

    def save(self):
        self.config['data_files'] = self.data_files
        super(FilesConfig, self).save()

    def expand_globs(self):
        finished = []
        for line in self.data_files.split("\n"):
            if line.rstrip().endswith('*') and '=' in line:
                (target, source_glob) = line.split('=')
                source_prefix = source_glob.strip()[:-1]
                target = target.strip()
                if not target.endswith(os.path.sep):
                    target += os.path.sep
                for (dirpath, dirnames, fnames) in os.walk(source_prefix):
                    finished.append(
                        "%s = " % dirpath.replace(source_prefix, target))
                    finished.extend(
                        [" %s" % os.path.join(dirpath, f) for f in fnames])
            else:
                finished.append(line)

        self.data_files = "\n".join(finished)

    def add_man_path(self, man_path):
        self.data_files = "%s\n%s =" % (self.data_files, man_path)

    def add_man_page(self, man_page):
        self.data_files = "%s\n  %s" % (self.data_files, man_page)

    def get_man_sections(self):
        man_sections = dict()
        manpages = self.pbr_config['manpages']
        for manpage in manpages.split():
            section_number = manpage.strip()[-1]
            section = man_sections.get(section_number, list())
            section.append(manpage.strip())
            man_sections[section_number] = section
        return man_sections

    def hook(self):
        packages = self.config.get('packages', self.name).strip()
        expanded = []
        for pkg in packages.split("\n"):
            if os.path.isdir(pkg.strip()):
                expanded.append(find_package.smart_find_packages(pkg.strip()))

        self.config['packages'] = "\n".join(expanded)

        self.expand_globs()

        if 'manpages' in self.pbr_config:
            man_sections = self.get_man_sections()
            for (section, pages) in man_sections.items():
                manpath = get_man_section(section)
                self.add_man_path(manpath)
                for page in pages:
                    self.add_man_page(page)
