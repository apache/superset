# Copyright (c) 2008-2010, 2012-2014 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""
  %prog [options] <packages>

  create UML diagrams for classes and modules in <packages>
"""
from __future__ import print_function

import os
import subprocess
import sys

from pylint.config import ConfigurationMixIn
from pylint.pyreverse.inspector import Linker, project_from_files
from pylint.pyreverse.diadefslib import DiadefsHandler
from pylint.pyreverse import writer
from pylint.pyreverse.utils import insert_default_options

OPTIONS = (
    ("filter-mode",
     dict(short='f', default='PUB_ONLY', dest='mode', type='string',
          action='store', metavar='<mode>',
          help="""filter attributes and functions according to
    <mode>. Correct modes are :
                            'PUB_ONLY' filter all non public attributes
                                [DEFAULT], equivalent to PRIVATE+SPECIAL_A
                            'ALL' no filter
                            'SPECIAL' filter Python special functions
                                except constructor
                            'OTHER' filter protected and private
                                attributes""")),

    ("class",
     dict(short='c', action="append", metavar="<class>", dest="classes", default=[],
          help="create a class diagram with all classes related to <class>;\
 this uses by default the options -ASmy")),

    ("show-ancestors",
     dict(short="a", action="store", metavar='<ancestor>', type='int',
          help='show <ancestor> generations of ancestor classes not in <projects>')),
    ("all-ancestors",
     dict(short="A", default=None,
          help="show all ancestors off all classes in <projects>")),
    ("show-associated",
     dict(short='s', action="store", metavar='<ass_level>', type='int',
          help='show <ass_level> levels of associated classes not in <projects>')),
    ("all-associated",
     dict(short='S', default=None,
          help='show recursively all associated off all associated classes')),
    ("show-builtin",
     dict(short="b", action="store_true", default=False,
          help='include builtin objects in representation of classes')),

    ("module-names",
     dict(short="m", default=None, type='yn', metavar='[yn]',
          help='include module name in representation of classes')),
    # TODO : generate dependencies like in pylint
    # ("package-dependencies",
    # dict(short="M", action="store", metavar='<package_depth>', type='int',
    #     help='show <package_depth> module dependencies beyond modules in \
    # <projects> (for the package diagram)')),
    ("only-classnames",
     dict(short='k', action="store_true", default=False,
          help="don't show attributes and methods in the class boxes; \
this disables -f values")),
    ("output", dict(short="o", dest="output_format", action="store",
                    default="dot", metavar="<format>",
                    help="create a *.<format> output file if format available.")),
    ("ignore", {'type' : "csv", 'metavar' : "<file[,file...]>",
                'dest' : "black_list", "default" : ('CVS',),
                'help' : "Add files or directories to the blacklist. They "
                         "should be base names, not paths."}),
    ("project", {'default': "", 'type' : 'string', 'short': 'p',
                 'metavar': '<project name>', 'help': 'set the project name.'}),
)
# FIXME : quiet mode
#( ('quiet',
                #dict(help='run quietly', action='store_true', short='q')), )

def _check_graphviz_available(output_format):
    """check if we need graphviz for different output format"""
    try:
        subprocess.call(['dot', '-V'], stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE)
    except OSError:
        print("The output format '%s' is currently not available.\n"
              "Please install 'Graphviz' to have other output formats "
              "than 'dot' or 'vcg'." % output_format)
        sys.exit(32)



class Run(ConfigurationMixIn):
    """base class providing common behaviour for pyreverse commands"""

    options = OPTIONS

    def __init__(self, args):
        ConfigurationMixIn.__init__(self, usage=__doc__)
        insert_default_options()
        args = self.load_command_line_configuration()
        if self.config.output_format not in ('dot', 'vcg'):
            _check_graphviz_available(self.config.output_format)

        sys.exit(self.run(args))

    def run(self, args):
        """checking arguments and run project"""
        if not args:
            print(self.help())
            return 1
        # insert current working directory to the python path to recognize
        # dependencies to local modules even if cwd is not in the PYTHONPATH
        sys.path.insert(0, os.getcwd())
        try:
            project = project_from_files(args, project_name=self.config.project,
                                         black_list=self.config.black_list)
            linker = Linker(project, tag=True)
            handler = DiadefsHandler(self.config)
            diadefs = handler.get_diadefs(project, linker)
        finally:
            sys.path.pop(0)

        if self.config.output_format == "vcg":
            writer.VCGWriter(self.config).write(diadefs)
        else:
            writer.DotWriter(self.config).write(diadefs)
        return 0


if __name__ == '__main__':
    Run(sys.argv[1:])
