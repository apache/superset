"""Module containing the main git hook interface and helpers.

.. autofunction:: hook
.. autofunction:: install

"""
import contextlib
import os
import os.path
import shutil
import stat
import subprocess
import sys
import tempfile

from flake8 import defaults
from flake8 import exceptions

__all__ = ('hook', 'install')


def hook(lazy=False, strict=False):
    """Execute Flake8 on the files in git's index.

    Determine which files are about to be committed and run Flake8 over them
    to check for violations.

    :param bool lazy:
        Find files not added to the index prior to committing. This is useful
        if you frequently use ``git commit -a`` for example. This defaults to
        False since it will otherwise include files not in the index.
    :param bool strict:
        If True, return the total number of errors/violations found by Flake8.
        This will cause the hook to fail.
    :returns:
        Total number of errors found during the run.
    :rtype:
        int
    """
    # NOTE(sigmavirus24): Delay import of application until we need it.
    from flake8.main import application
    app = application.Application()
    with make_temporary_directory() as tempdir:
        filepaths = list(copy_indexed_files_to(tempdir, lazy))
        app.initialize(['.'])
        app.options.exclude = update_excludes(app.options.exclude, tempdir)
        app.options._running_from_vcs = True
        # Apparently there are times when there are no files to check (e.g.,
        # when amending a commit). In those cases, let's not try to run checks
        # against nothing.
        if filepaths:
            app.run_checks(filepaths)

    # If there were files to check, update their paths and report the errors
    if filepaths:
        update_paths(app.file_checker_manager, tempdir)
        app.report_errors()

    if strict:
        return app.result_count
    return 0


def install():
    """Install the git hook script.

    This searches for the ``.git`` directory and will install an executable
    pre-commit python script in the hooks sub-directory if one does not
    already exist.

    :returns:
        True if successful, False if the git directory doesn't exist.
    :rtype:
        bool
    :raises:
        flake8.exceptions.GitHookAlreadyExists
    """
    git_directory = find_git_directory()
    if git_directory is None or not os.path.exists(git_directory):
        return False

    hooks_directory = os.path.join(git_directory, 'hooks')
    if not os.path.exists(hooks_directory):
        os.mkdir(hooks_directory)

    pre_commit_file = os.path.abspath(
        os.path.join(hooks_directory, 'pre-commit')
    )
    if os.path.exists(pre_commit_file):
        raise exceptions.GitHookAlreadyExists(
            'File already exists',
            path=pre_commit_file,
        )

    executable = get_executable()

    with open(pre_commit_file, 'w') as fd:
        fd.write(_HOOK_TEMPLATE.format(executable=executable))

    # NOTE(sigmavirus24): The following sets:
    # - read, write, and execute permissions for the owner
    # - read permissions for people in the group
    # - read permissions for other people
    # The owner needs the file to be readable, writable, and executable
    # so that git can actually execute it as a hook.
    pre_commit_permissions = stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH
    os.chmod(pre_commit_file, pre_commit_permissions)
    return True


def get_executable():
    if sys.executable is not None:
        return sys.executable
    return '/usr/bin/env python'


def find_git_directory():
    rev_parse = piped_process(['git', 'rev-parse', '--git-dir'])

    (stdout, _) = rev_parse.communicate()
    stdout = to_text(stdout)

    if rev_parse.returncode == 0:
        return stdout.strip()
    return None


def copy_indexed_files_to(temporary_directory, lazy):
    modified_files = find_modified_files(lazy)
    for filename in modified_files:
        contents = get_staged_contents_from(filename)
        yield copy_file_to(temporary_directory, filename, contents)


def copy_file_to(destination_directory, filepath, contents):
    directory, filename = os.path.split(os.path.abspath(filepath))
    temporary_directory = make_temporary_directory_from(destination_directory,
                                                        directory)
    if not os.path.exists(temporary_directory):
        os.makedirs(temporary_directory)
    temporary_filepath = os.path.join(temporary_directory, filename)
    with open(temporary_filepath, 'wb') as fd:
        fd.write(contents)
    return temporary_filepath


def make_temporary_directory_from(destination, directory):
    prefix = os.path.commonprefix([directory, destination])
    common_directory_path = os.path.relpath(directory, start=prefix)
    return os.path.join(destination, common_directory_path)


def find_modified_files(lazy):
    diff_index_cmd = [
        'git', 'diff-index', '--cached', '--name-only',
        '--diff-filter=ACMRTUXB', 'HEAD'
    ]
    if lazy:
        diff_index_cmd.remove('--cached')

    diff_index = piped_process(diff_index_cmd)
    (stdout, _) = diff_index.communicate()
    stdout = to_text(stdout)
    return stdout.splitlines()


def get_staged_contents_from(filename):
    git_show = piped_process(['git', 'show', ':{0}'.format(filename)])
    (stdout, _) = git_show.communicate()
    return stdout


@contextlib.contextmanager
def make_temporary_directory():
    temporary_directory = tempfile.mkdtemp()
    yield temporary_directory
    shutil.rmtree(temporary_directory, ignore_errors=True)


def to_text(string):
    """Ensure that the string is text."""
    if callable(getattr(string, 'decode', None)):
        return string.decode('utf-8')
    return string


def piped_process(command):
    return subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def git_config_for(parameter):
    config = piped_process(['git', 'config', '--get', '--bool', parameter])
    (stdout, _) = config.communicate()
    return to_text(stdout).strip()


def config_for(parameter):
    environment_variable = 'flake8_{0}'.format(parameter).upper()
    git_variable = 'flake8.{0}'.format(parameter)
    value = os.environ.get(environment_variable, git_config_for(git_variable))
    return value.lower() in defaults.TRUTHY_VALUES


def update_excludes(exclude_list, temporary_directory_path):
    return [
        (temporary_directory_path + pattern)
        if os.path.isabs(pattern) else pattern
        for pattern in exclude_list
    ]


def update_paths(checker_manager, temp_prefix):
    temp_prefix_length = len(temp_prefix)
    for checker in checker_manager.checkers:
        filename = checker.display_name
        if filename.startswith(temp_prefix):
            checker.display_name = os.path.relpath(
                filename[temp_prefix_length:]
            )


_HOOK_TEMPLATE = """#!{executable}
import os
import sys

from flake8.main import git

if __name__ == '__main__':
    sys.exit(
        git.hook(
            strict=git.config_for('strict'),
            lazy=git.config_for('lazy'),
        )
    )
"""
