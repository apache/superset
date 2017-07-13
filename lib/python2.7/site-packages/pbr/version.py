
#    Copyright 2012 OpenStack Foundation
#    Copyright 2012-2013 Hewlett-Packard Development Company, L.P.
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

"""
Utilities for consuming the version from pkg_resources.
"""

import itertools
import operator
import sys


def _is_int(string):
    try:
        int(string)
        return True
    except ValueError:
        return False


class SemanticVersion(object):
    """A pure semantic version independent of serialisation.

    See the pbr doc 'semver' for details on the semantics.
    """

    def __init__(
            self, major, minor=0, patch=0, prerelease_type=None,
            prerelease=None, dev_count=None):
        """Create a SemanticVersion.

        :param major: Major component of the version.
        :param minor: Minor component of the version. Defaults to 0.
        :param patch: Patch level component. Defaults to 0.
        :param prerelease_type: What sort of prerelease version this is -
            one of a(alpha), b(beta) or rc(release candidate).
        :param prerelease: For prerelease versions, what number prerelease.
            Defaults to 0.
        :param dev_count: How many commits since the last release.
        """
        self._major = major
        self._minor = minor
        self._patch = patch
        self._prerelease_type = prerelease_type
        self._prerelease = prerelease
        if self._prerelease_type and not self._prerelease:
            self._prerelease = 0
        self._dev_count = dev_count or 0  # Normalise 0 to None.

    def __eq__(self, other):
        if not isinstance(other, SemanticVersion):
            return False
        return self.__dict__ == other.__dict__

    def __hash__(self):
        return sum(map(hash, self.__dict__.values()))

    def _sort_key(self):
        """Return a key for sorting SemanticVersion's on."""
        # key things:
        # - final is after rc's, so we make that a/b/rc/z
        # - dev==None is after all other devs, so we use sys.maxsize there.
        # - unqualified dev releases come before any pre-releases.
        # So we do:
        # (major, minor, patch) - gets the major grouping.
        # (0|1) unqualified dev flag
        # (a/b/rc/z) - release segment grouping
        # pre-release level
        # dev count, maxsize for releases.
        rc_lookup = {'a': 'a', 'b': 'b', 'rc': 'rc', None: 'z'}
        if self._dev_count and not self._prerelease_type:
            uq_dev = 0
        else:
            uq_dev = 1
        return (
            self._major, self._minor, self._patch,
            uq_dev,
            rc_lookup[self._prerelease_type], self._prerelease,
            self._dev_count or sys.maxsize)

    def __lt__(self, other):
        """Compare self and other, another Semantic Version."""
        # NB(lifeless) this could perhaps be rewritten as
        # lt (tuple_of_one, tuple_of_other) with a single check for
        # the typeerror corner cases - that would likely be faster
        # if this ever becomes performance sensitive.
        if not isinstance(other, SemanticVersion):
            raise TypeError("ordering to non-SemanticVersion is undefined")
        return self._sort_key() < other._sort_key()

    def __le__(self, other):
        return self == other or self < other

    def __ge__(self, other):
        return not self < other

    def __gt__(self, other):
        return not self <= other

    def __ne__(self, other):
        return not self == other

    def __repr__(self):
        return "pbr.version.SemanticVersion(%s)" % self.release_string()

    @classmethod
    def from_pip_string(klass, version_string):
        """Create a SemanticVersion from a pip version string.

        This method will parse a version like 1.3.0 into a SemanticVersion.

        This method is responsible for accepting any version string that any
        older version of pbr ever created.

        Therefore: versions like 1.3.0a1 versions are handled, parsed into a
        canonical form and then output - resulting in 1.3.0.0a1.
        Pre pbr-semver dev versions like 0.10.1.3.g83bef74 will be parsed but
        output as 0.10.1.dev3.g83bef74.

        :raises ValueError: Never tagged versions sdisted by old pbr result in
            just the git hash, e.g. '1234567' which poses a substantial problem
            since they collide with the semver versions when all the digits are
            numerals. Such versions will result in a ValueError being thrown if
            any non-numeric digits are present. They are an exception to the
            general case of accepting anything we ever output, since they were
            never intended and would permanently mess up versions on PyPI if
            ever released - we're treating that as a critical bug that we ever
            made them and have stopped doing that.
        """

        try:
            return klass._from_pip_string_unsafe(version_string)
        except IndexError:
            raise ValueError("Invalid version %r" % version_string)

    @classmethod
    def _from_pip_string_unsafe(klass, version_string):
        # Versions need to start numerically, ignore if not
        if not version_string[:1].isdigit():
            raise ValueError("Invalid version %r" % version_string)
        input_components = version_string.split('.')
        # decimals first (keep pre-release and dev/hashes to the right)
        components = [c for c in input_components if c.isdigit()]
        digit_len = len(components)
        if digit_len == 0:
            raise ValueError("Invalid version %r" % version_string)
        elif digit_len < 3:
            if (digit_len < len(input_components) and
                    input_components[digit_len][0].isdigit()):
                # Handle X.YaZ - Y is a digit not a leadin to pre-release.
                mixed_component = input_components[digit_len]
                last_component = ''.join(itertools.takewhile(
                    lambda x: x.isdigit(), mixed_component))
                components.append(last_component)
                input_components[digit_len:digit_len + 1] = [
                    last_component, mixed_component[len(last_component):]]
                digit_len += 1
            components.extend([0] * (3 - digit_len))
        components.extend(input_components[digit_len:])
        major = int(components[0])
        minor = int(components[1])
        dev_count = None
        post_count = None
        prerelease_type = None
        prerelease = None

        def _parse_type(segment):
            # Discard leading digits (the 0 in 0a1)
            isdigit = operator.methodcaller('isdigit')
            segment = ''.join(itertools.dropwhile(isdigit, segment))
            isalpha = operator.methodcaller('isalpha')
            prerelease_type = ''.join(itertools.takewhile(isalpha, segment))
            prerelease = segment[len(prerelease_type)::]
            return prerelease_type, int(prerelease)
        if _is_int(components[2]):
            patch = int(components[2])
        else:
            # legacy version e.g. 1.2.0a1 (canonical is 1.2.0.0a1)
            # or 1.2.dev4.g1234 or 1.2.b4
            patch = 0
            components[2:2] = [0]
        remainder = components[3:]
        remainder_starts_with_int = False
        try:
            if remainder and int(remainder[0]):
                remainder_starts_with_int = True
        except ValueError:
            pass
        if remainder_starts_with_int:
            # old dev format - 0.1.2.3.g1234
            dev_count = int(remainder[0])
        else:
            if remainder and (remainder[0][0] == '0' or
                              remainder[0][0] in ('a', 'b', 'r')):
                # Current RC/beta layout
                prerelease_type, prerelease = _parse_type(remainder[0])
                remainder = remainder[1:]
            while remainder:
                component = remainder[0]
                if component.startswith('dev'):
                    dev_count = int(component[3:])
                elif component.startswith('post'):
                    dev_count = None
                    post_count = int(component[4:])
                else:
                    raise ValueError(
                        'Unknown remainder %r in %r'
                        % (remainder, version_string))
                remainder = remainder[1:]
        result = SemanticVersion(
            major, minor, patch, prerelease_type=prerelease_type,
            prerelease=prerelease, dev_count=dev_count)
        if post_count:
            if dev_count:
                raise ValueError(
                    'Cannot combine postN and devN - no mapping in %r'
                    % (version_string,))
            result = result.increment().to_dev(post_count)
        return result

    def brief_string(self):
        """Return the short version minus any alpha/beta tags."""
        return "%s.%s.%s" % (self._major, self._minor, self._patch)

    def debian_string(self):
        """Return the version number to use when building a debian package.

        This translates the PEP440/semver precedence rules into Debian version
        sorting operators.
        """
        return self._long_version("~")

    def decrement(self):
        """Return a decremented SemanticVersion.

        Decrementing versions doesn't make a lot of sense - this method only
        exists to support rendering of pre-release versions strings into
        serialisations (such as rpm) with no sort-before operator.

        The 9999 magic version component is from the spec on this - pbr-semver.

        :return: A new SemanticVersion object.
        """
        if self._patch:
            new_patch = self._patch - 1
            new_minor = self._minor
            new_major = self._major
        else:
            new_patch = 9999
            if self._minor:
                new_minor = self._minor - 1
                new_major = self._major
            else:
                new_minor = 9999
                if self._major:
                    new_major = self._major - 1
                else:
                    new_major = 0
        return SemanticVersion(
            new_major, new_minor, new_patch)

    def increment(self, minor=False, major=False):
        """Return an incremented SemanticVersion.

        The default behaviour is to perform a patch level increment. When
        incrementing a prerelease version, the patch level is not changed
        - the prerelease serial is changed (e.g. beta 0 -> beta 1).

        Incrementing non-pre-release versions will not introduce pre-release
        versions - except when doing a patch incremental to a pre-release
        version the new version will only consist of major/minor/patch.

        :param minor: Increment the minor version.
        :param major: Increment the major version.
        :return: A new SemanticVersion object.
        """
        if self._prerelease_type:
            new_prerelease_type = self._prerelease_type
            new_prerelease = self._prerelease + 1
            new_patch = self._patch
        else:
            new_prerelease_type = None
            new_prerelease = None
            new_patch = self._patch + 1
        if minor:
            new_minor = self._minor + 1
            new_patch = 0
            new_prerelease_type = None
            new_prerelease = None
        else:
            new_minor = self._minor
        if major:
            new_major = self._major + 1
            new_minor = 0
            new_patch = 0
            new_prerelease_type = None
            new_prerelease = None
        else:
            new_major = self._major
        return SemanticVersion(
            new_major, new_minor, new_patch,
            new_prerelease_type, new_prerelease)

    def _long_version(self, pre_separator, rc_marker=""):
        """Construct a long string version of this semver.

        :param pre_separator: What separator to use between components
            that sort before rather than after. If None, use . and lower the
            version number of the component to preserve sorting. (Used for
            rpm support)
        """
        if ((self._prerelease_type or self._dev_count)
                and pre_separator is None):
            segments = [self.decrement().brief_string()]
            pre_separator = "."
        else:
            segments = [self.brief_string()]
        if self._prerelease_type:
            segments.append(
                "%s%s%s%s" % (pre_separator, rc_marker, self._prerelease_type,
                              self._prerelease))
        if self._dev_count:
            if not self._prerelease_type:
                segments.append(pre_separator)
            else:
                segments.append('.')
            segments.append('dev')
            segments.append(self._dev_count)
        return "".join(str(s) for s in segments)

    def release_string(self):
        """Return the full version of the package.

        This including suffixes indicating VCS status.
        """
        return self._long_version(".", "0")

    def rpm_string(self):
        """Return the version number to use when building an RPM package.

        This translates the PEP440/semver precedence rules into RPM version
        sorting operators. Because RPM has no sort-before operator (such as the
        ~ operator in dpkg),  we show all prerelease versions as being versions
        of the release before.
        """
        return self._long_version(None)

    def to_dev(self, dev_count):
        """Return a development version of this semver.

        :param dev_count: The number of commits since the last release.
        """
        return SemanticVersion(
            self._major, self._minor, self._patch, self._prerelease_type,
            self._prerelease, dev_count=dev_count)

    def version_tuple(self):
        """Present the version as a version_info tuple.

        For documentation on version_info tuples see the Python
        documentation for sys.version_info.

        Since semver and PEP-440 represent overlapping but not subsets of
        versions, we have to have some heuristic / mapping rules, and have
        extended the releaselevel field to have alphadev, betadev and
        candidatedev values. When they are present the dev count is used
        to provide the serial.
        - a/b/rc take precedence.
        - if there is no pre-release version the dev version is used.
        - serial is taken from the dev/a/b/c component.
        - final non-dev versions never get serials.
        """
        segments = [self._major, self._minor, self._patch]
        if self._prerelease_type:
            type_map = {('a', False): 'alpha',
                        ('b', False): 'beta',
                        ('rc', False): 'candidate',
                        ('a', True): 'alphadev',
                        ('b', True): 'betadev',
                        ('rc', True): 'candidatedev',
                        }
            segments.append(
                type_map[(self._prerelease_type, bool(self._dev_count))])
            segments.append(self._dev_count or self._prerelease)
        elif self._dev_count:
            segments.append('dev')
            segments.append(self._dev_count - 1)
        else:
            segments.append('final')
            segments.append(0)
        return tuple(segments)


