# mako/cmd.py
# Copyright (C) 2006-2016 the Mako authors and contributors <see AUTHORS file>
#
# This module is part of Mako and is released under
# the MIT License: http://www.opensource.org/licenses/mit-license.php
from argparse import ArgumentParser
from os.path import isfile, dirname
import sys
from mako.template import Template
from mako.lookup import TemplateLookup
from mako import exceptions


def varsplit(var):
    if "=" not in var:
        return (var, "")
    return var.split("=", 1)


def _exit():
    sys.stderr.write(exceptions.text_error_template().render())
    sys.exit(1)


def cmdline(argv=None):

    parser = ArgumentParser("usage: %prog [FILENAME]")
    parser.add_argument(
        "--var", default=[], action="append",
        help="variable (can be used multiple times, use name=value)")
    parser.add_argument(
        "--template-dir", default=[], action="append",
        help="Directory to use for template lookup (multiple "
        "directories may be provided). If not given then if the "
        "template is read from stdin, the value defaults to be "
        "the current directory, otherwise it defaults to be the "
        "parent directory of the file provided.")
    parser.add_argument('input', nargs='?', default='-')

    options = parser.parse_args(argv)
    if options.input == '-':
        lookup_dirs = options.template_dir or ["."]
        lookup = TemplateLookup(lookup_dirs)
        try:
            template = Template(sys.stdin.read(), lookup=lookup)
        except:
            _exit()
    else:
        filename = options.input
        if not isfile(filename):
            raise SystemExit("error: can't find %s" % filename)
        lookup_dirs = options.template_dir or [dirname(filename)]
        lookup = TemplateLookup(lookup_dirs)
        try:
            template = Template(filename=filename, lookup=lookup)
        except:
            _exit()

    kw = dict([varsplit(var) for var in options.var])
    try:
        print(template.render(**kw))
    except:
        _exit()


if __name__ == "__main__":
    cmdline()
