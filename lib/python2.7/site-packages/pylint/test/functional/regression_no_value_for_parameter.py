# pylint: disable=missing-docstring,import-error
from Unknown import Unknown

class ConfigManager(Unknown):


    RENAMED_SECTIONS = {
        'permissions': 'content'
    }

    def test(self):
        self.RENAMED_SECTIONS.items() #@

    def items(self, sectname, raw=True):
        pass
