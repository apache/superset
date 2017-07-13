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

from pbr.hooks import base
from pbr import packaging


class MetadataConfig(base.BaseConfig):

    section = 'metadata'

    def hook(self):
        self.config['version'] = packaging.get_version(
            self.config['name'], self.config.get('version', None))
        packaging.append_text_list(
            self.config, 'requires_dist',
            packaging.parse_requirements())

    def get_name(self):
        return self.config['name']
