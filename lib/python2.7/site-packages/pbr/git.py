# Copyright 2011 OpenStack Foundation
# Copyright 2012-2013 Hewlett-Packard Development Company, L.P.
# All Rights Reserved.
#
#    Licensed under the Apache License, Version 2.0 (the "License"); you may
#    not use this file except in compliance with the License. You may obtain
#    a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
#    WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
#    License for the specific language governing permissions and limitations
#    under the License.

from __future__ import unicode_literals

import distutils.errors
from distutils import log
import errno
import io
import os
import re
import subprocess
import time

import pkg_resources

from pbr import options
from pbr import version


def _run_shell_command(cmd, throw_on_error=False, buffer=True, env=None):
    if buffer:
        out_location = subprocess.PIPE
        err_location = subprocess.PIPE
    else:
        out_location = None
        err_location = None

    newenv = os.environ.copy()
    if env:
        newenv.update(env)

    output = subprocess.Popen(cmd,
                              stdout=out_location,
                              stderr=err_location,
                              env=newenv)
    out = output.communicate()
    if output.returncode and throw_on_error:
        raise distutils.errors.DistutilsError(
            "%s returned %d" % (cmd, output.returncode))
    if len(out) == 0 or not out[0] or not out[0].strip():
        return ''
    # Since we don't control the history, and forcing users to rebase arbitrary
    # history to fix utf8 issues is harsh, decode with replace.
    return out[0].strip().decode('utf-8', 'replace')


def _run_git_command(cmd, git_dir, **kwargs):
    if not isinstance(cmd, (list, tuple)):
        cmd = [cmd]
    return _run_shell_command(
        ['git', '--git-dir=%s' % git_dir] + cmd, **kwargs)


def _get_git_directory():
    try:
        return _run_shell_command(['git', 'rev-parse', '--git-dir'])
    except OSError as e:
        if e.errno == errno.ENOENT:
            # git not installed.
            return ''
        raise


def _git_is_installed():
    try:
        # We cannot use 'which git' as it may not be available
        # in some distributions, So just try 'git --version'
        # to see if we run into trouble
        _run_shell_command(['git', '--version'])
    except OSError:
        return False
    return True


def _get_highest_tag(tags):
    """Find the highest tag from a list.

    Pass in a list of tag strings and this will return the highest
    (latest) as sorted by the pkg_resources version parser.
    """
    return max(tags, key=pkg_resources.parse_version)


def _find_git_files(dirname='', git_dir=None):
    """Behave like a file finder entrypoint plugin.

    We don't actually use the entrypoints system for this because it runs
    at absurd times. We only want to do this when we are building an sdist.
    """
    file_list = []
    if git_dir is None:
        git_dir = _run_git_functions()
    if git_dir:
        log.info("[pbr] In git context, generating filelist from git")
        file_list = _run_git_command(['ls-files', '-z'], git_dir)
        # Users can fix utf8 issues locally with a single commit, so we are
        # strict here.
        file_list = file_list.split(b'\x00'.decode('utf-8'))
    return [f for f in file_list if f]


def _get_raw_tag_info(git_dir):
    describe = _run_git_command(['describe', '--always'], git_dir)
    if "-" in describe:
        return describe.rsplit("-", 2)[-2]
    if "." in describe:
        return 0
    return None


def get_is_release(git_dir):
    return _get_raw_tag_info(git_dir) == 0


def _run_git_functions():
    git_dir = None
    if _git_is_installed():
        git_dir = _get_git_directory()
    return git_dir or None


def get_git_short_sha(git_dir=None):
    """Return the short sha for this repo, if it exists."""
    if not git_dir:
        git_dir = _run_git_functions()
    if git_dir:
        return _run_git_command(
            ['log', '-n1', '--pretty=format:%h'], git_dir)
    return None


def _clean_changelog_message(msg):
    """Cleans any instances of invalid sphinx wording.

    This escapes/removes any instances of invalid characters
    that can be interpreted by sphinx as a warning or error
    when translating the Changelog into an HTML file for
    documentation building within projects.

    * Escapes '_' which is interpreted as a link
    * Escapes '*' which is interpreted as a new line
    * Escapes '`' which is interpreted as a literal
    """

    msg = msg.replace('*', '\*')
    msg = msg.replace('_', '\_')
    msg = msg.replace('`', '\`')

    return msg


def _iter_changelog(changelog):
    """Convert a oneline log iterator to formatted strings.

    :param changelog: An iterator of one line log entries like
        that given by _iter_log_oneline.
    :return: An iterator over (release, formatted changelog) tuples.
    """
    first_line = True
    current_release = None
    yield current_release, "CHANGES\n=======\n\n"
    for hash, tags, msg in changelog:
        if tags:
            current_release = _get_highest_tag(tags)
            underline = len(current_release) * '-'
            if not first_line:
                yield current_release, '\n'
            yield current_release, (
                "%(tag)s\n%(underline)s\n\n" %
                dict(tag=current_release, underline=underline))

        if not msg.startswith("Merge "):
            if msg.endswith("."):
                msg = msg[:-1]
            msg = _clean_changelog_message(msg)
            yield current_release, "* %(msg)s\n" % dict(msg=msg)
        first_line = False


