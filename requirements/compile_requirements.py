#!/usr/bin/env python
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Based on requirements.json (the source of truth for setup.py),
generates a set of .in and "pip-compiled" .txt
for the base reqs as well as each extra_requires entry
"""
import click
import json
import os

CUR_DIR = os.path.abspath(os.path.dirname(__file__))


def generate_requirements_files(suffix, reqs):
    in_filename = os.path.join(CUR_DIR, f'requirements-{suffix}.in')
    with open(in_filename, 'w') as f:
        for req in reqs:
            f.write(req + '\n')

    txt_filename = os.path.join(CUR_DIR, f'requirements-{suffix}.txt')
    cmd = f'pip-compile --output-file={txt_filename} {in_filename}'
    click.secho(f'[running] {cmd}', fg='green')
    os.system(cmd)


def main():
    with open(os.path.join(CUR_DIR, 'requirements.json'), 'r') as f:
        requirements = json.load(f)

    generate_requirements_files('base', requirements['base'])

    for extra, reqs in requirements['extras'].items():
        generate_requirements_files(extra, reqs)


if __name__ == '__main__':
    main()
