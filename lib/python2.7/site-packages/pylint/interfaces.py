# Copyright (c) 2009-2010, 2012-2013 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2015 Florian Bruhin <me@the-compiler.org>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Interfaces for Pylint objects"""
from collections import namedtuple

Confidence = namedtuple('Confidence', ['name', 'description'])
# Warning Certainties
HIGH = Confidence('HIGH', 'No false positive possible.')
INFERENCE = Confidence('INFERENCE', 'Warning based on inference result.')
INFERENCE_FAILURE = Confidence('INFERENCE_FAILURE',
                               'Warning based on inference with failures.')
UNDEFINED = Confidence('UNDEFINED',
                       'Warning without any associated confidence level.')

CONFIDENCE_LEVELS = [HIGH, INFERENCE, INFERENCE_FAILURE, UNDEFINED]


class Interface(object):
    """Base class for interfaces."""
    @classmethod
    def is_implemented_by(cls, instance):
        return implements(instance, cls)


def implements(obj, interface):
    """Return true if the give object (maybe an instance or class) implements
    the interface.
    """
    kimplements = getattr(obj, '__implements__', ())
    if not isinstance(kimplements, (list, tuple)):
        kimplements = (kimplements,)
    for implementedinterface in kimplements:
        if issubclass(implementedinterface, interface):
            return True
    return False


class IChecker(Interface):
    """This is an base interface, not designed to be used elsewhere than for
    sub interfaces definition.
    """

    def open(self):
        """called before visiting project (i.e set of modules)"""

    def close(self):
        """called after visiting project (i.e set of modules)"""


class IRawChecker(IChecker):
    """interface for checker which need to parse the raw file
    """

    def process_module(self, astroid):
        """ process a module

        the module's content is accessible via astroid.stream
        """


class ITokenChecker(IChecker):
    """Interface for checkers that need access to the token list."""
    def process_tokens(self, tokens):
        """Process a module.

        tokens is a list of all source code tokens in the file.
        """


class IAstroidChecker(IChecker):
    """ interface for checker which prefers receive events according to
    statement type
    """


class IReporter(Interface):
    """ reporter collect messages and display results encapsulated in a layout
    """

    def handle_message(self, msg):
        """Handle the given message object."""

    def display_reports(self, layout):
        """display results encapsulated in the layout tree
        """


__all__ = ('IRawChecker', 'IAstroidChecker', 'ITokenChecker', 'IReporter')
