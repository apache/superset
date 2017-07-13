"""
Module is just here for compatibility reasons, and will be removed in a future release.

Importing this will cause a DeprecationWarning.
"""
from wtforms.i18n import (messages_path, get_builtin_gnu_translations, get_translations, DefaultTranslations)
import warnings

__all__ = ('messages_path', 'get_builtin_gnu_translations', 'get_translations', 'DefaultTranslations')


warnings.warn(
    'i18n utils have been merged into core, and this module will go away in WTForms 3.0',
    category=DeprecationWarning, stacklevel=2
)
