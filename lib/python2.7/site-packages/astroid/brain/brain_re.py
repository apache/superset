# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER
import sys
import astroid

PY36 = sys.version_info >= (3, 6)

if PY36:
    # Since Python 3.6 there is the RegexFlag enum
    # where every entry will be exposed via updating globals()

    def _re_transform():
        return astroid.parse('''
        import sre_compile
        ASCII = sre_compile.SRE_FLAG_ASCII
        IGNORECASE = sre_compile.SRE_FLAG_IGNORECASE
        LOCALE = sre_compile.SRE_FLAG_LOCALE
        UNICODE = sre_compile.SRE_FLAG_UNICODE
        MULTILINE = sre_compile.SRE_FLAG_MULTILINE
        DOTALL = sre_compile.SRE_FLAG_DOTALL
        VERBOSE = sre_compile.SRE_FLAG_VERBOSE
        A = ASCII
        I = IGNORECASE
        L = LOCALE
        U = UNICODE
        M = MULTILINE
        S = DOTALL
        X = VERBOSE
        TEMPLATE = sre_compile.SRE_FLAG_TEMPLATE
        T = TEMPLATE
        DEBUG = sre_compile.SRE_FLAG_DEBUG
        ''')

    astroid.register_module_extender(astroid.MANAGER, 're', _re_transform)
