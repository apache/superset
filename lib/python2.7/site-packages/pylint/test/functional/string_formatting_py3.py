# pylint: disable=missing-docstring,import-error


def issue_957_good():
    meat = ['spam', 'ham']
    print('%s%s%s' % ('eggs', *meat))


def issue_957_bad1():
    meat = ['spam', 'ham', 'monty python']
    print('%s%s%s' % ('eggs', *meat))  # [too-many-format-args]


def issue_957_bad2():
    meat = ['spam']
    print('%s%s%s' % ('eggs', *meat))  # [too-few-format-args]


def issue_957_uninferable():
    from butchery import meat
    print('%s%s%s' % ('eggs', *meat))
