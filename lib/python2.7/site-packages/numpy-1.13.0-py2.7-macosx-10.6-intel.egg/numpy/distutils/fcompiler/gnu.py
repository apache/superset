from __future__ import division, absolute_import, print_function

import re
import os
import sys
import warnings
import platform
import tempfile
from subprocess import Popen, PIPE, STDOUT

from numpy.distutils.fcompiler import FCompiler
from numpy.distutils.exec_command import exec_command
from numpy.distutils.misc_util import msvc_runtime_library
from numpy.distutils.compat import get_exception

compilers = ['GnuFCompiler', 'Gnu95FCompiler']

TARGET_R = re.compile(r"Target: ([a-zA-Z0-9_\-]*)")

# XXX: handle cross compilation
def is_win64():
    return sys.platform == "win32" and platform.architecture()[0] == "64bit"

if is_win64():
    #_EXTRAFLAGS = ["-fno-leading-underscore"]
    _EXTRAFLAGS = []
else:
    _EXTRAFLAGS = []

class GnuFCompiler(FCompiler):
    compiler_type = 'gnu'
    compiler_aliases = ('g77',)
    description = 'GNU Fortran 77 compiler'

    def gnu_version_match(self, version_string):
        """Handle the different versions of GNU fortran compilers"""
        # Strip warning(s) that may be emitted by gfortran
        while version_string.startswith('gfortran: warning'):
            version_string = version_string[version_string.find('\n')+1:]

        # Gfortran versions from after 2010 will output a simple string
        # (usually "x.y", "x.y.z" or "x.y.z-q") for ``-dumpversion``; older
        # gfortrans may still return long version strings (``-dumpversion`` was
        # an alias for ``--version``)
        if len(version_string) <= 20:
            # Try to find a valid version string
            m = re.search(r'([0-9.]+)', version_string)
            if m:
                # g77 provides a longer version string that starts with GNU
                # Fortran
                if version_string.startswith('GNU Fortran'):
                    return ('g77', m.group(1))

                # gfortran only outputs a version string such as #.#.#, so check
                # if the match is at the start of the string
                elif m.start() == 0:
                    return ('gfortran', m.group(1))
        else:
            # Output probably from --version, try harder:
            m = re.search(r'GNU Fortran\s+95.*?([0-9-.]+)', version_string)
            if m:
                return ('gfortran', m.group(1))
            m = re.search(r'GNU Fortran.*?\-?([0-9-.]+)', version_string)
            if m:
                v = m.group(1)
                if v.startswith('0') or v.startswith('2') or v.startswith('3'):
                    # the '0' is for early g77's
                    return ('g77', v)
                else:
                    # at some point in the 4.x series, the ' 95' was dropped
                    # from the version string
                    return ('gfortran', v)

        # If still nothing, raise an error to make the problem easy to find.
        err = 'A valid Fortran version was not found in this string:\n'
        raise ValueError(err + version_string)

    def version_match(self, version_string):
        v = self.gnu_version_match(version_string)
        if not v or v[0] != 'g77':
            return None
        return v[1]

    possible_executables = ['g77', 'f77']
    executables = {
        'version_cmd'  : [None, "-dumpversion"],
        'compiler_f77' : [None, "-g", "-Wall", "-fno-second-underscore"],
        'compiler_f90' : None,  # Use --fcompiler=gnu95 for f90 codes
        'compiler_fix' : None,
        'linker_so'    : [None, "-g", "-Wall"],
        'archiver'     : ["ar", "-cr"],
        'ranlib'       : ["ranlib"],
        'linker_exe'   : [None, "-g", "-Wall"]
        }
    module_dir_switch = None
    module_include_switch = None

    # Cygwin: f771: warning: -fPIC ignored for target (all code is
    # position independent)
    if os.name != 'nt' and sys.platform != 'cygwin':
        pic_flags = ['-fPIC']

    # use -mno-cygwin for g77 when Python is not Cygwin-Python
    if sys.platform == 'win32':
        for key in ['version_cmd', 'compiler_f77', 'linker_so', 'linker_exe']:
            executables[key].append('-mno-cygwin')

    g2c = 'g2c'
    suggested_f90_compiler = 'gnu95'

    def get_flags_linker_so(self):
        opt = self.linker_so[1:]
        if sys.platform == 'darwin':
            target = os.environ.get('MACOSX_DEPLOYMENT_TARGET', None)
            # If MACOSX_DEPLOYMENT_TARGET is set, we simply trust the value
            # and leave it alone.  But, distutils will complain if the
            # environment's value is different from the one in the Python
            # Makefile used to build Python.  We let disutils handle this
            # error checking.
            if not target:
                # If MACOSX_DEPLOYMENT_TARGET is not set in the environment,
                # we try to get it first from the Python Makefile and then we
                # fall back to setting it to 10.3 to maximize the set of
                # versions we can work with.  This is a reasonable default
                # even when using the official Python dist and those derived
                # from it.
                import distutils.sysconfig as sc
                g = {}
                try:
                    get_makefile_filename = sc.get_makefile_filename
                except AttributeError:
                    pass # i.e. PyPy
                else: 
                    filename = get_makefile_filename()
                    sc.parse_makefile(filename, g)
                target = g.get('MACOSX_DEPLOYMENT_TARGET', '10.3')
                os.environ['MACOSX_DEPLOYMENT_TARGET'] = target
                if target == '10.3':
                    s = 'Env. variable MACOSX_DEPLOYMENT_TARGET set to 10.3'
                    warnings.warn(s, stacklevel=2)

            opt.extend(['-undefined', 'dynamic_lookup', '-bundle'])
        else:
            opt.append("-shared")
        if sys.platform.startswith('sunos'):
            # SunOS often has dynamically loaded symbols defined in the
            # static library libg2c.a  The linker doesn't like this.  To
            # ignore the problem, use the -mimpure-text flag.  It isn't
            # the safest thing, but seems to work. 'man gcc' says:
            # ".. Instead of using -mimpure-text, you should compile all
            #  source code with -fpic or -fPIC."
            opt.append('-mimpure-text')
        return opt

    def get_libgcc_dir(self):
        status, output = exec_command(self.compiler_f77 +
                                      ['-print-libgcc-file-name'],
                                      use_tee=0)
        if not status:
            return os.path.dirname(output)
        return None

    def get_library_dirs(self):
        opt = []
        if sys.platform[:5] != 'linux':
            d = self.get_libgcc_dir()
            if d:
                # if windows and not cygwin, libg2c lies in a different folder
                if sys.platform == 'win32' and not d.startswith('/usr/lib'):
                    d = os.path.normpath(d)
                    path = os.path.join(d, "lib%s.a" % self.g2c)
                    if not os.path.exists(path):
                        root = os.path.join(d, *((os.pardir,)*4))
                        d2 = os.path.abspath(os.path.join(root, 'lib'))
                        path = os.path.join(d2, "lib%s.a" % self.g2c)
                        if os.path.exists(path):
                            opt.append(d2)
                opt.append(d)
        return opt

    def get_libraries(self):
        opt = []
        d = self.get_libgcc_dir()
        if d is not None:
            g2c = self.g2c + '-pic'
            f = self.static_lib_format % (g2c, self.static_lib_extension)
            if not os.path.isfile(os.path.join(d, f)):
                g2c = self.g2c
        else:
            g2c = self.g2c

        if g2c is not None:
            opt.append(g2c)
        c_compiler = self.c_compiler
        if sys.platform == 'win32' and c_compiler and \
               c_compiler.compiler_type == 'msvc':
            # the following code is not needed (read: breaks) when using MinGW
            # in case want to link F77 compiled code with MSVC
            opt.append('gcc')
            runtime_lib = msvc_runtime_library()
            if runtime_lib:
                opt.append(runtime_lib)
        if sys.platform == 'darwin':
            opt.append('cc_dynamic')
        return opt

    def get_flags_debug(self):
        return ['-g']

    def get_flags_opt(self):
        v = self.get_version()
        if v and v <= '3.3.3':
            # With this compiler version building Fortran BLAS/LAPACK
            # with -O3 caused failures in lib.lapack heevr,syevr tests.
            opt = ['-O2']
        else:
            opt = ['-O3']
        opt.append('-funroll-loops')
        return opt

    def _c_arch_flags(self):
        """ Return detected arch flags from CFLAGS """
        from distutils import sysconfig
        try:
            cflags = sysconfig.get_config_vars()['CFLAGS']
        except KeyError:
            return []
        arch_re = re.compile(r"-arch\s+(\w+)")
        arch_flags = []
        for arch in arch_re.findall(cflags):
            arch_flags += ['-arch', arch]
        return arch_flags

    def get_flags_arch(self):
        return []

    def runtime_library_dir_option(self, dir):
        sep = ',' if sys.platform == 'darwin' else '='
        return '-Wl,-rpath%s"%s"' % (sep, dir)


