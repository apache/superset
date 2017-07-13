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

import setuptools


def smart_find_packages(package_list):
    """Run find_packages the way we intend."""
    packages = []
    for pkg in package_list.strip().split("\n"):
        pkg_path = pkg.replace('.', os.path.sep)
        packages.append(pkg)
        packages.extend(['%s.%s' % (pkg, f)
                         for f in setuptools.find_packages(pkg_path)])
    return "\n".join(set(packages))
