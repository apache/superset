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

import json

from pbr import git


def write_pbr_json(cmd, basename, filename):
    if not hasattr(cmd.distribution, 'pbr') or not cmd.distribution.pbr:
        return
    git_dir = git._run_git_functions()
    if not git_dir:
        return
    values = dict()
    git_version = git.get_git_short_sha(git_dir)
    is_release = git.get_is_release(git_dir)
    if git_version is not None:
        values['git_version'] = git_version
        values['is_release'] = is_release
        cmd.write_file('pbr', filename, json.dumps(values, sort_keys=True))
