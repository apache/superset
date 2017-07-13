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

from distutils import errors
import os

_extra_files = []


def get_extra_files():
    global _extra_files
    return _extra_files


def set_extra_files(extra_files):
    # Let's do a sanity check
    for filename in extra_files:
        if not os.path.exists(filename):
            raise errors.DistutilsFileError(
                '%s from the extra_files option in setup.cfg does not '
                'exist' % filename)
    global _extra_files
    _extra_files[:] = extra_files[:]
