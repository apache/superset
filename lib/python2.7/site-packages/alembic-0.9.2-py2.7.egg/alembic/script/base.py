import datetime
from dateutil import tz
import os
import re
import shutil
from .. import util
from ..util import compat
from . import revision
from ..runtime import migration

from contextlib import contextmanager

_sourceless_rev_file = re.compile(r'(?!\.\#|__init__)(.*\.py)(c|o)?$')
_only_source_rev_file = re.compile(r'(?!\.\#|__init__)(.*\.py)$')
_legacy_rev = re.compile(r'([a-f0-9]+)\.py$')
_mod_def_re = re.compile(r'(upgrade|downgrade)_([a-z0-9]+)')
_slug_re = re.compile(r'\w+')
_default_file_template = "%(rev)s_%(slug)s"
_split_on_space_comma = re.compile(r',|(?: +)')


class ScriptDirectory(object):

    """Provides operations upon an Alembic script directory.

    This object is useful to get information as to current revisions,
    most notably being able to get at the "head" revision, for schemes
    that want to test if the current revision in the database is the most
    recent::

        from alembic.script import ScriptDirectory
        from alembic.config import Config
        config = Config()
        config.set_main_option("script_location", "myapp:migrations")
        script = ScriptDirectory.from_config(config)

        head_revision = script.get_current_head()



    """

    def __init__(self, dir, file_template=_default_file_template,
                 truncate_slug_length=40,
                 version_locations=None,
                 sourceless=False, output_encoding="utf-8",
                 timezone=None):
        self.dir = dir
        self.file_template = file_template
        self.version_locations = version_locations
        self.truncate_slug_length = truncate_slug_length or 40
        self.sourceless = sourceless
        self.output_encoding = output_encoding
        self.revision_map = revision.RevisionMap(self._load_revisions)
        self.timezone = timezone

        if not os.access(dir, os.F_OK):
            raise util.CommandError("Path doesn't exist: %r.  Please use "
                                    "the 'init' command to create a new "
                                    "scripts folder." % dir)

    @property
    def versions(self):
        loc = self._version_locations
        if len(loc) > 1:
            raise util.CommandError("Multiple version_locations present")
        else:
            return loc[0]

    @util.memoized_property
    def _version_locations(self):
        if self.version_locations:
            return [
                os.path.abspath(util.coerce_resource_to_filename(location))
                for location in self.version_locations
            ]
        else:
            return (os.path.abspath(os.path.join(self.dir, 'versions')),)

    def _load_revisions(self):
        if self.version_locations:
            paths = [
                vers for vers in self._version_locations
                if os.path.exists(vers)]
        else:
            paths = [self.versions]

        dupes = set()
        for vers in paths:
            for file_ in os.listdir(vers):
                path = os.path.realpath(os.path.join(vers, file_))
                if path in dupes:
                    util.warn(
                        "File %s loaded twice! ignoring. Please ensure "
                        "version_locations is unique." % path
                    )
                    continue
                dupes.add(path)
                script = Script._from_filename(self, vers, file_)
                if script is None:
                    continue
                yield script

    @classmethod
    def from_config(cls, config):
        """Produce a new :class:`.ScriptDirectory` given a :class:`.Config`
        instance.

        The :class:`.Config` need only have the ``script_location`` key
        present.

        """
        script_location = config.get_main_option('script_location')
        if script_location is None:
            raise util.CommandError("No 'script_location' key "
                                    "found in configuration.")
        truncate_slug_length = config.get_main_option("truncate_slug_length")
        if truncate_slug_length is not None:
            truncate_slug_length = int(truncate_slug_length)

        version_locations = config.get_main_option("version_locations")
        if version_locations:
            version_locations = _split_on_space_comma.split(version_locations)

        return ScriptDirectory(
            util.coerce_resource_to_filename(script_location),
            file_template=config.get_main_option(
                'file_template',
                _default_file_template),
            truncate_slug_length=truncate_slug_length,
            sourceless=config.get_main_option("sourceless") == "true",
            output_encoding=config.get_main_option("output_encoding", "utf-8"),
            version_locations=version_locations,
            timezone=config.get_main_option("timezone")
        )

    @contextmanager
    def _catch_revision_errors(
            self,
            ancestor=None, multiple_heads=None, start=None, end=None,
            resolution=None):
        try:
            yield
        except revision.RangeNotAncestorError as rna:
            if start is None:
                start = rna.lower
            if end is None:
                end = rna.upper
            if not ancestor:
                ancestor = (
                    "Requested range %(start)s:%(end)s does not refer to "
                    "ancestor/descendant revisions along the same branch"
                )
            ancestor = ancestor % {"start": start, "end": end}
            compat.raise_from_cause(util.CommandError(ancestor))
        except revision.MultipleHeads as mh:
            if not multiple_heads:
                multiple_heads = (
                    "Multiple head revisions are present for given "
                    "argument '%(head_arg)s'; please "
                    "specify a specific target revision, "
                    "'<branchname>@%(head_arg)s' to "
                    "narrow to a specific head, or 'heads' for all heads")
            multiple_heads = multiple_heads % {
                "head_arg": end or mh.argument,
                "heads": util.format_as_comma(mh.heads)
            }
            compat.raise_from_cause(util.CommandError(multiple_heads))
        except revision.ResolutionError as re:
            if resolution is None:
                resolution = "Can't locate revision identified by '%s'" % (
                    re.argument
                )
            compat.raise_from_cause(util.CommandError(resolution))
        except revision.RevisionError as err:
            compat.raise_from_cause(util.CommandError(err.args[0]))

    def walk_revisions(self, base="base", head="heads"):
        """Iterate through all revisions.

        :param base: the base revision, or "base" to start from the
         empty revision.

        :param head: the head revision; defaults to "heads" to indicate
         all head revisions.  May also be "head" to indicate a single
         head revision.

         .. versionchanged:: 0.7.0 the "head" identifier now refers to
            the head of a non-branched repository only; use "heads" to
            refer to the set of all head branches simultaneously.

        """
        with self._catch_revision_errors(start=base, end=head):
            for rev in self.revision_map.iterate_revisions(
                    head, base, inclusive=True, assert_relative_length=False):
                yield rev

    def get_revisions(self, id_):
        """Return the :class:`.Script` instance with the given rev identifier,
        symbolic name, or sequence of identifiers.

        .. versionadded:: 0.7.0

        """
        with self._catch_revision_errors():
            return self.revision_map.get_revisions(id_)

    def get_all_current(self, id_):
        with self._catch_revision_errors():
            top_revs = set(self.revision_map.get_revisions(id_))
            top_revs.update(
                self.revision_map._get_ancestor_nodes(
                    list(top_revs), include_dependencies=True)
            )
            top_revs = self.revision_map._filter_into_branch_heads(top_revs)
            return top_revs

    def get_revision(self, id_):
        """Return the :class:`.Script` instance with the given rev id.

        .. seealso::

            :meth:`.ScriptDirectory.get_revisions`

        """

        with self._catch_revision_errors():
            return self.revision_map.get_revision(id_)

    def as_revision_number(self, id_):
        """Convert a symbolic revision, i.e. 'head' or 'base', into
        an actual revision number."""

        with self._catch_revision_errors():
            rev, branch_name = self.revision_map._resolve_revision_number(id_)

        if not rev:
            # convert () to None
            return None
        else:
            return rev[0]

    def iterate_revisions(self, upper, lower):
        """Iterate through script revisions, starting at the given
        upper revision identifier and ending at the lower.

        The traversal uses strictly the `down_revision`
        marker inside each migration script, so
        it is a requirement that upper >= lower,
        else you'll get nothing back.

        The iterator yields :class:`.Script` objects.

        .. seealso::

            :meth:`.RevisionMap.iterate_revisions`

        """
        return self.revision_map.iterate_revisions(upper, lower)

    def get_current_head(self):
        """Return the current head revision.

        If the script directory has multiple heads
        due to branching, an error is raised;
        :meth:`.ScriptDirectory.get_heads` should be
        preferred.

        :return: a string revision number.

        .. seealso::

            :meth:`.ScriptDirectory.get_heads`

        """
        with self._catch_revision_errors(multiple_heads=(
                'The script directory has multiple heads (due to branching).'
                'Please use get_heads(), or merge the branches using '
                'alembic merge.'
        )):
            return self.revision_map.get_current_head()

    def get_heads(self):
        """Return all "versioned head" revisions as strings.

        This is normally a list of length one,
        unless branches are present.  The
        :meth:`.ScriptDirectory.get_current_head()` method
        can be used normally when a script directory
        has only one head.

        :return: a tuple of string revision numbers.
        """
        return list(self.revision_map.heads)

    def get_base(self):
        """Return the "base" revision as a string.

        This is the revision number of the script that
        has a ``down_revision`` of None.

        If the script directory has multiple bases, an error is raised;
        :meth:`.ScriptDirectory.get_bases` should be
        preferred.

        """
        bases = self.get_bases()
        if len(bases) > 1:
            raise util.CommandError(
                "The script directory has multiple bases. "
                "Please use get_bases().")
        elif bases:
            return bases[0]
        else:
            return None

    def get_bases(self):
        """return all "base" revisions as strings.

        This is the revision number of all scripts that
        have a ``down_revision`` of None.

        .. versionadded:: 0.7.0

        """
        return list(self.revision_map.bases)

    def _upgrade_revs(self, destination, current_rev):
        with self._catch_revision_errors(
                ancestor="Destination %(end)s is not a valid upgrade "
                "target from current head(s)", end=destination):
            revs = self.revision_map.iterate_revisions(
                destination, current_rev, implicit_base=True)
            revs = list(revs)
            return [
                migration.MigrationStep.upgrade_from_script(
                    self.revision_map, script)
                for script in reversed(list(revs))
            ]

    def _downgrade_revs(self, destination, current_rev):
        with self._catch_revision_errors(
                ancestor="Destination %(end)s is not a valid downgrade "
                "target from current head(s)", end=destination):
            revs = self.revision_map.iterate_revisions(
                current_rev, destination, select_for_downgrade=True)
            return [
                migration.MigrationStep.downgrade_from_script(
                    self.revision_map, script)
                for script in revs
            ]

    def _stamp_revs(self, revision, heads):
        with self._catch_revision_errors(
                multiple_heads="Multiple heads are present; please specify a "
                "single target revision"):

            heads = self.get_revisions(heads)

            # filter for lineage will resolve things like
            # branchname@base, version@base, etc.
            filtered_heads = self.revision_map.filter_for_lineage(
                heads, revision, include_dependencies=True)

            steps = []

            dests = self.get_revisions(revision) or [None]
            for dest in dests:
                if dest is None:
                    # dest is 'base'.  Return a "delete branch" migration
                    # for all applicable heads.
                    steps.extend([
                        migration.StampStep(head.revision, None, False, True)
                        for head in filtered_heads
                    ])
                    continue
                elif dest in filtered_heads:
                    # the dest is already in the version table, do nothing.
                    continue

                # figure out if the dest is a descendant or an
                # ancestor of the selected nodes
                descendants = set(
                    self.revision_map._get_descendant_nodes([dest]))
                ancestors = set(self.revision_map._get_ancestor_nodes([dest]))

                if descendants.intersection(filtered_heads):
                    # heads are above the target, so this is a downgrade.
                    # we can treat them as a "merge", single step.
                    assert not ancestors.intersection(filtered_heads)
                    todo_heads = [head.revision for head in filtered_heads]
                    step = migration.StampStep(
                        todo_heads, dest.revision, False, False)
                    steps.append(step)
                    continue
                elif ancestors.intersection(filtered_heads):
                    # heads are below the target, so this is an upgrade.
                    # we can treat them as a "merge", single step.
                    todo_heads = [head.revision for head in filtered_heads]
                    step = migration.StampStep(
                        todo_heads, dest.revision, True, False)
                    steps.append(step)
                    continue
                else:
                    # destination is in a branch not represented,
                    # treat it as new branch
                    step = migration.StampStep((), dest.revision, True, True)
                    steps.append(step)
                    continue
            return steps

    def run_env(self):
        """Run the script environment.

        This basically runs the ``env.py`` script present
        in the migration environment.   It is called exclusively
        by the command functions in :mod:`alembic.command`.


        """
        util.load_python_file(self.dir, 'env.py')

    @property
    def env_py_location(self):
        return os.path.abspath(os.path.join(self.dir, "env.py"))

    def _generate_template(self, src, dest, **kw):
        util.status("Generating %s" % os.path.abspath(dest),
                    util.template_to_file,
                    src,
                    dest,
                    self.output_encoding,
                    **kw
                    )

    def _copy_file(self, src, dest):
        util.status("Generating %s" % os.path.abspath(dest),
                    shutil.copy,
                    src, dest)

    def _ensure_directory(self, path):
        path = os.path.abspath(path)
        if not os.path.exists(path):
            util.status(
                "Creating directory %s" % path,
                os.makedirs, path)

    def _generate_create_date(self):
        if self.timezone is not None:
            tzinfo = tz.gettz(self.timezone.upper())
            if tzinfo is None:
                raise util.CommandError(
                    "Can't locate timezone: %s" % self.timezone)
            create_date = datetime.datetime.utcnow().replace(
                tzinfo=tz.tzutc()).astimezone(tzinfo)
        else:
            create_date = datetime.datetime.now()
        return create_date

    def generate_revision(
            self, revid, message, head=None,
            refresh=False, splice=False, branch_labels=None,
            version_path=None, depends_on=None, **kw):
        """Generate a new revision file.

        This runs the ``script.py.mako`` template, given
        template arguments, and creates a new file.

        :param revid: String revision id.  Typically this
         comes from ``alembic.util.rev_id()``.
        :param message: the revision message, the one passed
         by the -m argument to the ``revision`` command.
        :param head: the head revision to generate against.  Defaults
         to the current "head" if no branches are present, else raises
         an exception.

         .. versionadded:: 0.7.0

        :param splice: if True, allow the "head" version to not be an
         actual head; otherwise, the selected head must be a head
         (e.g. endpoint) revision.
        :param refresh: deprecated.

        """
        if head is None:
            head = "head"

        with self._catch_revision_errors(multiple_heads=(
            "Multiple heads are present; please specify the head "
            "revision on which the new revision should be based, "
            "or perform a merge."
        )):
            heads = self.revision_map.get_revisions(head)

        if len(set(heads)) != len(heads):
            raise util.CommandError("Duplicate head revisions specified")

        create_date = self._generate_create_date()

        if version_path is None:
            if len(self._version_locations) > 1:
                for head in heads:
                    if head is not None:
                        version_path = os.path.dirname(head.path)
                        break
                else:
                    raise util.CommandError(
                        "Multiple version locations present, "
                        "please specify --version-path")
            else:
                version_path = self.versions

        norm_path = os.path.normpath(os.path.abspath(version_path))
        for vers_path in self._version_locations:
            if os.path.normpath(vers_path) == norm_path:
                break
        else:
            raise util.CommandError(
                "Path %s is not represented in current "
                "version locations" % version_path)

        if self.version_locations:
            self._ensure_directory(version_path)

        path = self._rev_path(version_path, revid, message, create_date)

        if not splice:
            for head in heads:
                if head is not None and not head.is_head:
                    raise util.CommandError(
                        "Revision %s is not a head revision; please specify "
                        "--splice to create a new branch from this revision"
                        % head.revision)

        if depends_on:
            with self._catch_revision_errors():
                depends_on = [
                    dep
                    if dep in rev.branch_labels  # maintain branch labels
                    else rev.revision  # resolve partial revision identifiers
                    for rev, dep in [
                        (self.revision_map.get_revision(dep), dep)
                        for dep in util.to_list(depends_on)
                    ]

                ]

        self._generate_template(
            os.path.join(self.dir, "script.py.mako"),
            path,
            up_revision=str(revid),
            down_revision=revision.tuple_rev_as_scalar(
                tuple(h.revision if h is not None else None for h in heads)),
            branch_labels=util.to_tuple(branch_labels),
            depends_on=revision.tuple_rev_as_scalar(depends_on),
            create_date=create_date,
            comma=util.format_as_comma,
            message=message if message is not None else ("empty message"),
            **kw
        )
        script = Script._from_path(self, path)
        if branch_labels and not script.branch_labels:
            raise util.CommandError(
                "Version %s specified branch_labels %s, however the "
                "migration file %s does not have them; have you upgraded "
                "your script.py.mako to include the "
                "'branch_labels' section?" % (
                    script.revision, branch_labels, script.path
                ))

        self.revision_map.add_revision(script)
        return script

    def _rev_path(self, path, rev_id, message, create_date):
        slug = "_".join(_slug_re.findall(message or "")).lower()
        if len(slug) > self.truncate_slug_length:
            slug = slug[:self.truncate_slug_length].rsplit('_', 1)[0] + '_'
        filename = "%s.py" % (
            self.file_template % {
                'rev': rev_id,
                'slug': slug,
                'year': create_date.year,
                'month': create_date.month,
                'day': create_date.day,
                'hour': create_date.hour,
                'minute': create_date.minute,
                'second': create_date.second
            }
        )
        return os.path.join(path, filename)


