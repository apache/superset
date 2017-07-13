from __future__ import division, absolute_import, print_function

import os
import sys
import warnings

__all__ = ['PackageLoader']

class PackageLoader(object):
    def __init__(self, verbose=False, infunc=False):
        """ Manages loading packages.
        """

        if infunc:
            _level = 2
        else:
            _level = 1
        self.parent_frame = frame = sys._getframe(_level)
        self.parent_name = eval('__name__', frame.f_globals, frame.f_locals)
        parent_path = eval('__path__', frame.f_globals, frame.f_locals)
        if isinstance(parent_path, str):
            parent_path = [parent_path]
        self.parent_path = parent_path
        if '__all__' not in frame.f_locals:
            exec('__all__ = []', frame.f_globals, frame.f_locals)
        self.parent_export_names = eval('__all__', frame.f_globals, frame.f_locals)

        self.info_modules = {}
        self.imported_packages = []
        self.verbose = None

    def _get_info_files(self, package_dir, parent_path, parent_package=None):
        """ Return list of (package name,info.py file) from parent_path subdirectories.
        """
        from glob import glob
        files = glob(os.path.join(parent_path, package_dir, 'info.py'))
        for info_file in glob(os.path.join(parent_path, package_dir, 'info.pyc')):
            if info_file[:-1] not in files:
                files.append(info_file)
        info_files = []
        for info_file in files:
            package_name = os.path.dirname(info_file[len(parent_path)+1:])\
                           .replace(os.sep, '.')
            if parent_package:
                package_name = parent_package + '.' + package_name
            info_files.append((package_name, info_file))
            info_files.extend(self._get_info_files('*',
                                                   os.path.dirname(info_file),
                                                   package_name))
        return info_files

    def _init_info_modules(self, packages=None):
        """Initialize info_modules = {<package_name>: <package info.py module>}.
        """
        from numpy.compat import npy_load_module
        info_files = []
        info_modules = self.info_modules

        if packages is None:
            for path in self.parent_path:
                info_files.extend(self._get_info_files('*', path))
        else:
            for package_name in packages:
                package_dir = os.path.join(*package_name.split('.'))
                for path in self.parent_path:
                    names_files = self._get_info_files(package_dir, path)
                    if names_files:
                        info_files.extend(names_files)
                        break
                else:
                    try:
                        exec('import %s.info as info' % (package_name))
                        info_modules[package_name] = info
                    except ImportError as msg:
                        self.warn('No scipy-style subpackage %r found in %s. '\
                                  'Ignoring: %s'\
                                  % (package_name, ':'.join(self.parent_path), msg))

        for package_name, info_file in info_files:
            if package_name in info_modules:
                continue
            fullname = self.parent_name +'.'+ package_name
            if info_file[-1]=='c':
                filedescriptor = ('.pyc', 'rb', 2)
            else:
                filedescriptor = ('.py', 'U', 1)

            try:
                info_module = npy_load_module(fullname + '.info',
                                              info_file,
                                              filedescriptor)
            except Exception as msg:
                self.error(msg)
                info_module = None

            if info_module is None or getattr(info_module, 'ignore', False):
                info_modules.pop(package_name, None)
            else:
                self._init_info_modules(getattr(info_module, 'depends', []))
                info_modules[package_name] = info_module

        return

    def _get_sorted_names(self):
        """ Return package names sorted in the order as they should be
        imported due to dependence relations between packages.
        """

        depend_dict = {}
        for name, info_module in self.info_modules.items():
            depend_dict[name] = getattr(info_module, 'depends', [])
        package_names = []

        for name in list(depend_dict.keys()):
            if not depend_dict[name]:
                package_names.append(name)
                del depend_dict[name]

        while depend_dict:
            for name, lst in list(depend_dict.items()):
                new_lst = [n for n in lst if n in depend_dict]
                if not new_lst:
                    package_names.append(name)
                    del depend_dict[name]
                else:
                    depend_dict[name] = new_lst

        return package_names

    def __call__(self,*packages, **options):
        """Load one or more packages into parent package top-level namespace.

       This function is intended to shorten the need to import many
       subpackages, say of scipy, constantly with statements such as

         import scipy.linalg, scipy.fftpack, scipy.etc...

       Instead, you can say:

         import scipy
         scipy.pkgload('linalg','fftpack',...)

       or

         scipy.pkgload()

       to load all of them in one call.

       If a name which doesn't exist in scipy's namespace is
       given, a warning is shown.

       Parameters
       ----------
        *packages : arg-tuple
             the names (one or more strings) of all the modules one
             wishes to load into the top-level namespace.
        verbose= : integer
             verbosity level [default: -1].
             verbose=-1 will suspend also warnings.
        force= : bool
             when True, force reloading loaded packages [default: False].
        postpone= : bool
             when True, don't load packages [default: False]

        """
        # 2014-10-29, 1.10
        warnings.warn('pkgload and PackageLoader are obsolete '
                'and will be removed in a future version of numpy',
                DeprecationWarning, stacklevel=2)
        frame = self.parent_frame
        self.info_modules = {}
        if options.get('force', False):
            self.imported_packages = []
        self.verbose = verbose = options.get('verbose', -1)
        postpone = options.get('postpone', None)
        self._init_info_modules(packages or None)

        self.log('Imports to %r namespace\n----------------------------'\
                 % self.parent_name)

        for package_name in self._get_sorted_names():
            if package_name in self.imported_packages:
                continue
            info_module = self.info_modules[package_name]
            global_symbols = getattr(info_module, 'global_symbols', [])
            postpone_import = getattr(info_module, 'postpone_import', False)
            if (postpone and not global_symbols) \
                   or (postpone_import and postpone is not None):
                continue

            old_object = frame.f_locals.get(package_name, None)

            cmdstr = 'import '+package_name
            if self._execcmd(cmdstr):
                continue
            self.imported_packages.append(package_name)

            if verbose!=-1:
                new_object = frame.f_locals.get(package_name)
                if old_object is not None and old_object is not new_object:
                    self.warn('Overwriting %s=%s (was %s)' \
                              % (package_name, self._obj2repr(new_object),
                                 self._obj2repr(old_object)))

            if '.' not in package_name:
                self.parent_export_names.append(package_name)

            for symbol in global_symbols:
                if symbol=='*':
                    symbols = eval('getattr(%s,"__all__",None)'\
                                   % (package_name),
                                   frame.f_globals, frame.f_locals)
                    if symbols is None:
                        symbols = eval('dir(%s)' % (package_name),
                                       frame.f_globals, frame.f_locals)
                        symbols = [s for s in symbols if not s.startswith('_')]
                else:
                    symbols = [symbol]

                if verbose!=-1:
                    old_objects = {}
                    for s in symbols:
                        if s in frame.f_locals:
                            old_objects[s] = frame.f_locals[s]

                cmdstr = 'from '+package_name+' import '+symbol
                if self._execcmd(cmdstr):
                    continue

                if verbose!=-1:
                    for s, old_object in old_objects.items():
                        new_object = frame.f_locals[s]
                        if new_object is not old_object:
                            self.warn('Overwriting %s=%s (was %s)' \
                                      % (s, self._obj2repr(new_object),
                                         self._obj2repr(old_object)))

                if symbol=='*':
                    self.parent_export_names.extend(symbols)
                else:
                    self.parent_export_names.append(symbol)

        return

    def _execcmd(self, cmdstr):
        """ Execute command in parent_frame."""
        frame = self.parent_frame
        try:
            exec (cmdstr, frame.f_globals, frame.f_locals)
        except Exception as msg:
            self.error('%s -> failed: %s' % (cmdstr, msg))
            return True
        else:
            self.log('%s -> success' % (cmdstr))
        return

    def _obj2repr(self, obj):
        """ Return repr(obj) with"""
        module = getattr(obj, '__module__', None)
        file = getattr(obj, '__file__', None)
        if module is not None:
            return repr(obj) + ' from ' + module
        if file is not None:
            return repr(obj) + ' from ' + file
        return repr(obj)

    def log(self, mess):
        if self.verbose>1:
            print(str(mess), file=sys.stderr)
    def warn(self, mess):
        if self.verbose>=0:
            print(str(mess), file=sys.stderr)
    def error(self, mess):
        if self.verbose!=-1:
            print(str(mess), file=sys.stderr)

    def _get_doc_title(self, info_module):
        """ Get the title from a package info.py file.
        """
        title = getattr(info_module, '__doc_title__', None)
        if title is not None:
            return title
        title = getattr(info_module, '__doc__', None)
        if title is not None:
            title = title.lstrip().split('\n', 1)[0]
            return title
        return '* Not Available *'

    def _format_titles(self,titles,colsep='---'):
        display_window_width = 70 # How to determine the correct value in runtime??
        lengths = [len(name)-name.find('.')-1 for (name, title) in titles]+[0]
        max_length = max(lengths)
        lines = []
        for (name, title) in titles:
            name = name[name.find('.')+1:]
            w = max_length - len(name)
            words = title.split()
            line = '%s%s %s' % (name, w*' ', colsep)
            tab = len(line) * ' '
            while words:
                word = words.pop(0)
                if len(line)+len(word)>display_window_width:
                    lines.append(line)
                    line = tab
                line += ' ' + word
            else:
                lines.append(line)
        return '\n'.join(lines)

    def get_pkgdocs(self):
        """ Return documentation summary of subpackages.
        """
        import sys
        self.info_modules = {}
        self._init_info_modules(None)

        titles = []
        symbols = []
        for package_name, info_module in self.info_modules.items():
            global_symbols = getattr(info_module, 'global_symbols', [])
            fullname = self.parent_name +'.'+ package_name
            note = ''
            if fullname not in sys.modules:
                note = ' [*]'
            titles.append((fullname, self._get_doc_title(info_module) + note))
            if global_symbols:
                symbols.append((package_name, ', '.join(global_symbols)))

        retstr = self._format_titles(titles) +\
               '\n  [*] - using a package requires explicit import (see pkgload)'


        if symbols:
            retstr += """\n\nGlobal symbols from subpackages"""\
                      """\n-------------------------------\n""" +\
                      self._format_titles(symbols, '-->')

        return retstr

class PackageLoaderDebug(PackageLoader):
    def _execcmd(self, cmdstr):
        """ Execute command in parent_frame."""
        frame = self.parent_frame
        print('Executing', repr(cmdstr), '...', end=' ')
        sys.stdout.flush()
        exec (cmdstr, frame.f_globals, frame.f_locals)
        print('ok')
        sys.stdout.flush()
        return

if int(os.environ.get('NUMPY_IMPORT_DEBUG', '0')):
    PackageLoader = PackageLoaderDebug
