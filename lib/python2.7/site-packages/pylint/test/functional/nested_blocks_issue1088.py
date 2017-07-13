# pylint: disable=missing-docstring,too-few-public-methods
def had_bug(num):
    if num > 1:  # [too-many-nested-blocks]
        if num > 2:
            if num > 3:
                if num > 4:
                    if num > 5:
                        if num > 6:
                            return True


def was_correct(num):
    if num > 1:  # [too-many-nested-blocks]
        if num > 2:
            if num > 3:
                if num > 4:
                    if num > 5:
                        if num > 6:
                            return True
    if num == 0:
        return False