def _iter_log_oneline(git_dir=None):
    """Iterate over --oneline log entries if possible.

    This parses the output into a structured form but does not apply
    presentation logic to the output - making it suitable for different
    uses.

    :return: An iterator of (hash, tags_set, 1st_line) tuples, or None if
        changelog generation is disabled / not available.
    """
    if git_dir is None:
        git_dir = _get_git_directory()
    if not git_dir:
        return []
    return _iter_log_inner(git_dir)


def _is_valid_version(candidate):
    try:
        version.SemanticVersion.from_pip_string(candidate)
        return True
    except ValueError:
        return False


def _iter_log_inner(git_dir):
    """Iterate over --oneline log entries.

    This parses the output intro a structured form but does not apply
    presentation logic to the output - making it suitable for different
    uses.

    :return: An iterator of (hash, tags_set, 1st_line) tuples.
    """
    log.info('[pbr] Generating ChangeLog')
    log_cmd = ['log', '--decorate=full', '--format=%h%x00%s%x00%d']
    changelog = _run_git_command(log_cmd, git_dir)
    for line in changelog.split('\n'):
        line_parts = line.split('\x00')
        if len(line_parts) != 3:
            continue
        sha, msg, refname = line_parts
        tags = set()

        # refname can be:
        #  <empty>
        #  HEAD, tag: refs/tags/1.4.0, refs/remotes/origin/master, \
        #    refs/heads/master
        #  refs/tags/1.3.4
        if "refs/tags/" in refname:
            refname = refname.strip()[1:-1]  # remove wrapping ()'s
            # If we start with "tag: refs/tags/1.2b1, tag: refs/tags/1.2"
            # The first split gives us "['', '1.2b1, tag:', '1.2']"
            # Which is why we do the second split below on the comma
            for tag_string in refname.split("refs/tags/")[1:]:
                # git tag does not allow : or " " in tag names, so we split
                # on ", " which is the separator between elements
                candidate = tag_string.split(", ")[0]
                if _is_valid_version(candidate):
                    tags.add(candidate)

        yield sha, tags, msg


def write_git_changelog(git_dir=None, dest_dir=os.path.curdir,
                        option_dict=None, changelog=None):
    """Write a changelog based on the git changelog."""
    start = time.time()
    if not option_dict:
        option_dict = {}
    should_skip = options.get_boolean_option(option_dict, 'skip_changelog',
                                             'SKIP_WRITE_GIT_CHANGELOG')
    if should_skip:
        return
    if not changelog:
        changelog = _iter_log_oneline(git_dir=git_dir)
        if changelog:
            changelog = _iter_changelog(changelog)
    if not changelog:
        return
    new_changelog = os.path.join(dest_dir, 'ChangeLog')
    # If there's already a ChangeLog and it's not writable, just use it
    if (os.path.exists(new_changelog)
            and not os.access(new_changelog, os.W_OK)):
        log.info('[pbr] ChangeLog not written (file already'
                 ' exists and it is not writeable)')
        return
    log.info('[pbr] Writing ChangeLog')
    with io.open(new_changelog, "w", encoding="utf-8") as changelog_file:
        for release, content in changelog:
            changelog_file.write(content)
    stop = time.time()
    log.info('[pbr] ChangeLog complete (%0.1fs)' % (stop - start))


def generate_authors(git_dir=None, dest_dir='.', option_dict=dict()):
    """Create AUTHORS file using git commits."""
    should_skip = options.get_boolean_option(option_dict, 'skip_authors',
                                             'SKIP_GENERATE_AUTHORS')
    if should_skip:
        return
    start = time.time()
    old_authors = os.path.join(dest_dir, 'AUTHORS.in')
    new_authors = os.path.join(dest_dir, 'AUTHORS')
    # If there's already an AUTHORS file and it's not writable, just use it
    if (os.path.exists(new_authors)
            and not os.access(new_authors, os.W_OK)):
        return
    log.info('[pbr] Generating AUTHORS')
    ignore_emails = '(jenkins@review|infra@lists|jenkins@openstack)'
    if git_dir is None:
        git_dir = _get_git_directory()
    if git_dir:
        authors = []

        # don't include jenkins email address in AUTHORS file
        git_log_cmd = ['log', '--format=%aN <%aE>']
        authors += _run_git_command(git_log_cmd, git_dir).split('\n')
        authors = [a for a in authors if not re.search(ignore_emails, a)]

        # get all co-authors from commit messages
        co_authors_out = _run_git_command('log', git_dir)
        co_authors = re.findall('Co-authored-by:.+', co_authors_out,
                                re.MULTILINE)
        co_authors = [signed.split(":", 1)[1].strip()
                      for signed in co_authors if signed]

        authors += co_authors
        authors = sorted(set(authors))

        with open(new_authors, 'wb') as new_authors_fh:
            if os.path.exists(old_authors):
                with open(old_authors, "rb") as old_authors_fh:
                    new_authors_fh.write(old_authors_fh.read())
            new_authors_fh.write(('\n'.join(authors) + '\n')
                                 .encode('utf-8'))
    stop = time.time()
    log.info('[pbr] AUTHORS complete (%0.1fs)' % (stop - start))
