from __future__ import division, absolute_import, print_function

from subprocess import PIPE, Popen
import sys
import re

from numpy.linalg import lapack_lite
from numpy.testing import TestCase, dec, run_module_suite


class FindDependenciesLdd(object):

    def __init__(self):
        self.cmd = ['ldd']

        try:
            p = Popen(self.cmd, stdout=PIPE, stderr=PIPE)
            stdout, stderr = p.communicate()
        except OSError:
            raise RuntimeError("command %s cannot be run" % self.cmd)

    def get_dependencies(self, lfile):
        p = Popen(self.cmd + [lfile], stdout=PIPE, stderr=PIPE)
        stdout, stderr = p.communicate()
        if not (p.returncode == 0):
            raise RuntimeError("failed dependencies check for %s" % lfile)

        return stdout

    def grep_dependencies(self, lfile, deps):
        stdout = self.get_dependencies(lfile)

        rdeps = dict([(dep, re.compile(dep)) for dep in deps])
        founds = []
        for l in stdout.splitlines():
            for k, v in rdeps.items():
                if v.search(l):
                    founds.append(k)

        return founds


class TestF77Mismatch(TestCase):

    @dec.skipif(not(sys.platform[:5] == 'linux'),
                "Skipping fortran compiler mismatch on non Linux platform")
    def test_lapack(self):
        f = FindDependenciesLdd()
        deps = f.grep_dependencies(lapack_lite.__file__,
                                   [b'libg2c', b'libgfortran'])
        self.assertFalse(len(deps) > 1,
                         """Both g77 and gfortran runtimes linked in lapack_lite ! This is likely to
cause random crashes and wrong results. See numpy INSTALL.txt for more
information.""")

if __name__ == "__main__":
    run_module_suite()
