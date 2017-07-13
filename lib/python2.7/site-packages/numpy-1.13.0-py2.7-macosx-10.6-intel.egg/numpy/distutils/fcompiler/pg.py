# http://www.pgroup.com
from __future__ import division, absolute_import, print_function

from numpy.distutils.fcompiler import FCompiler
from sys import platform

compilers = ['PGroupFCompiler']

class PGroupFCompiler(FCompiler):

    compiler_type = 'pg'
    description = 'Portland Group Fortran Compiler'
    version_pattern =  r'\s*pg(f77|f90|hpf|fortran) (?P<version>[\d.-]+).*'

    if platform == 'darwin':
        executables = {
        'version_cmd'  : ["<F77>", "-V"],
        'compiler_f77' : ["pgfortran", "-dynamiclib"],
        'compiler_fix' : ["pgfortran", "-Mfixed", "-dynamiclib"],
        'compiler_f90' : ["pgfortran", "-dynamiclib"],
        'linker_so'    : ["libtool"],
        'archiver'     : ["ar", "-cr"],
        'ranlib'       : ["ranlib"]
        }
        pic_flags = ['']
    else:
        executables = {
        'version_cmd'  : ["<F77>", "-V"],
        'compiler_f77' : ["pgfortran"],
        'compiler_fix' : ["pgfortran", "-Mfixed"],
        'compiler_f90' : ["pgfortran"],
        'linker_so'    : ["pgfortran", "-shared", "-fpic"],
        'archiver'     : ["ar", "-cr"],
        'ranlib'       : ["ranlib"]
        }
        pic_flags = ['-fpic']


    module_dir_switch = '-module '
    module_include_switch = '-I'

    def get_flags(self):
        opt = ['-Minform=inform', '-Mnosecond_underscore']
        return self.pic_flags + opt
    def get_flags_opt(self):
        return ['-fast']
    def get_flags_debug(self):
        return ['-g']

    if platform == 'darwin':
        def get_flags_linker_so(self):
            return ["-dynamic", '-undefined', 'dynamic_lookup']

    def runtime_library_dir_option(self, dir):
        return '-R"%s"' % dir

if __name__ == '__main__':
    from distutils import log
    log.set_verbosity(2)
    from numpy.distutils.fcompiler import new_fcompiler
    compiler = new_fcompiler(compiler='pg')
    compiler.customize()
    print(compiler.get_version())
