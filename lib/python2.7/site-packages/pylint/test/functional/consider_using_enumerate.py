"""Emit a message for iteration through range and len is encountered."""

# pylint: disable=missing-docstring, import-error

def bad():
    iterable = [1, 2, 3]
    for obj in range(len(iterable)): # [consider-using-enumerate]
        yield iterable[obj]


def good():
    iterable = other_obj = [1, 2, 3]
    total = 0
    for obj in range(len(iterable)):
        total += obj
        yield total
        yield iterable[obj + 1: 2]
        yield iterable[len(obj)]
    for obj in iterable:
        yield iterable[obj - 1]

    for index, obj in enumerate(iterable):
        yield iterable[index]
    for index in range(0, 10):
        yield iterable[index + 1]
    for index in range(10):
        yield iterable[index]
    for index in range(len([1, 2, 3, 4])):
        yield index
    for index in range(len(iterable)):
        yield [1, 2, 3][index]
        yield len([1, 2, 3])
    for index in range(len(iterable)):
        yield other_obj[index]

    from unknown import unknown
    for index in range(unknown(iterable)):
        yield iterable[index]

    for index in range(len(iterable)):
        def test(iterable):
            return iterable[index]
        yield test([1, 2, 3])