class VersionInfo(object):

    def __init__(self, package):
        """Object that understands versioning for a package

        :param package: name of the python package, such as glance, or
                        python-glanceclient
        """
        self.package = package
        self.version = None
        self._cached_version = None
        self._semantic = None

    def __str__(self):
        """Make the VersionInfo object behave like a string."""
        return self.version_string()

    def __repr__(self):
        """Include the name."""
        return "pbr.version.VersionInfo(%s:%s)" % (
            self.package, self.version_string())

    def _get_version_from_pkg_resources(self):
        """Obtain a version from pkg_resources or setup-time logic if missing.

        This will try to get the version of the package from the pkg_resources
        record associated with the package, and if there is no such record
        falls back to the logic sdist would use.
        """
        # Lazy import because pkg_resources is costly to import so defer until
        # we absolutely need it.
        import pkg_resources
        try:
            requirement = pkg_resources.Requirement.parse(self.package)
            provider = pkg_resources.get_provider(requirement)
            result_string = provider.version
        except pkg_resources.DistributionNotFound:
            # The most likely cause for this is running tests in a tree
            # produced from a tarball where the package itself has not been
            # installed into anything. Revert to setup-time logic.
            from pbr import packaging
            result_string = packaging.get_version(self.package)
        return SemanticVersion.from_pip_string(result_string)

    def release_string(self):
        """Return the full version of the package.

        This including suffixes indicating VCS status.
        """
        return self.semantic_version().release_string()

    def semantic_version(self):
        """Return the SemanticVersion object for this version."""
        if self._semantic is None:
            self._semantic = self._get_version_from_pkg_resources()
        return self._semantic

    def version_string(self):
        """Return the short version minus any alpha/beta tags."""
        return self.semantic_version().brief_string()

    # Compatibility functions
    canonical_version_string = version_string
    version_string_with_vcs = release_string

    def cached_version_string(self, prefix=""):
        """Return a cached version string.

        This will return a cached version string if one is already cached,
        irrespective of prefix. If none is cached, one will be created with
        prefix and then cached and returned.
        """
        if not self._cached_version:
            self._cached_version = "%s%s" % (prefix,
                                             self.version_string())
        return self._cached_version
