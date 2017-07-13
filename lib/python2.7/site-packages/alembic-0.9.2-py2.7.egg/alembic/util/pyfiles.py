import sys
import os
import re
from .compat import load_module_py, load_module_pyc
from mako.template import Template
from mako import exceptions
import tempfile
from .exc import CommandError


def template_to_file(template_file, dest, output_encoding, **kw):
    template = Template(filename=template_file)
    try:
        output = template.render_unicode(**kw).encode(output_encoding)
    except:
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as ntf:
            ntf.write(
                exceptions.text_error_template().
                render_unicode().encode(output_encoding))
            fname = ntf.name
        raise CommandError(
            "Template rendering failed; see %s for a "
            "template-oriented traceback." % fname)
    else:
        with open(dest, 'wb') as f:
            f.write(output)


def coerce_resource_to_filename(fname):
    """Interpret a filename as either a filesystem location or as a package
    resource.

    Names that are non absolute paths and contain a colon
    are interpreted as resources and coerced to a file location.

    """
    if not os.path.isabs(fname) and ":" in fname:
        import pkg_resources
        fname = pkg_resources.resource_filename(*fname.split(':'))
    return fname


def simple_pyc_file_from_path(path):
    """Given a python source path, return the so-called
    "sourceless" .pyc or .pyo path.

    This just a .pyc or .pyo file where the .py file would be.

    Even with PEP-3147, which normally puts .pyc/.pyo files in __pycache__,
    this use case remains supported as a so-called "sourceless module import".

    """
    if sys.flags.optimize:
        return path + "o"  # e.g. .pyo
    else:
        return path + "c"  # e.g. .pyc


def pyc_file_from_path(path):
    """Given a python source path, locate the .pyc.

    See http://www.python.org/dev/peps/pep-3147/
                        #detecting-pep-3147-availability
        http://www.python.org/dev/peps/pep-3147/#file-extension-checks

    """
    import imp
    has3147 = hasattr(imp, 'get_tag')
    if has3147:
        return imp.cache_from_source(path)
    else:
        return simple_pyc_file_from_path(path)


def edit(path):
    """Given a source path, run the EDITOR for it"""

    import editor
    try:
        editor.edit(path)
    except Exception as exc:
        raise CommandError('Error executing editor (%s)' % (exc,))


def load_python_file(dir_, filename):
    """Load a file from the given path as a Python module."""

    module_id = re.sub(r'\W', "_", filename)
    path = os.path.join(dir_, filename)
    _, ext = os.path.splitext(filename)
    if ext == ".py":
        if os.path.exists(path):
            module = load_module_py(module_id, path)
        elif os.path.exists(simple_pyc_file_from_path(path)):
            # look for sourceless load
            module = load_module_pyc(
                module_id, simple_pyc_file_from_path(path))
        else:
            raise ImportError("Can't find Python file %s" % path)
    elif ext in (".pyc", ".pyo"):
        module = load_module_pyc(module_id, path)
    del sys.modules[module_id]
    return module
