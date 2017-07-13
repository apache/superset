from pylint.checkers import BaseChecker


class DummyPlugin1(BaseChecker):
    name = 'dummy_plugin'
    msgs = {'I9061': ('Dummy short desc 01', 'dummy-message-01', 'Dummy long desc')}
    options = (
        ('dummy_option_1', {
            'type': 'string',
            'metavar': '<string>',
            'help': 'Dummy option 1',
        }),
    )


class DummyPlugin2(BaseChecker):
    name = 'dummy_plugin'
    msgs = {'I9060': ('Dummy short desc 02', 'dummy-message-02', 'Dummy long desc')}
    options = (
        ('dummy_option_2', {
            'type': 'string',
            'metavar': '<string>',
            'help': 'Dummy option 2',
        }),
    )


def register(linter):
    linter.register_checker(DummyPlugin1(linter))
    linter.register_checker(DummyPlugin2(linter))
