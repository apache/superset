import warnings
from wtforms import form
from wtforms.ext.i18n.utils import get_translations

translations_cache = {}


class Form(form.Form):
    """
    Base form for a simple localized WTForms form.

    **NOTE** this class is now un-necessary as the i18n features have
    been moved into the core of WTForms, and will be removed in WTForms 3.0.

    This will use the stdlib gettext library to retrieve an appropriate
    translations object for the language, by default using the locale
    information from the environment.

    If the LANGUAGES class variable is overridden and set to a sequence of
    strings, this will be a list of languages by priority to use instead, e.g::

        LANGUAGES = ['en_GB', 'en']

    One can also provide the languages by passing `LANGUAGES=` to the
    constructor of the form.

    Translations objects are cached to prevent having to get a new one for the
    same languages every instantiation.
    """
    LANGUAGES = None

    def __init__(self, *args, **kwargs):
        warnings.warn(
            'i18n is now in core, wtforms.ext.i18n will be removed in WTForms 3.0',
            DeprecationWarning, stacklevel=2
        )
        if 'LANGUAGES' in kwargs:
            self.LANGUAGES = kwargs.pop('LANGUAGES')
        super(Form, self).__init__(*args, **kwargs)

    def _get_translations(self):
        languages = tuple(self.LANGUAGES) if self.LANGUAGES else (self.meta.locales or None)
        if languages not in translations_cache:
            translations_cache[languages] = get_translations(languages)
        return translations_cache[languages]
