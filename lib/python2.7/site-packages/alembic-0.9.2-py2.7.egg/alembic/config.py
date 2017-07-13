from argparse import ArgumentParser
from .util.compat import SafeConfigParser
import inspect
import os
import sys

from . import command
from . import util
from . import package_dir
from .util import compat


class Config(object):

    """Represent an Alembic configuration.

    Within an ``env.py`` script, this is available
    via the :attr:`.EnvironmentContext.config` attribute,
    which in turn is available at ``alembic.context``::

        from alembic import context

        some_param = context.config.get_main_option("my option")

    When invoking Alembic programatically, a new
    :class:`.Config` can be created by passing
    the name of an .ini file to the constructor::

        from alembic.config import Config
        alembic_cfg = Config("/path/to/yourapp/alembic.ini")

    With a :class:`.Config` object, you can then
    run Alembic commands programmatically using the directives
    in :mod:`alembic.command`.

    The :class:`.Config` object can also be constructed without
    a filename.   Values can be set programmatically, and
    new sections will be created as needed::

        from alembic.config import Config
        alembic_cfg = Config()
        alembic_cfg.set_main_option("script_location", "myapp:migrations")
        alembic_cfg.set_main_option("url", "postgresql://foo/bar")
        alembic_cfg.set_section_option("mysection", "foo", "bar")

    .. warning::

       When using programmatic configuration, make sure the
       ``env.py`` file in use is compatible with the target configuration;
       including that the call to Python ``logging.fileConfig()`` is
       omitted if the programmatic configuration doesn't actually include
       logging directives.

    For passing non-string values to environments, such as connections and
    engines, use the :attr:`.Config.attributes` dictionary::

        with engine.begin() as connection:
            alembic_cfg.attributes['connection'] = connection
            command.upgrade(alembic_cfg, "head")

    :param file_: name of the .ini file to open.
    :param ini_section: name of the main Alembic section within the
     .ini file
    :param output_buffer: optional file-like input buffer which
     will be passed to the :class:`.MigrationContext` - used to redirect
     the output of "offline generation" when using Alembic programmatically.
    :param stdout: buffer where the "print" output of commands will be sent.
     Defaults to ``sys.stdout``.

     .. versionadded:: 0.4

    :param config_args: A dictionary of keys and values that will be used
     for substitution in the alembic config file.  The dictionary as given
     is **copied** to a new one, stored locally as the attribute
     ``.config_args``. When the :attr:`.Config.file_config` attribute is
     first invoked, the replacement variable ``here`` will be added to this
     dictionary before the dictionary is passed to ``SafeConfigParser()``
     to parse the .ini file.

     .. versionadded:: 0.7.0

    :param attributes: optional dictionary of arbitrary Python keys/values,
     which will be populated into the :attr:`.Config.attributes` dictionary.

     .. versionadded:: 0.7.5

     .. seealso::

        :ref:`connection_sharing`

    """

    def __init__(self, file_=None, ini_section='alembic', output_buffer=None,
                 stdout=sys.stdout, cmd_opts=None,
                 config_args=util.immutabledict(), attributes=None):
        """Construct a new :class:`.Config`

        """
        self.config_file_name = file_
        self.config_ini_section = ini_section
        self.output_buffer = output_buffer
        self.stdout = stdout
        self.cmd_opts = cmd_opts
        self.config_args = dict(config_args)
        if attributes:
            self.attributes.update(attributes)

    cmd_opts = None
    """The command-line options passed to the ``alembic`` script.

    Within an ``env.py`` script this can be accessed via the
    :attr:`.EnvironmentContext.config` attribute.

    .. versionadded:: 0.6.0

    .. seealso::

        :meth:`.EnvironmentContext.get_x_argument`

    """

    config_file_name = None
    """Filesystem path to the .ini file in use."""

    config_ini_section = None
    """Name of the config file section to read basic configuration
    from.  Defaults to ``alembic``, that is the ``[alembic]`` section
    of the .ini file.  This value is modified using the ``-n/--name``
    option to the Alembic runnier.

    """

    @util.memoized_property
    def attributes(self):
        """A Python dictionary for storage of additional state.


        This is a utility dictionary which can include not just strings but
        engines, connections, schema objects, or anything else.
        Use this to pass objects into an env.py script, such as passing
        a :class:`sqlalchemy.engine.base.Connection` when calling
        commands from :mod:`alembic.command` programmatically.

        .. versionadded:: 0.7.5

        .. seealso::

            :ref:`connection_sharing`

            :paramref:`.Config.attributes`

        """
        return {}

    def print_stdout(self, text, *arg):
        """Render a message to standard out."""

        util.write_outstream(
            self.stdout,
            (compat.text_type(text) % arg),
            "\n"
        )

    @util.memoized_property
    def file_config(self):
        """Return the underlying ``ConfigParser`` object.

        Direct access to the .ini file is available here,
        though the :meth:`.Config.get_section` and
        :meth:`.Config.get_main_option`
        methods provide a possibly simpler interface.

        """

        if self.config_file_name:
            here = os.path.abspath(os.path.dirname(self.config_file_name))
        else:
            here = ""
        self.config_args['here'] = here
        file_config = SafeConfigParser(self.config_args)
        if self.config_file_name:
            file_config.read([self.config_file_name])
        else:
            file_config.add_section(self.config_ini_section)
        return file_config

    def get_template_directory(self):
        """Return the directory where Alembic setup templates are found.

        This method is used by the alembic ``init`` and ``list_templates``
        commands.

        """
        return os.path.join(package_dir, 'templates')

    def get_section(self, name):
        """Return all the configuration options from a given .ini file section
        as a dictionary.

        """
        return dict(self.file_config.items(name))

    def set_main_option(self, name, value):
        """Set an option programmatically within the 'main' section.

        This overrides whatever was in the .ini file.

        :param name: name of the value

        :param value: the value.  Note that this value is passed to
         ``ConfigParser.set``, which supports variable interpolation using
         pyformat (e.g. ``%(some_value)s``).   A raw percent sign not part of
         an interpolation symbol must therefore be escaped, e.g. ``%%``.
         The given value may refer to another value already in the file
         using the interpolation format.

        """
        self.set_section_option(self.config_ini_section, name, value)

    def remove_main_option(self, name):
        self.file_config.remove_option(self.config_ini_section, name)

    def set_section_option(self, section, name, value):
        """Set an option programmatically within the given section.

        The section is created if it doesn't exist already.
        The value here will override whatever was in the .ini
        file.

        :param section: name of the section

        :param name: name of the value

        :param value: the value.  Note that this value is passed to
         ``ConfigParser.set``, which supports variable interpolation using
         pyformat (e.g. ``%(some_value)s``).   A raw percent sign not part of
         an interpolation symbol must therefore be escaped, e.g. ``%%``.
         The given value may refer to another value already in the file
         using the interpolation format.

        """

        if not self.file_config.has_section(section):
            self.file_config.add_section(section)
        self.file_config.set(section, name, value)

    def get_section_option(self, section, name, default=None):
        """Return an option from the given section of the .ini file.

        """
        if not self.file_config.has_section(section):
            raise util.CommandError("No config file %r found, or file has no "
                                    "'[%s]' section" %
                                    (self.config_file_name, section))
        if self.file_config.has_option(section, name):
            return self.file_config.get(section, name)
        else:
            return default

    def get_main_option(self, name, default=None):
        """Return an option from the 'main' section of the .ini file.

        This defaults to being a key from the ``[alembic]``
        section, unless the ``-n/--name`` flag were used to
        indicate a different section.

        """
        return self.get_section_option(self.config_ini_section, name, default)