class Script(revision.Revision):

    """Represent a single revision file in a ``versions/`` directory.

    The :class:`.Script` instance is returned by methods
    such as :meth:`.ScriptDirectory.iterate_revisions`.

    """

    def __init__(self, module, rev_id, path):
        self.module = module
        self.path = path
        super(Script, self).__init__(
            rev_id,
            module.down_revision,
            branch_labels=util.to_tuple(
                getattr(module, 'branch_labels', None), default=()),
            dependencies=util.to_tuple(
                getattr(module, 'depends_on', None), default=())
        )

    module = None
    """The Python module representing the actual script itself."""

    path = None
    """Filesystem path of the script."""

    @property
    def doc(self):
        """Return the docstring given in the script."""

        return re.split("\n\n", self.longdoc)[0]

    @property
    def longdoc(self):
        """Return the docstring given in the script."""

        doc = self.module.__doc__
        if doc:
            if hasattr(self.module, "_alembic_source_encoding"):
                doc = doc.decode(self.module._alembic_source_encoding)
            return doc.strip()
        else:
            return ""

    @property
    def log_entry(self):
        entry = "Rev: %s%s%s%s\n" % (
            self.revision,
            " (head)" if self.is_head else "",
            " (branchpoint)" if self.is_branch_point else "",
            " (mergepoint)" if self.is_merge_point else "",
        )
        if self.is_merge_point:
            entry += "Merges: %s\n" % (self._format_down_revision(), )
        else:
            entry += "Parent: %s\n" % (self._format_down_revision(), )

        if self.dependencies:
            entry += "Also depends on: %s\n" % (
                util.format_as_comma(self.dependencies))

        if self.is_branch_point:
            entry += "Branches into: %s\n" % (
                util.format_as_comma(self.nextrev))

        if self.branch_labels:
            entry += "Branch names: %s\n" % (
                util.format_as_comma(self.branch_labels), )

        entry += "Path: %s\n" % (self.path,)

        entry += "\n%s\n" % (
            "\n".join(
                "    %s" % para
                for para in self.longdoc.splitlines()
            )
        )
        return entry

    def __str__(self):
        return "%s -> %s%s%s%s, %s" % (
            self._format_down_revision(),
            self.revision,
            " (head)" if self.is_head else "",
            " (branchpoint)" if self.is_branch_point else "",
            " (mergepoint)" if self.is_merge_point else "",
            self.doc)

    def _head_only(
            self, include_branches=False, include_doc=False,
            include_parents=False, tree_indicators=True,
            head_indicators=True):
        text = self.revision
        if include_parents:
            if self.dependencies:
                text = "%s (%s) -> %s" % (
                    self._format_down_revision(),
                    util.format_as_comma(self.dependencies),
                    text
                )
            else:
                text = "%s -> %s" % (
                    self._format_down_revision(), text)
        if include_branches and self.branch_labels:
            text += " (%s)" % util.format_as_comma(self.branch_labels)
        if head_indicators or tree_indicators:
            text += "%s%s" % (
                " (head)" if self._is_real_head else "",
                " (effective head)" if self.is_head and
                    not self._is_real_head else ""
            )
        if tree_indicators:
            text += "%s%s" % (
                " (branchpoint)" if self.is_branch_point else "",
                " (mergepoint)" if self.is_merge_point else ""
            )
        if include_doc:
            text += ", %s" % self.doc
        return text

    def cmd_format(
        self,
            verbose,
            include_branches=False, include_doc=False,
            include_parents=False, tree_indicators=True):
        if verbose:
            return self.log_entry
        else:
            return self._head_only(
                include_branches, include_doc,
                include_parents, tree_indicators)

    def _format_down_revision(self):
        if not self.down_revision:
            return "<base>"
        else:
            return util.format_as_comma(self._versioned_down_revisions)

    @classmethod
    def _from_path(cls, scriptdir, path):
        dir_, filename = os.path.split(path)
        return cls._from_filename(scriptdir, dir_, filename)

    @classmethod
    def _from_filename(cls, scriptdir, dir_, filename):
        if scriptdir.sourceless:
            py_match = _sourceless_rev_file.match(filename)
        else:
            py_match = _only_source_rev_file.match(filename)

        if not py_match:
            return None

        py_filename = py_match.group(1)

        if scriptdir.sourceless:
            is_c = py_match.group(2) == 'c'
            is_o = py_match.group(2) == 'o'
        else:
            is_c = is_o = False

        if is_o or is_c:
            py_exists = os.path.exists(os.path.join(dir_, py_filename))
            pyc_exists = os.path.exists(os.path.join(dir_, py_filename + "c"))

            # prefer .py over .pyc because we'd like to get the
            # source encoding; prefer .pyc over .pyo because we'd like to
            # have the docstrings which a -OO file would not have
            if py_exists or is_o and pyc_exists:
                return None

        module = util.load_python_file(dir_, filename)

        if not hasattr(module, "revision"):
            # attempt to get the revision id from the script name,
            # this for legacy only
            m = _legacy_rev.match(filename)
            if not m:
                raise util.CommandError(
                    "Could not determine revision id from filename %s. "
                    "Be sure the 'revision' variable is "
                    "declared inside the script (please see 'Upgrading "
                    "from Alembic 0.1 to 0.2' in the documentation)."
                    % filename)
            else:
                revision = m.group(1)
        else:
            revision = module.revision
        return Script(module, revision, os.path.join(dir_, filename))