class Gnu95FCompiler(GnuFCompiler):
    compiler_type = 'gnu95'
    compiler_aliases = ('gfortran',)
    description = 'GNU Fortran 95 compiler'

    def version_match(self, version_string):
        v = self.gnu_version_match(version_string)
        if not v or v[0] != 'gfortran':
            return None
        v = v[1]
        if v >= '4.':
            # gcc-4 series releases do not support -mno-cygwin option
            pass
        else:
            # use -mno-cygwin flag for gfortran when Python is not
            # Cygwin-Python
            if sys.platform == 'win32':
                for key in ['version_cmd', 'compiler_f77', 'compiler_f90',
                            'compiler_fix', 'linker_so', 'linker_exe']:
                    self.executables[key].append('-mno-cygwin')
        return v

    possible_executables = ['gfortran', 'f95']
    executables = {
        'version_cmd'  : ["<F90>", "-dumpversion"],
        'compiler_f77' : [None, "-Wall", "-g", "-ffixed-form",
                          "-fno-second-underscore"] + _EXTRAFLAGS,
        'compiler_f90' : [None, "-Wall", "-g",
                          "-fno-second-underscore"] + _EXTRAFLAGS,
        'compiler_fix' : [None, "-Wall",  "-g","-ffixed-form",
                          "-fno-second-underscore"] + _EXTRAFLAGS,
        'linker_so'    : ["<F90>", "-Wall", "-g"],
        'archiver'     : ["ar", "-cr"],
        'ranlib'       : ["ranlib"],
        'linker_exe'   : [None, "-Wall"]
        }

    module_dir_switch = '-J'
    module_include_switch = '-I'

    g2c = 'gfortran'

    def _universal_flags(self, cmd):
        """Return a list of -arch flags for every supported architecture."""
        if not sys.platform == 'darwin':
            return []
        arch_flags = []
        # get arches the C compiler gets.
        c_archs = self._c_arch_flags()
        if "i386" in c_archs:
            c_archs[c_archs.index("i386")] = "i686"
        # check the arches the Fortran compiler supports, and compare with
        # arch flags from C compiler
        for arch in ["ppc", "i686", "x86_64", "ppc64"]:
            if _can_target(cmd, arch) and arch in c_archs:
                arch_flags.extend(["-arch", arch])
        return arch_flags

    def get_flags(self):
        flags = GnuFCompiler.get_flags(self)
        arch_flags = self._universal_flags(self.compiler_f90)
        if arch_flags:
            flags[:0] = arch_flags
        return flags

    def get_flags_linker_so(self):
        flags = GnuFCompiler.get_flags_linker_so(self)
        arch_flags = self._universal_flags(self.linker_so)
        if arch_flags:
            flags[:0] = arch_flags
        return flags

    def get_library_dirs(self):
        opt = GnuFCompiler.get_library_dirs(self)
        if sys.platform == 'win32':
            c_compiler = self.c_compiler
            if c_compiler and c_compiler.compiler_type == "msvc":
                target = self.get_target()
                if target:
                    d = os.path.normpath(self.get_libgcc_dir())
                    root = os.path.join(d, *((os.pardir,)*4))
                    path = os.path.join(root, "lib")
                    mingwdir = os.path.normpath(path)
                    if os.path.exists(os.path.join(mingwdir, "libmingwex.a")):
                        opt.append(mingwdir)
        return opt

    def get_libraries(self):
        opt = GnuFCompiler.get_libraries(self)
        if sys.platform == 'darwin':
            opt.remove('cc_dynamic')
        if sys.platform == 'win32':
            c_compiler = self.c_compiler
            if c_compiler and c_compiler.compiler_type == "msvc":
                if "gcc" in opt:
                    i = opt.index("gcc")
                    opt.insert(i+1, "mingwex")
                    opt.insert(i+1, "mingw32")
            # XXX: fix this mess, does not work for mingw
            if is_win64():
                c_compiler = self.c_compiler
                if c_compiler and c_compiler.compiler_type == "msvc":
                    return []
                else:
                    pass
        return opt

    def get_target(self):
        status, output = exec_command(self.compiler_f77 +
                                      ['-v'],
                                      use_tee=0)
        if not status:
            m = TARGET_R.search(output)
            if m:
                return m.group(1)
        return ""

    def get_flags_opt(self):
        if is_win64():
            return ['-O0']
        else:
            return GnuFCompiler.get_flags_opt(self)

def _can_target(cmd, arch):
    """Return true if the architecture supports the -arch flag"""
    newcmd = cmd[:]
    fid, filename = tempfile.mkstemp(suffix=".f")
    os.close(fid)
    try:
        d = os.path.dirname(filename)
        output = os.path.splitext(filename)[0] + ".o"
        try:
            newcmd.extend(["-arch", arch, "-c", filename])
            p = Popen(newcmd, stderr=STDOUT, stdout=PIPE, cwd=d)
            p.communicate()
            return p.returncode == 0
        finally:
            if os.path.exists(output):
                os.remove(output)
    finally:
        os.remove(filename)
    return False

if __name__ == '__main__':
    from distutils import log
    log.set_verbosity(2)

    compiler = GnuFCompiler()
    compiler.customize()
    print(compiler.get_version())

    try:
        compiler = Gnu95FCompiler()
        compiler.customize()
        print(compiler.get_version())
    except Exception:
        msg = get_exception()
        print(msg)
