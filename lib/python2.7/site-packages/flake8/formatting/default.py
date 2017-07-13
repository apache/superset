"""Default formatting class for Flake8."""
from flake8.formatting import base


class SimpleFormatter(base.BaseFormatter):
    """Simple abstraction for Default and Pylint formatter commonality.

    Sub-classes of this need to define an ``error_format`` attribute in order
    to succeed. The ``format`` method relies on that attribute and expects the
    ``error_format`` string to use the old-style formatting strings with named
    parameters:

    * code
    * text
    * path
    * row
    * col

    """

    error_format = None

    def format(self, error):
        """Format and write error out.

        If an output filename is specified, write formatted errors to that
        file. Otherwise, print the formatted error to standard out.
        """
        return self.error_format % {
            "code": error.code,
            "text": error.text,
            "path": error.filename,
            "row": error.line_number,
            "col": error.column_number,
        }


class Default(SimpleFormatter):
    """Default formatter for Flake8.

    This also handles backwards compatibility for people specifying a custom
    format string.
    """

    error_format = '%(path)s:%(row)d:%(col)d: %(code)s %(text)s'

    def after_init(self):
        """Check for a custom format string."""
        if self.options.format.lower() != 'default':
            self.error_format = self.options.format


class Pylint(SimpleFormatter):
    """Pylint formatter for Flake8."""

    error_format = '%(path)s:%(row)d: [%(code)s] %(text)s'


class FilenameOnly(SimpleFormatter):
    """Only print filenames, e.g., flake8 -q."""

    error_format = '%(path)s'

    def after_init(self):
        """Initialize our set of filenames."""
        self.filenames_already_printed = set()

    def show_source(self, error):
        """Do not include the source code."""
        pass

    def format(self, error):
        """Ensure we only print each error once."""
        if error.filename not in self.filenames_already_printed:
            self.filenames_already_printed.add(error.filename)
            return super(FilenameOnly, self).format(error)


class Nothing(base.BaseFormatter):
    """Print absolutely nothing."""

    def format(self, error):
        """Do nothing."""
        pass

    def show_source(self, error):
        """Do not print the source."""
        pass
