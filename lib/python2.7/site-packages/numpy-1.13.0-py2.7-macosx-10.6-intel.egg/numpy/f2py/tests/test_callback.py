from __future__ import division, absolute_import, print_function

import math
import textwrap

from numpy import array
from numpy.testing import run_module_suite, assert_, assert_equal, dec
import util


class TestF77Callback(util.F2PyTest):
    code = """
       subroutine t(fun,a)
       integer a
cf2py  intent(out) a
       external fun
       call fun(a)
       end

       subroutine func(a)
cf2py  intent(in,out) a
       integer a
       a = a + 11
       end

       subroutine func0(a)
cf2py  intent(out) a
       integer a
       a = 11
       end

       subroutine t2(a)
cf2py  intent(callback) fun
       integer a
cf2py  intent(out) a
       external fun
       call fun(a)
       end

       subroutine string_callback(callback, a)
       external callback
       double precision callback
       double precision a
       character*1 r
cf2py  intent(out) a
       r = 'r'
       a = callback(r)
       end

    """

    @dec.slow
    def test_all(self):
        for name in "t,t2".split(","):
            self.check_function(name)

    @dec.slow
    def test_docstring(self):
        expected = """
        a = t(fun,[fun_extra_args])

        Wrapper for ``t``.

        Parameters
        ----------
        fun : call-back function

        Other Parameters
        ----------------
        fun_extra_args : input tuple, optional
            Default: ()

        Returns
        -------
        a : int

        Notes
        -----
        Call-back functions::

          def fun(): return a
          Return objects:
            a : int
        """
        assert_equal(self.module.t.__doc__, textwrap.dedent(expected).lstrip())

    def check_function(self, name):
        t = getattr(self.module, name)
        r = t(lambda: 4)
        assert_(r == 4, repr(r))
        r = t(lambda a: 5, fun_extra_args=(6,))
        assert_(r == 5, repr(r))
        r = t(lambda a: a, fun_extra_args=(6,))
        assert_(r == 6, repr(r))
        r = t(lambda a: 5 + a, fun_extra_args=(7,))
        assert_(r == 12, repr(r))
        r = t(lambda a: math.degrees(a), fun_extra_args=(math.pi,))
        assert_(r == 180, repr(r))
        r = t(math.degrees, fun_extra_args=(math.pi,))
        assert_(r == 180, repr(r))

        r = t(self.module.func, fun_extra_args=(6,))
        assert_(r == 17, repr(r))
        r = t(self.module.func0)
        assert_(r == 11, repr(r))
        r = t(self.module.func0._cpointer)
        assert_(r == 11, repr(r))

        class A(object):

            def __call__(self):
                return 7

            def mth(self):
                return 9
        a = A()
        r = t(a)
        assert_(r == 7, repr(r))
        r = t(a.mth)
        assert_(r == 9, repr(r))

    def test_string_callback(self):

        def callback(code):
            if code == 'r':
                return 0
            else:
                return 1

        f = getattr(self.module, 'string_callback')
        r = f(callback)
        assert_(r == 0, repr(r))


if __name__ == "__main__":
    run_module_suite()
