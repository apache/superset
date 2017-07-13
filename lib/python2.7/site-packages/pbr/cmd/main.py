# Copyright 2014 Hewlett-Packard Development Company, L.P.
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

import argparse
import json
import sys

import pkg_resources

import pbr.version


def _get_metadata(package_name):
    try:
        return json.loads(
            pkg_resources.get_distribution(
                package_name).get_metadata('pbr.json'))
    except pkg_resources.DistributionNotFound:
        raise Exception('Package {0} not installed'.format(package_name))
    except Exception:
        return None


def get_sha(args):
    sha = _get_info(args.name)['sha']
    if sha:
        print(sha)


def get_info(args):
    print("{name}\t{version}\t{released}\t{sha}".format(
        **_get_info(args.name)))


def _get_info(name):
    metadata = _get_metadata(name)
    version = pkg_resources.get_distribution(name).version
    if metadata:
        if metadata['is_release']:
            released = 'released'
        else:
            released = 'pre-release'
        sha = metadata['git_version']
    else:
        version_parts = version.split('.')
        if version_parts[-1].startswith('g'):
            sha = version_parts[-1][1:]
            released = 'pre-release'
        else:
            sha = ""
            released = "released"
            for part in version_parts:
                if not part.isdigit():
                    released = "pre-release"
    return dict(name=name, version=version, sha=sha, released=released)


def freeze(args):
    sorted_dists = sorted(pkg_resources.working_set,
                          key=lambda dist: dist.project_name.lower())
    for dist in sorted_dists:
        info = _get_info(dist.project_name)
        output = "{name}=={version}".format(**info)
        if info['sha']:
            output += "  # git sha {sha}".format(**info)
        print(output)


def main():
    parser = argparse.ArgumentParser(
        description='pbr: Python Build Reasonableness')
    parser.add_argument(
        '-v', '--version', action='version',
        version=str(pbr.version.VersionInfo('pbr')))

    subparsers = parser.add_subparsers(
        title='commands', description='valid commands', help='additional help')

    cmd_sha = subparsers.add_parser('sha', help='print sha of package')
    cmd_sha.set_defaults(func=get_sha)
    cmd_sha.add_argument('name', help='package to print sha of')

    cmd_info = subparsers.add_parser(
        'info', help='print version info for package')
    cmd_info.set_defaults(func=get_info)
    cmd_info.add_argument('name', help='package to print info of')

    cmd_freeze = subparsers.add_parser(
        'freeze', help='print version info for all installed packages')
    cmd_freeze.set_defaults(func=freeze)

    args = parser.parse_args()
    try:
        args.func(args)
    except Exception as e:
        print(e)


if __name__ == '__main__':
    sys.exit(main())
