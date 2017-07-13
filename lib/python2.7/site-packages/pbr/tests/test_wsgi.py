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

import os
import re
import subprocess
import sys
try:
    # python 2
    from urllib2 import urlopen
except ImportError:
    # python 3
    from urllib.request import urlopen

from pbr.tests import base


class TestWsgiScripts(base.BaseTestCase):

    cmd_names = ('pbr_test_wsgi', 'pbr_test_wsgi_with_class')

    def _get_path(self):
        if os.path.isdir("%s/lib64" % self.temp_dir):
            path = "%s/lib64" % self.temp_dir
        elif os.path.isdir("%s/lib" % self.temp_dir):
            path = "%s/lib" % self.temp_dir
        elif os.path.isdir("%s/site-packages" % self.temp_dir):
            return ".:%s/site-packages" % self.temp_dir
        else:
            raise Exception("Could not determine path for test")
        return ".:%s/python%s.%s/site-packages" % (
            path,
            sys.version_info[0],
            sys.version_info[1])

    def test_wsgi_script_install(self):
        """Test that we install a non-pkg-resources wsgi script."""
        if os.name == 'nt':
            self.skipTest('Windows support is passthrough')

        stdout, _, return_code = self.run_setup(
            'install', '--prefix=%s' % self.temp_dir)

        self._check_wsgi_install_content(stdout)

    def test_wsgi_script_run(self):
        """Test that we install a runnable wsgi script.

        This test actually attempts to start and interact with the
        wsgi script in question to demonstrate that it's a working
        wsgi script using simple server.

        """
        if os.name == 'nt':
            self.skipTest('Windows support is passthrough')

        stdout, _, return_code = self.run_setup(
            'install', '--prefix=%s' % self.temp_dir)

        self._check_wsgi_install_content(stdout)

        # Live test run the scripts and see that they respond to wsgi
        # requests.
        for cmd_name in self.cmd_names:
            self._test_wsgi(cmd_name, b'Hello World')

    def _test_wsgi(self, cmd_name, output, extra_args=None):
        cmd = os.path.join(self.temp_dir, 'bin', cmd_name)
        print("Running %s -p 0" % cmd)
        popen_cmd = [cmd, '-p', '0']
        if extra_args:
            popen_cmd.extend(extra_args)

        env = {'PYTHONPATH': self._get_path()}

        p = subprocess.Popen(popen_cmd, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, cwd=self.temp_dir,
                             env=env)
        self.addCleanup(p.kill)

        stdoutdata = p.stdout.readline()  # ****...

        stdoutdata = p.stdout.readline()  # STARTING test server...
        self.assertIn(
            b"STARTING test server pbr_testpackage.wsgi",
            stdoutdata)

        stdoutdata = p.stdout.readline()  # Available at ...
        print(stdoutdata)
        m = re.search(b'(http://[^:]+:\d+)/', stdoutdata)
        self.assertIsNotNone(m, "Regex failed to match on %s" % stdoutdata)

        stdoutdata = p.stdout.readline()  # DANGER! ...
        self.assertIn(
            b"DANGER! For testing only, do not use in production",
            stdoutdata)

        stdoutdata = p.stdout.readline()  # ***...

        f = urlopen(m.group(1).decode('utf-8'))
        self.assertEqual(output, f.read())

        # Request again so that the application can force stderr.flush(),
        # otherwise the log is buffered and the next readline() will hang.
        urlopen(m.group(1).decode('utf-8'))

        stdoutdata = p.stderr.readline()
        # we should have logged an HTTP request, return code 200, that
        # returned the right amount of bytes
        status = '"GET / HTTP/1.1" 200 %d' % len(output)
        self.assertIn(status.encode('utf-8'), stdoutdata)

    def _check_wsgi_install_content(self, install_stdout):
        for cmd_name in self.cmd_names:
            install_txt = 'Installing %s script to %s' % (cmd_name,
                                                          self.temp_dir)
            self.assertIn(install_txt, install_stdout)

            cmd_filename = os.path.join(self.temp_dir, 'bin', cmd_name)

            script_txt = open(cmd_filename, 'r').read()
            self.assertNotIn('pkg_resources', script_txt)

            main_block = """if __name__ == "__main__":
    import argparse
    import socket
    import sys
    import wsgiref.simple_server as wss"""

            if cmd_name == 'pbr_test_wsgi':
                app_name = "main"
            else:
                app_name = "WSGI.app"

            starting_block = ("STARTING test server pbr_testpackage.wsgi."
                              "%s" % app_name)

            else_block = """else:
    application = None"""

            self.assertIn(main_block, script_txt)
            self.assertIn(starting_block, script_txt)
            self.assertIn(else_block, script_txt)

    def test_with_argument(self):
        if os.name == 'nt':
            self.skipTest('Windows support is passthrough')

        stdout, _, return_code = self.run_setup(
            'install', '--prefix=%s' % self.temp_dir)

        self._test_wsgi('pbr_test_wsgi', b'Foo Bar', ["--", "-c", "Foo Bar"])
