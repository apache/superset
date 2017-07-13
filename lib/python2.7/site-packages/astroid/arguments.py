# Copyright (c) 2015-2016 Cara Vinson <ceridwenv@gmail.com>
# Copyright (c) 2015-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


import six

from astroid import bases
from astroid import context as contextmod
from astroid import exceptions
from astroid import nodes
from astroid import util



class CallSite(object):
    """Class for understanding arguments passed into a call site

    It needs a call context, which contains the arguments and the
    keyword arguments that were passed into a given call site.
    In order to infer what an argument represents, call
    :meth:`infer_argument` with the corresponding function node
    and the argument name.
    """

    def __init__(self, callcontext):
        args = callcontext.args
        keywords = callcontext.keywords
        self.duplicated_keywords = set()
        self._unpacked_args = self._unpack_args(args)
        self._unpacked_kwargs = self._unpack_keywords(keywords)

        self.positional_arguments = [
            arg for arg in self._unpacked_args
            if arg is not util.Uninferable
        ]
        self.keyword_arguments = {
            key: value for key, value in self._unpacked_kwargs.items()
            if value is not util.Uninferable
        }

    @classmethod
    def from_call(cls, call_node):
        """Get a CallSite object from the given Call node."""
        callcontext = contextmod.CallContext(call_node.args,
                                             call_node.keywords)
        return cls(callcontext)

    def has_invalid_arguments(self):
        """Check if in the current CallSite were passed *invalid* arguments

        This can mean multiple things. For instance, if an unpacking
        of an invalid object was passed, then this method will return True.
        Other cases can be when the arguments can't be inferred by astroid,
        for example, by passing objects which aren't known statically.
        """
        return len(self.positional_arguments) != len(self._unpacked_args)

    def has_invalid_keywords(self):
        """Check if in the current CallSite were passed *invalid* keyword arguments

        For instance, unpacking a dictionary with integer keys is invalid
        (**{1:2}), because the keys must be strings, which will make this
        method to return True. Other cases where this might return True if
        objects which can't be inferred were passed.
        """
        return len(self.keyword_arguments) != len(self._unpacked_kwargs)

    def _unpack_keywords(self, keywords):
        values = {}
        context = contextmod.InferenceContext()
        for name, value in keywords:
            if name is None:
                # Then it's an unpacking operation (**)
                try:
                    inferred = next(value.infer(context=context))
                except exceptions.InferenceError:
                    values[name] = util.Uninferable
                    continue

                if not isinstance(inferred, nodes.Dict):
                    # Not something we can work with.
                    values[name] = util.Uninferable
                    continue

                for dict_key, dict_value in inferred.items:
                    try:
                        dict_key = next(dict_key.infer(context=context))
                    except exceptions.InferenceError:
                        values[name] = util.Uninferable
                        continue
                    if not isinstance(dict_key, nodes.Const):
                        values[name] = util.Uninferable
                        continue
                    if not isinstance(dict_key.value, six.string_types):
                        values[name] = util.Uninferable
                        continue
                    if dict_key.value in values:
                        # The name is already in the dictionary
                        values[dict_key.value] = util.Uninferable
                        self.duplicated_keywords.add(dict_key.value)
                        continue
                    values[dict_key.value] = dict_value
            else:
                values[name] = value
        return values

    @staticmethod
    def _unpack_args(args):
        values = []
        context = contextmod.InferenceContext()
        for arg in args:
            if isinstance(arg, nodes.Starred):
                try:
                    inferred = next(arg.value.infer(context=context))
                except exceptions.InferenceError:
                    values.append(util.Uninferable)
                    continue

                if inferred is util.Uninferable:
                    values.append(util.Uninferable)
                    continue
                if not hasattr(inferred, 'elts'):
                    values.append(util.Uninferable)
                    continue
                values.extend(inferred.elts)
            else:
                values.append(arg)
        return values

    def infer_argument(self, funcnode, name, context):
        """infer a function argument value according to the call context

        Arguments:
            funcnode: The function being called.
            name: The name of the argument whose value is being inferred.
            context: TODO
        """
        if name in self.duplicated_keywords:
            raise exceptions.InferenceError('The arguments passed to {func!r} '
                                            ' have duplicate keywords.',
                                            call_site=self, func=funcnode,
                                            arg=name, context=context)

        # Look into the keywords first, maybe it's already there.
        try:
            return self.keyword_arguments[name].infer(context)
        except KeyError:
            pass

        # Too many arguments given and no variable arguments.
        if len(self.positional_arguments) > len(funcnode.args.args):
            if not funcnode.args.vararg:
                raise exceptions.InferenceError('Too many positional arguments '
                                                'passed to {func!r} that does '
                                                'not have *args.',
                                                call_site=self, func=funcnode,
                                                arg=name, context=context)

        positional = self.positional_arguments[:len(funcnode.args.args)]
        vararg = self.positional_arguments[len(funcnode.args.args):]
        argindex = funcnode.args.find_argname(name)[0]
        kwonlyargs = set(arg.name for arg in funcnode.args.kwonlyargs)
        kwargs = {
            key: value for key, value in self.keyword_arguments.items()
            if key not in kwonlyargs
        }
        # If there are too few positionals compared to
        # what the function expects to receive, check to see
        # if the missing positional arguments were passed
        # as keyword arguments and if so, place them into the
        # positional args list.
        if len(positional) < len(funcnode.args.args):
            for func_arg in funcnode.args.args:
                if func_arg.name in kwargs:
                    arg = kwargs.pop(func_arg.name)
                    positional.append(arg)

        if argindex is not None:
            # 2. first argument of instance/class method
            if argindex == 0 and funcnode.type in ('method', 'classmethod'):
                if context.boundnode is not None:
                    boundnode = context.boundnode
                else:
                    # XXX can do better ?
                    boundnode = funcnode.parent.frame()

                if isinstance(boundnode, nodes.ClassDef):
                    # Verify that we're accessing a method
                    # of the metaclass through a class, as in
                    # `cls.metaclass_method`. In this case, the
                    # first argument is always the class.
                    method_scope = funcnode.parent.scope()
                    if method_scope is boundnode.metaclass():
                        return iter((boundnode, ))

                if funcnode.type == 'method':
                    if not isinstance(boundnode, bases.Instance):
                        boundnode = bases.Instance(boundnode)
                    return iter((boundnode,))
                if funcnode.type == 'classmethod':
                    return iter((boundnode,))
            # if we have a method, extract one position
            # from the index, so we'll take in account
            # the extra parameter represented by `self` or `cls`
            if funcnode.type in ('method', 'classmethod'):
                argindex -= 1
            # 2. search arg index
            try:
                return self.positional_arguments[argindex].infer(context)
            except IndexError:
                pass

        if funcnode.args.kwarg == name:
            # It wants all the keywords that were passed into
            # the call site.
            if self.has_invalid_keywords():
                raise exceptions.InferenceError(
                    "Inference failed to find values for all keyword arguments "
                    "to {func!r}: {unpacked_kwargs!r} doesn't correspond to "
                    "{keyword_arguments!r}.",
                    keyword_arguments=self.keyword_arguments,
                    unpacked_kwargs=self._unpacked_kwargs,
                    call_site=self, func=funcnode, arg=name, context=context)
            kwarg = nodes.Dict(lineno=funcnode.args.lineno,
                               col_offset=funcnode.args.col_offset,
                               parent=funcnode.args)
            kwarg.postinit([(nodes.const_factory(key), value)
                            for key, value in kwargs.items()])
            return iter((kwarg, ))
        elif funcnode.args.vararg == name:
            # It wants all the args that were passed into
            # the call site.
            if self.has_invalid_arguments():
                raise exceptions.InferenceError(
                    "Inference failed to find values for all positional "
                    "arguments to {func!r}: {unpacked_args!r} doesn't "
                    "correspond to {positional_arguments!r}.",
                    positional_arguments=self.positional_arguments,
                    unpacked_args=self._unpacked_args,
                    call_site=self, func=funcnode, arg=name, context=context)
            args = nodes.Tuple(lineno=funcnode.args.lineno,
                               col_offset=funcnode.args.col_offset,
                               parent=funcnode.args)
            args.postinit(vararg)
            return iter((args, ))

        # Check if it's a default parameter.
        try:
            return funcnode.args.default_value(name).infer(context)
        except exceptions.NoDefault:
            pass
        raise exceptions.InferenceError('No value found for argument {name} to '
                                        '{func!r}', call_site=self,
                                        func=funcnode, arg=name, context=context)
