from __future__ import division, absolute_import, print_function

import sys
from numpy.distutils.fcompiler import FCompiler

compilers = ['NAGFCompiler']

class NAGFCompiler(FCompiler):

    compiler_type = 'nag'
    description = 'NAGWare Fortran 95 Compiler'
    version_pattern =  r'NAGWare Fortran 95 compiler Release (?P<version>[^\s]*)'

    executables = {
        'version_cmd'  : ["<F90>", "-V"],
        'compiler_f77' : ["f95", "-fixed"],
        'compiler_fix' : ["f95", "-fixed"],
        'compiler_f90' : ["f95"],
        'linker_so'    : ["<F90>"],
        'archiver'     : ["ar", "-cr"],
        'ranlib'       : ["ranlib"]
        }

    def get_flags_linker_so(self):
        if sys.platform=='darwin':
            return ['-unsharedf95', '-Wl,-bundle,-flat_namespace,-undefined,suppress']
        return ["-Wl,-shared"]
    def get_flags_opt(self):
        return ['-O4']
    def get_flags_arch(self):
        version = self.get_version()
        if version and version < '5.1':
            return ['-target=native']
        else:
            return ['']
    def get_flags_debug(self):
        return ['-g', '-gline', '-g90', '-nan', '-C']

if __name__ == '__main__':
    from distutils import log
    log.set_verbosity(2)
    from numpy.distutils.fcompiler import new_fcompiler
    compiler = new_fcompiler(compiler='nag')
    compiler.customize()
    print(compiler.get_version())
