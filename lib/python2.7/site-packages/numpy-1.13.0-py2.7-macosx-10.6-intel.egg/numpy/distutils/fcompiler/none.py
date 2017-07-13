from __future__ import division, absolute_import, print_function

from numpy.distutils.fcompiler import FCompiler

compilers = ['NoneFCompiler']

class NoneFCompiler(FCompiler):

    compiler_type = 'none'
    description = 'Fake Fortran compiler'

    executables = {'compiler_f77': None,
                   'compiler_f90': None,
                   'compiler_fix': None,
                   'linker_so': None,
                   'linker_exe': None,
                   'archiver': None,
                   'ranlib': None,
                   'version_cmd': None,
                   }

    def find_executables(self):
        pass


if __name__ == '__main__':
    from distutils import log
    log.set_verbosity(2)
    compiler = NoneFCompiler()
    compiler.customize()
    print(compiler.get_version())
