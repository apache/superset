"""This module implements a post import hook mechanism styled after what is
described in PEP-369. Note that it doesn't cope with modules being reloaded.

"""

import sys
import threading

PY2 = sys.version_info[0] == 2
PY3 = sys.version_info[0] == 3

if PY3:
    import importlib
    string_types = str,
else:
    string_types = basestring,

from .decorators import synchronized

# The dictionary registering any post import hooks to be triggered once
# the target module has been imported. Once a module has been imported
# and the hooks fired, the list of hooks recorded against the target
# module will be truncacted but the list left in the dictionary. This
# acts as a flag to indicate that the module had already been imported.

_post_import_hooks = {}
_post_import_hooks_init = False
_post_import_hooks_lock = threading.RLock()

# Register a new post import hook for the target module name. This
# differs from the PEP-369 implementation in that it also allows the
# hook function to be specified as a string consisting of the name of
# the callback in the form 'module:function'. This will result in a
# proxy callback being registered which will defer loading of the
# specified module containing the callback function until required.

def _create_import_hook_from_string(name):
    def import_hook(module):
        module_name, function = name.split(':')
        attrs = function.split('.')
        __import__(module_name)
        callback = sys.modules[module_name]
        for attr in attrs:
            callback = getattr(callback, attr)
        return callback(module)
    return import_hook

@synchronized(_post_import_hooks_lock)
def register_post_import_hook(hook, name):
    # Create a deferred import hook if hook is a string name rather than
    # a callable function.

    if isinstance(hook, string_types):
        hook = _create_import_hook_from_string(hook)

    # Automatically install the import hook finder if it has not already
    # been installed.

    global _post_import_hooks_init

    if not _post_import_hooks_init:
        _post_import_hooks_init = True
        sys.meta_path.insert(0, ImportHookFinder())

    # Determine if any prior registration of a post import hook for
    # the target modules has occurred and act appropriately.

    hooks = _post_import_hooks.get(name, None)

    if hooks is None:
        # No prior registration of post import hooks for the target
        # module. We need to check whether the module has already been
        # imported. If it has we fire the hook immediately and add an
        # empty list to the registry to indicate that the module has
        # already been imported and hooks have fired. Otherwise add
        # the post import hook to the registry.

        module = sys.modules.get(name, None)

        if module is not None:
            _post_import_hooks[name] = []
            hook(module)

        else:
            _post_import_hooks[name] = [hook]

    elif hooks == []:
        # A prior registration of port import hooks for the target
        # module was done and the hooks already fired. Fire the hook
        # immediately.

        module = sys.modules[name]
        hook(module)

    else:
        # A prior registration of port import hooks for the target
        # module was done but the module has not yet been imported.

        _post_import_hooks[name].append(hook)

# Register post import hooks defined as package entry points.

def _create_import_hook_from_entrypoint(entrypoint):
    def import_hook(module):
        __import__(entrypoint.module_name)
        callback = sys.modules[entrypoint.module_name]
        for attr in entrypoint.attrs:
            callback = getattr(callback, attr)
        return callback(module)
    return import_hook

def discover_post_import_hooks(group):
    try:
        import pkg_resources
    except ImportError:
        return

    for entrypoint in pkg_resources.iter_entry_points(group=group):
        callback = _create_import_hook_from_entrypoint(entrypoint)
        register_post_import_hook(callback, entrypoint.name)

# Indicate that a module has been loaded. Any post import hooks which
# were registered against the target module will be invoked. If an
# exception is raised in any of the post import hooks, that will cause
# the import of the target module to fail.

@synchronized(_post_import_hooks_lock)
def notify_module_loaded(module):
    name = getattr(module, '__name__', None)
    hooks = _post_import_hooks.get(name, None)

    if hooks:
        _post_import_hooks[name] = []

        for hook in hooks:
            hook(module)

# A custom module import finder. This intercepts attempts to import
# modules and watches out for attempts to import target modules of
# interest. When a module of interest is imported, then any post import
# hooks which are registered will be invoked.

class _ImportHookLoader:

    def load_module(self, fullname):
        module = sys.modules[fullname]
        notify_module_loaded(module)

        return module

class _ImportHookChainedLoader:

    def __init__(self, loader):
        self.loader = loader

    def load_module(self, fullname):
        module = self.loader.load_module(fullname)
        notify_module_loaded(module)

        return module

class ImportHookFinder:

    def __init__(self):
        self.in_progress = {}

    @synchronized(_post_import_hooks_lock)
    def find_module(self, fullname, path=None):
        # If the module being imported is not one we have registered
        # post import hooks for, we can return immediately. We will
        # take no further part in the importing of this module.

        if not fullname in _post_import_hooks:
            return None

        # When we are interested in a specific module, we will call back
        # into the import system a second time to defer to the import
        # finder that is supposed to handle the importing of the module.
        # We set an in progress flag for the target module so that on
        # the second time through we don't trigger another call back
        # into the import system and cause a infinite loop.

        if fullname in self.in_progress:
            return None

        self.in_progress[fullname] = True

        # Now call back into the import system again.

        try:
            if PY3:
                # For Python 3 we need to use find_loader() from
                # the importlib module. It doesn't actually
                # import the target module and only finds the
                # loader. If a loader is found, we need to return
                # our own loader which will then in turn call the
                # real loader to import the module and invoke the
                # post import hooks.

                loader = importlib.find_loader(fullname, path)

                if loader:
                    return _ImportHookChainedLoader(loader)

            else:
                # For Python 2 we don't have much choice but to
                # call back in to __import__(). This will
                # actually cause the module to be imported. If no
                # module could be found then ImportError will be
                # raised. Otherwise we return a loader which
                # returns the already loaded module and invokes
                # the post import hooks.

                __import__(fullname)

                return _ImportHookLoader()

        finally:
            del self.in_progress[fullname]

# Decorator for marking that a function should be called as a post
# import hook when the target module is imported.

def when_imported(name):
    def register(hook):
        register_post_import_hook(hook, name)
        return hook
    return register
