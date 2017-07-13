import warnings

warnings.warn(
    'wtforms.ext.sqlalchemy is deprecated, and will be removed in WTForms 3.0. '
    'The package has been extracted to a separate package wtforms_sqlalchemy: '
    'https://github.com/wtforms/wtforms-sqlalchemy .\n'
    'Or alternately, check out the WTForms-Alchemy package which provides declarative mapping and more: '
    'https://github.com/kvesteri/wtforms-alchemy',
    DeprecationWarning
)
