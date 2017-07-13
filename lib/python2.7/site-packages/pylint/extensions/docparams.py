# Copyright (c) 2014-2015 Bruno Daniel <bruno.daniel@blue-yonder.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>
# Copyright (c) 2016 Ashley Whetter <ashley@awhetter.co.uk>
# Copyright (c) 2016 Glenn Matthews <glenn@e-dad.net>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

"""Pylint plugin for checking in Sphinx, Google, or Numpy style docstrings
"""
from __future__ import print_function, division, absolute_import

import astroid

from pylint.interfaces import IAstroidChecker
from pylint.checkers import BaseChecker
from pylint.checkers.utils import node_frame_class
import pylint.extensions._check_docs_utils as utils


class DocstringParameterChecker(BaseChecker):
    """Checker for Sphinx, Google, or Numpy style docstrings

    * Check that all function, method and constructor parameters are mentioned
      in the params and types part of the docstring.  Constructor parameters
      can be documented in either the class docstring or ``__init__`` docstring,
      but not both.
    * Check that there are no naming inconsistencies between the signature and
      the documentation, i.e. also report documented parameters that are missing
      in the signature. This is important to find cases where parameters are
      renamed only in the code, not in the documentation.
    * Check that all explicitly raised exceptions in a function are documented
      in the function docstring. Caught exceptions are ignored.

    Activate this checker by adding the line::

        load-plugins=pylint.extensions.docparams

    to the ``MASTER`` section of your ``.pylintrc``.

    :param linter: linter object
    :type linter: :class:`pylint.lint.PyLinter`
    """
    __implements__ = IAstroidChecker

    name = 'parameter_documentation'
    msgs = {
        'W9005': ('"%s" has constructor parameters documented in class and __init__',
                  'multiple-constructor-doc',
                  'Please remove parameter declarations in the class or constructor.'),
        'W9006': ('"%s" not documented as being raised',
                  'missing-raises-doc',
                  'Please document exceptions for all raised exception types.'),
        'W9008': ('Redundant returns documentation',
                  'redundant-returns-doc',
                  'Please remove the return/rtype documentation from this method.'),
        'W9010': ('Redundant yields documentation',
                  'redundant-yields-doc',
                  'Please remove the yields documentation from this method.'),
        'W9011': ('Missing return documentation',
                  'missing-return-doc',
                  'Please add documentation about what this method returns.',
                  {'old_names': [('W9007', 'missing-returns-doc')]}),
        'W9012': ('Missing return type documentation',
                  'missing-return-type-doc',
                  'Please document the type returned by this method.',
                  # we can't use the same old_name for two different warnings
                  # {'old_names': [('W9007', 'missing-returns-doc')]},
                 ),
        'W9013': ('Missing yield documentation',
                  'missing-yield-doc',
                  'Please add documentation about what this generator yields.',
                  {'old_names': [('W9009', 'missing-yields-doc')]}),
        'W9014': ('Missing yield type documentation',
                  'missing-yield-type-doc',
                  'Please document the type yielded by this method.',
                  # we can't use the same old_name for two different warnings
                  # {'old_names': [('W9009', 'missing-yields-doc')]},
                 ),
        'W9015': ('"%s" missing in parameter documentation',
                  'missing-param-doc',
                  'Please add parameter declarations for all parameters.',
                  {'old_names': [('W9003', 'missing-param-doc')]}),
        'W9016': ('"%s" missing in parameter type documentation',
                  'missing-type-doc',
                  'Please add parameter type declarations for all parameters.',
                  {'old_names': [('W9004', 'missing-type-doc')]}),
        'W9017': ('"%s" differing in parameter documentation',
                  'differing-param-doc',
                  'Please check parameter names in declarations.',
                 ),
        'W9018': ('"%s" differing in parameter type documentation',
                  'differing-type-doc',
                  'Please check parameter names in type declarations.',
                 ),
    }

    options = (('accept-no-param-doc',
                {'default': True, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Whether to accept totally missing parameter '
                         'documentation in the docstring of a function that has '
                         'parameters.'
                }),
               ('accept-no-raise-doc',
                {'default': True, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Whether to accept totally missing raises '
                         'documentation in the docstring of a function that '
                         'raises an exception.'
                }),
               ('accept-no-return-doc',
                {'default': True, 'type' : 'yn', 'metavar' : '<y or n>',
                 'help': 'Whether to accept totally missing return '
                         'documentation in the docstring of a function that '
                         'returns a statement.'
                }),
               ('accept-no-yields-doc',
                {'default': True, 'type' : 'yn', 'metavar': '<y or n>',
                 'help': 'Whether to accept totally missing yields '
                         'documentation in the docstring of a generator.'
                }),
              )

    priority = -2

    constructor_names = {'__init__', '__new__'}
    not_needed_param_in_docstring = {'self', 'cls'}

    def visit_functiondef(self, node):
        """Called for function and method definitions (def).

        :param node: Node for a function or method definition in the AST
        :type node: :class:`astroid.scoped_nodes.Function`
        """
        node_doc = utils.docstringify(node.doc)
        self.check_functiondef_params(node, node_doc)
        self.check_functiondef_returns(node, node_doc)
        self.check_functiondef_yields(node, node_doc)

    def check_functiondef_params(self, node, node_doc):
        node_allow_no_param = None
        if node.name in self.constructor_names:
            class_node = node_frame_class(node)
            if class_node is not None:
                class_doc = utils.docstringify(class_node.doc)
                self.check_single_constructor_params(class_doc, node_doc, class_node)

                # __init__ or class docstrings can have no parameters documented
                # as long as the other documents them.
                node_allow_no_param = (
                    class_doc.has_params() or
                    class_doc.params_documented_elsewhere() or
                    None
                )
                class_allow_no_param = (
                    node_doc.has_params() or
                    node_doc.params_documented_elsewhere() or
                    None
                )

                self.check_arguments_in_docstring(
                    class_doc, node.args, class_node, class_allow_no_param)

        self.check_arguments_in_docstring(
            node_doc, node.args, node, node_allow_no_param)

    def check_functiondef_returns(self, node, node_doc):
        if not node_doc.supports_yields and node.is_generator():
            return

        return_nodes = node.nodes_of_class(astroid.Return)
        if ((node_doc.has_returns() or node_doc.has_rtype()) and
                not any(utils.returns_something(ret_node) for ret_node in return_nodes)):
            self.add_message(
                'redundant-returns-doc',
                node=node)

    def check_functiondef_yields(self, node, node_doc):
        if not node_doc.supports_yields:
            return

        if ((node_doc.has_yields() or node_doc.has_yields_type()) and
                not node.is_generator()):
            self.add_message(
                'redundant-yields-doc',
                node=node)

    def visit_raise(self, node):
        func_node = node.frame()
        if not isinstance(func_node, astroid.FunctionDef):
            return

        expected_excs = utils.possible_exc_types(node)
        if not expected_excs:
            return

        doc = utils.docstringify(func_node.doc)
        if not doc.is_valid():
            if doc.doc:
                self._handle_no_raise_doc(expected_excs, func_node)
            return

        found_excs = doc.exceptions()
        missing_excs = expected_excs - found_excs
        self._add_raise_message(missing_excs, func_node)

    def visit_return(self, node):
        if not utils.returns_something(node):
            return

        func_node = node.frame()
        if not isinstance(func_node, astroid.FunctionDef):
            return

        doc = utils.docstringify(func_node.doc)
        if not doc.is_valid() and self.config.accept_no_return_doc:
            return

        if not doc.has_returns():
            self.add_message(
                'missing-return-doc',
                node=func_node
            )

        if not doc.has_rtype():
            self.add_message(
                'missing-return-type-doc',
                node=func_node
            )

    def visit_yield(self, node):
        func_node = node.frame()
        if not isinstance(func_node, astroid.FunctionDef):
            return

        doc = utils.docstringify(func_node.doc)
        if not doc.is_valid() and self.config.accept_no_yields_doc:
            return

        if doc.supports_yields:
            doc_has_yields = doc.has_yields()
            doc_has_yields_type = doc.has_yields_type()
        else:
            doc_has_yields = doc.has_returns()
            doc_has_yields_type = doc.has_rtype()

        if not doc_has_yields:
            self.add_message(
                'missing-yield-doc',
                node=func_node
            )

        if not doc_has_yields_type:
            self.add_message(
                'missing-yield-type-doc',
                node=func_node
            )

    def visit_yieldfrom(self, node):
        self.visit_yield(node)

    def check_arguments_in_docstring(self, doc, arguments_node, warning_node,
                                     accept_no_param_doc=None):
        """Check that all parameters in a function, method or class constructor
        on the one hand and the parameters mentioned in the parameter
        documentation (e.g. the Sphinx tags 'param' and 'type') on the other
        hand are consistent with each other.

        * Undocumented parameters except 'self' are noticed.
        * Undocumented parameter types except for 'self' and the ``*<args>``
          and ``**<kwargs>`` parameters are noticed.
        * Parameters mentioned in the parameter documentation that don't or no
          longer exist in the function parameter list are noticed.
        * If the text "For the parameters, see" or "For the other parameters,
          see" (ignoring additional whitespace) is mentioned in the docstring,
          missing parameter documentation is tolerated.
        * If there's no Sphinx style, Google style or NumPy style parameter
          documentation at all, i.e. ``:param`` is never mentioned etc., the
          checker assumes that the parameters are documented in another format
          and the absence is tolerated.

        :param doc: Docstring for the function, method or class.
        :type doc: str

        :param arguments_node: Arguments node for the function, method or
            class constructor.
        :type arguments_node: :class:`astroid.scoped_nodes.Arguments`

        :param warning_node: The node to assign the warnings to
        :type warning_node: :class:`astroid.scoped_nodes.Node`

        :param accept_no_param_doc: Whether or not to allow no parameters
            to be documented.
            If None then this value is read from the configuration.
        :type accept_no_param_doc: bool or None
        """
        # Tolerate missing param or type declarations if there is a link to
        # another method carrying the same name.
        if not doc.doc:
            return

        if accept_no_param_doc is None:
            accept_no_param_doc = self.config.accept_no_param_doc
        tolerate_missing_params = doc.params_documented_elsewhere()

        # Collect the function arguments.
        expected_argument_names = set(arg.name for arg in arguments_node.args)
        expected_argument_names.update(arg.name for arg in arguments_node.kwonlyargs)
        not_needed_type_in_docstring = (
            self.not_needed_param_in_docstring.copy())

        if arguments_node.vararg is not None:
            expected_argument_names.add(arguments_node.vararg)
            not_needed_type_in_docstring.add(arguments_node.vararg)
        if arguments_node.kwarg is not None:
            expected_argument_names.add(arguments_node.kwarg)
            not_needed_type_in_docstring.add(arguments_node.kwarg)
        params_with_doc, params_with_type = doc.match_param_docs()

        # Tolerate no parameter documentation at all.
        if (not params_with_doc and not params_with_type
                and accept_no_param_doc):
            tolerate_missing_params = True

        def _compare_missing_args(found_argument_names, message_id,
                                  not_needed_names):
            """Compare the found argument names with the expected ones and
            generate a message if there are arguments missing.

            :param set found_argument_names: argument names found in the
                docstring

            :param str message_id: pylint message id

            :param not_needed_names: names that may be omitted
            :type not_needed_names: set of str
            """
            if not tolerate_missing_params:
                missing_argument_names = (
                    (expected_argument_names - found_argument_names)
                    - not_needed_names)
                if missing_argument_names:
                    self.add_message(
                        message_id,
                        args=(', '.join(
                            sorted(missing_argument_names)),),
                        node=warning_node)

        def _compare_different_args(found_argument_names, message_id,
                                    not_needed_names):
            """Compare the found argument names with the expected ones and
            generate a message if there are extra arguments found.

            :param set found_argument_names: argument names found in the
                docstring

            :param str message_id: pylint message id

            :param not_needed_names: names that may be omitted
            :type not_needed_names: set of str
            """
            differing_argument_names = (
                (expected_argument_names ^ found_argument_names)
                - not_needed_names - expected_argument_names)

            if differing_argument_names:
                self.add_message(
                    message_id,
                    args=(', '.join(
                        sorted(differing_argument_names)),),
                    node=warning_node)

        _compare_missing_args(params_with_doc, 'missing-param-doc',
                              self.not_needed_param_in_docstring)
        _compare_missing_args(params_with_type, 'missing-type-doc',
                              not_needed_type_in_docstring)

        _compare_different_args(params_with_doc, 'differing-param-doc',
                                self.not_needed_param_in_docstring)
        _compare_different_args(params_with_type, 'differing-type-doc',
                                not_needed_type_in_docstring)

    def check_single_constructor_params(self, class_doc, init_doc, class_node):
        if class_doc.has_params() and init_doc.has_params():
            self.add_message(
                'multiple-constructor-doc',
                args=(class_node.name,),
                node=class_node)

    def _handle_no_raise_doc(self, excs, node):
        if self.config.accept_no_raise_doc:
            return

        self._add_raise_message(excs, node)

    def _add_raise_message(self, missing_excs, node):
        """
        Adds a message on :param:`node` for the missing exception type.

        :param missing_excs: A list of missing exception types.
        :type missing_excs: list

        :param node: The node show the message on.
        :type node: astroid.node_classes.NodeNG
        """
        if not missing_excs:
            return

        self.add_message(
            'missing-raises-doc',
            args=(', '.join(sorted(missing_excs)),),
            node=node)

def register(linter):
    """Required method to auto register this checker.

    :param linter: Main interface object for Pylint plugins
    :type linter: Pylint object
    """
    linter.register_checker(DocstringParameterChecker(linter))