class CommandLine(object):

    def __init__(self, prog=None):
        self._generate_args(prog)

    def _generate_args(self, prog):
        def add_options(parser, positional, kwargs):
            kwargs_opts = {
                'template': (
                    "-t", "--template",
                    dict(
                        default='generic',
                        type=str,
                        help="Setup template for use with 'init'"
                    )
                ),
                'message': (
                    "-m", "--message",
                    dict(
                        type=str,
                        help="Message string to use with 'revision'")
                ),
                'sql': (
                    "--sql",
                    dict(
                        action="store_true",
                        help="Don't emit SQL to database - dump to "
                        "standard output/file instead"
                    )
                ),
                'tag': (
                    "--tag",
                    dict(
                        type=str,
                        help="Arbitrary 'tag' name - can be used by "
                        "custom env.py scripts.")
                ),
                'head': (
                    "--head",
                    dict(
                        type=str,
                        help="Specify head revision or <branchname>@head "
                        "to base new revision on."
                    )
                ),
                'splice': (
                    "--splice",
                    dict(
                        action="store_true",
                        help="Allow a non-head revision as the "
                        "'head' to splice onto"
                    )
                ),
                'depends_on': (
                    "--depends-on",
                    dict(
                        action="append",
                        help="Specify one or more revision identifiers "
                        "which this revision should depend on."
                    )
                ),
                'rev_id': (
                    "--rev-id",
                    dict(
                        type=str,
                        help="Specify a hardcoded revision id instead of "
                        "generating one"
                    )
                ),
                'version_path': (
                    "--version-path",
                    dict(
                        type=str,
                        help="Specify specific path from config for "
                        "version file"
                    )
                ),
                'branch_label': (
                    "--branch-label",
                    dict(
                        type=str,
                        help="Specify a branch label to apply to the "
                        "new revision"
                    )
                ),
                'verbose': (
                    "-v", "--verbose",
                    dict(
                        action="store_true",
                        help="Use more verbose output"
                    )
                ),
                'resolve_dependencies': (
                    '--resolve-dependencies',
                    dict(
                        action="store_true",
                        help="Treat dependency versions as down revisions"
                    )
                ),
                'autogenerate': (
                    "--autogenerate",
                    dict(
                        action="store_true",
                        help="Populate revision script with candidate "
                        "migration operations, based on comparison "
                        "of database to model.")
                ),
                'head_only': (
                    "--head-only",
                    dict(
                        action="store_true",
                        help="Deprecated.  Use --verbose for "
                        "additional output")
                ),
                'rev_range': (
                    "-r", "--rev-range",
                    dict(
                        action="store",
                        help="Specify a revision range; "
                        "format is [start]:[end]")
                )
            }
            positional_help = {
                'directory': "location of scripts directory",
                'revision': "revision identifier",
                'revisions': "one or more revisions, or 'heads' for all heads"

            }
            for arg in kwargs:
                if arg in kwargs_opts:
                    args = kwargs_opts[arg]
                    args, kw = args[0:-1], args[-1]
                    parser.add_argument(*args, **kw)

            for arg in positional:
                if arg == "revisions":
                    subparser.add_argument(
                        arg, nargs='+', help=positional_help.get(arg))
                else:
                    subparser.add_argument(arg, help=positional_help.get(arg))

        parser = ArgumentParser(prog=prog)
        parser.add_argument("-c", "--config",
                            type=str,
                            default="alembic.ini",
                            help="Alternate config file")
        parser.add_argument("-n", "--name",
                            type=str,
                            default="alembic",
                            help="Name of section in .ini file to "
                                    "use for Alembic config")
        parser.add_argument("-x", action="append",
                            help="Additional arguments consumed by "
                            "custom env.py scripts, e.g. -x "
                            "setting1=somesetting -x setting2=somesetting")
        parser.add_argument("--raiseerr", action="store_true",
                            help="Raise a full stack trace on error")
        subparsers = parser.add_subparsers()

        for fn in [getattr(command, n) for n in dir(command)]:
            if inspect.isfunction(fn) and \
                    fn.__name__[0] != '_' and \
                    fn.__module__ == 'alembic.command':

                spec = inspect.getargspec(fn)
                if spec[3]:
                    positional = spec[0][1:-len(spec[3])]
                    kwarg = spec[0][-len(spec[3]):]
                else:
                    positional = spec[0][1:]
                    kwarg = []

                subparser = subparsers.add_parser(
                    fn.__name__,
                    help=fn.__doc__)
                add_options(subparser, positional, kwarg)
                subparser.set_defaults(cmd=(fn, positional, kwarg))
        self.parser = parser

    def run_cmd(self, config, options):
        fn, positional, kwarg = options.cmd

        try:
            fn(config,
               *[getattr(options, k, None) for k in positional],
               **dict((k, getattr(options, k, None)) for k in kwarg)
               )
        except util.CommandError as e:
            if options.raiseerr:
                raise
            else:
                util.err(str(e))

    def main(self, argv=None):
        options = self.parser.parse_args(argv)
        if not hasattr(options, "cmd"):
            # see http://bugs.python.org/issue9253, argparse
            # behavior changed incompatibly in py3.3
            self.parser.error("too few arguments")
        else:
            cfg = Config(file_=options.config,
                         ini_section=options.name, cmd_opts=options)
            self.run_cmd(cfg, options)


def main(argv=None, prog=None, **kwargs):
    """The console runner function for Alembic."""

    CommandLine(prog=prog).main(argv=argv)

if __name__ == '__main__':
    main()
