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
from __future__ import print_function

import argparse
import functools
import sys


def application(env, start_response, data):
    sys.stderr.flush()  # Force the previous request log to be written.
    start_response('200 OK', [('Content-Type', 'text/html')])
    return [data.encode('utf-8')]


def main():
    parser = argparse.ArgumentParser(description='Return a string.')
    parser.add_argument('--content', '-c', help='String returned',
                        default='Hello World')
    args = parser.parse_args()
    return functools.partial(application, data=args.content)


class WSGI(object):

    @classmethod
    def app(self):
        return functools.partial(application, data='Hello World')
