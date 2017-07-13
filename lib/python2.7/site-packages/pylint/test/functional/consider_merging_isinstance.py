"""Checks use of consider-merging-isinstance"""
# pylint:disable=line-too-long


def isinstances():
    "Examples of isinstances"
    var = range(10)

    # merged
    if isinstance(var[1], (int, float)):
        pass
    result = isinstance(var[2], (int, float))

    # not merged
    if isinstance(var[3], int) or isinstance(var[3], float) or isinstance(var[3], list) and True:  # [consider-merging-isinstance]
        pass
    result = isinstance(var[4], int) or isinstance(var[4], float) or isinstance(var[5], list) and False  # [consider-merging-isinstance]

    result = isinstance(var[5], int) or True or isinstance(var[5], float)  # [consider-merging-isinstance]

    infered_isinstance = isinstance
    result = infered_isinstance(var[6], int) or infered_isinstance(var[6], float) or infered_isinstance(var[6], list) and False   # [consider-merging-isinstance]
    result = isinstance(var[10], str) or isinstance(var[10], int) and var[8] * 14 or isinstance(var[10], float) and var[5] * 14.4 or isinstance(var[10], list)   # [consider-merging-isinstance]
    result = isinstance(var[11], int) or isinstance(var[11], int) or isinstance(var[11], float)   # [consider-merging-isinstance]

    result = isinstance(var[20])
    result = isinstance()

    # Combination merged and not merged
    result = isinstance(var[12], (int, float)) or isinstance(var[12], list)  # [consider-merging-isinstance]

    # not merged but valid
    result = isinstance(var[5], int) and var[5] * 14 or isinstance(var[5], float) and var[5] * 14.4
    result = isinstance(var[7], int) or not isinstance(var[7], float)
    result = isinstance(var[6], int) or isinstance(var[7], float)
    result = isinstance(var[6], int) or isinstance(var[7], int)
    return result
