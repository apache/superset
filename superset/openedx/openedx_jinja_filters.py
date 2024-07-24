"""
Custom Jinja template filters that can be used in Superset queries.

cf https://superset.apache.org/docs/installation/sql-templating/
"""

from superset.extensions import security_manager
from pythonpath.localization import get_translation, DATASET_STRINGS
from superset import security_manager
import logging
from flask import g

log = logging.getLogger(__name__)
ALL_COURSES = "1 = 1"
NO_COURSES = "1 = 0"


def can_view_courses(username, field_name="course_id", **kwargs):
    """
    Returns SQL WHERE clause which restricts access to the courses the current user has
    staff access to.

    We accept kwargs for optional caching args, since this is memoized in
    can_view_courses_wrapper.
    """
    user = security_manager.get_user_by_username(username)
    if user:
        user_roles = security_manager.get_user_roles(user)
    else:
        user_roles = []

    # Users with no roles don't get to see any courses
    if not user_roles:
        return NO_COURSES

    # Superusers and global staff have access to all courses
    for role in user_roles:
        if str(role) == "Admin" or str(role) == "Alpha":
            return ALL_COURSES

    # Everyone else only has access if they're staff on a course.
    courses = security_manager.get_courses(username)

    # TODO: what happens when the list of courses grows beyond what the query will handle?
    if courses:
        course_id_list = ", ".join(f"'{course_id}'" for course_id in courses)
        return f"{field_name} in ({course_id_list})"
    else:
        # If you're not course staff on any courses, you don't get to see any.
        return NO_COURSES


def translate_column(column_name):
    """
    Translate a string to the given language.
    """
    lang = security_manager.get_preferences(g.user.username)

    strings = DATASET_STRINGS.get(column_name, [])
    if not strings:
        return column_name

    # Since we're doing bad string SQL, we can at least avoid obvious error /
    # SQL injection problems this way.
    if "'" in (" ".join(strings)):
        log.warning("Column translations cannot contain single quotes.")
        return column_name

    case_format = """CASE \n {cases} \n ELSE {column_name} \n END"""
    single_case_format = "WHEN {column_name} = '{string}' THEN '{translation}'"
    cases = "\n".join(
        single_case_format.format(
            column_name=column_name,
            string=string,
            translation=get_translation(string, lang),
        )
        for string in strings
    )

    return case_format.format(column_name=column_name, cases=cases)


def translate_column_bool(column_name):
    """
    Translate a string to the given language based on the column name.

    To use this, the dataset string must have 2 options, the first for when
    a column evaluates to true, the second for when a column evaluates to false.
    """
    lang = security_manager.get_preferences(g.user.username)
    strings = DATASET_STRINGS.get(column_name, [])

    if not strings or not len(strings) == 2:
        log.warning("Wrong number of string options for bool column translation.")
        return column_name

    # Since we're doing bad string SQL, we can at least avoid obvious error /
    # SQL injection problems this way.
    if "'" in (strings[0], strings[1]):
        log.warning("Column translations cannot contain single quotes.")
        return column_name

    true_str = get_translation(strings[0], lang)
    false_str = get_translation(strings[1], lang)

    return f"""
        CASE WHEN {column_name} = true 
        THEN '{true_str}' 
        ELSE '{false_str}'
        END
    """


{{patch("superset-jinja-filters")}}
