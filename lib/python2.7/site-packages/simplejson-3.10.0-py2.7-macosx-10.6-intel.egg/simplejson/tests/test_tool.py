from __future__ import with_statement
import os
import sys
import textwrap
import unittest
import subprocess
import tempfile
try:
    # Python 3.x
    from test.support import strip_python_stderr
except ImportError:
    # Python 2.6+
    try:
        from test.test_support import strip_python_stderr
    except ImportError:
        # Python 2.5
        import re
        def strip_python_stderr(stderr):
            return re.sub(
                r"\[\d+ refs\]\r?\n?$".encode(),
                "".encode(),
                stderr).strip()

class TestTool(unittest.TestCase):
    data = """

        [["blorpie"],[ "whoops" ] , [
                                 ],\t"d-shtaeou",\r"d-nthiouh",
        "i-vhbjkhnth", {"nifty":87}, {"morefield" :\tfalse,"field"
            :"yes"}  ]
           """

    expect = textwrap.dedent("""\
    [
        [
            "blorpie"
        ],
        [
            "whoops"
        ],
        [],
        "d-shtaeou",
        "d-nthiouh",
        "i-vhbjkhnth",
        {
            "nifty": 87
        },
        {
            "field": "yes",
            "morefield": false
        }
    ]
    """)

    def runTool(self, args=None, data=None):
        argv = [sys.executable, '-m', 'simplejson.tool']
        if args:
            argv.extend(args)
        proc = subprocess.Popen(argv,
                                stdin=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                stdout=subprocess.PIPE)
        out, err = proc.communicate(data)
        self.assertEqual(strip_python_stderr(err), ''.encode())
        self.assertEqual(proc.returncode, 0)
        return out

    def test_stdin_stdout(self):
        self.assertEqual(
            self.runTool(data=self.data.encode()),
            self.expect.encode())

    def test_infile_stdout(self):
        with tempfile.NamedTemporaryFile() as infile:
            infile.write(self.data.encode())
            infile.flush()
            self.assertEqual(
                self.runTool(args=[infile.name]),
                self.expect.encode())

    def test_infile_outfile(self):
        with tempfile.NamedTemporaryFile() as infile:
            infile.write(self.data.encode())
            infile.flush()
            # outfile will get overwritten by tool, so the delete
            # may not work on some platforms. Do it manually.
            outfile = tempfile.NamedTemporaryFile()
            try:
                self.assertEqual(
                    self.runTool(args=[infile.name, outfile.name]),
                    ''.encode())
                with open(outfile.name, 'rb') as f:
                    self.assertEqual(f.read(), self.expect.encode())
            finally:
                outfile.close()
                if os.path.exists(outfile.name):
                    os.unlink(outfile.name)
