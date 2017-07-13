# Copyright 2012 Red Hat, Inc.
# Copyright 2012-2013 Hewlett-Packard Development Company, L.P.
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

import itertools

from testtools import matchers

from pbr.tests import base
from pbr import version


from_pip_string = version.SemanticVersion.from_pip_string


class TestSemanticVersion(base.BaseTestCase):

    def test_ordering(self):
        ordered_versions = [
            "1.2.3.dev6",
            "1.2.3.dev7",
            "1.2.3.a4.dev12",
            "1.2.3.a4.dev13",
            "1.2.3.a4",
            "1.2.3.a5.dev1",
            "1.2.3.a5",
            "1.2.3.b3.dev1",
            "1.2.3.b3",
            "1.2.3.rc2.dev1",
            "1.2.3.rc2",
            "1.2.3.rc3.dev1",
            "1.2.3",
            "1.2.4",
            "1.3.3",
            "2.2.3",
        ]
        for v in ordered_versions:
            sv = version.SemanticVersion.from_pip_string(v)
            self.expectThat(sv, matchers.Equals(sv))
        for left, right in itertools.combinations(ordered_versions, 2):
            l_pos = ordered_versions.index(left)
            r_pos = ordered_versions.index(right)
            if l_pos < r_pos:
                m1 = matchers.LessThan
                m2 = matchers.GreaterThan
            else:
                m1 = matchers.GreaterThan
                m2 = matchers.LessThan
            left_sv = version.SemanticVersion.from_pip_string(left)
            right_sv = version.SemanticVersion.from_pip_string(right)
            self.expectThat(left_sv, m1(right_sv))
            self.expectThat(right_sv, m2(left_sv))

    def test_from_pip_string_legacy_alpha(self):
        expected = version.SemanticVersion(
            1, 2, 0, prerelease_type='rc', prerelease=1)
        parsed = from_pip_string('1.2.0rc1')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_legacy_postN(self):
        # When pbr trunk was incompatible with PEP-440, a stable release was
        # made that used postN versions to represent developer builds. As
        # we expect only to be parsing versions of our own, we map those
        # into dev builds of the next version.
        expected = version.SemanticVersion(1, 2, 4, dev_count=5)
        parsed = from_pip_string('1.2.3.post5')
        self.expectThat(expected, matchers.Equals(parsed))
        expected = version.SemanticVersion(1, 2, 3, 'a', 5, dev_count=6)
        parsed = from_pip_string('1.2.3.0a4.post6')
        self.expectThat(expected, matchers.Equals(parsed))
        # We can't define a mapping for .postN.devM, so it should raise.
        self.expectThat(
            lambda: from_pip_string('1.2.3.post5.dev6'),
            matchers.raises(ValueError))

    def test_from_pip_string_legacy_nonzero_lead_in(self):
        # reported in bug 1361251
        expected = version.SemanticVersion(
            0, 0, 1, prerelease_type='a', prerelease=2)
        parsed = from_pip_string('0.0.1a2')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_legacy_short_nonzero_lead_in(self):
        expected = version.SemanticVersion(
            0, 1, 0, prerelease_type='a', prerelease=2)
        parsed = from_pip_string('0.1a2')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_legacy_no_0_prerelease(self):
        expected = version.SemanticVersion(
            2, 1, 0, prerelease_type='rc', prerelease=1)
        parsed = from_pip_string('2.1.0.rc1')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_legacy_no_0_prerelease_2(self):
        expected = version.SemanticVersion(
            2, 0, 0, prerelease_type='rc', prerelease=1)
        parsed = from_pip_string('2.0.0.rc1')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_legacy_non_440_beta(self):
        expected = version.SemanticVersion(
            2014, 2, prerelease_type='b', prerelease=2)
        parsed = from_pip_string('2014.2.b2')
        self.assertEqual(expected, parsed)

    def test_from_pip_string_pure_git_hash(self):
        self.assertRaises(ValueError, from_pip_string, '6eed5ae')

    def test_from_pip_string_non_digit_start(self):
        self.assertRaises(ValueError, from_pip_string,
                          'non-release-tag/2014.12.16-1')

    def test_final_version(self):
        semver = version.SemanticVersion(1, 2, 3)
        self.assertEqual((1, 2, 3, 'final', 0), semver.version_tuple())
        self.assertEqual("1.2.3", semver.brief_string())
        self.assertEqual("1.2.3", semver.debian_string())
        self.assertEqual("1.2.3", semver.release_string())
        self.assertEqual("1.2.3", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.3"))

    def test_parsing_short_forms(self):
        semver = version.SemanticVersion(1, 0, 0)
        self.assertEqual(semver, from_pip_string("1"))
        self.assertEqual(semver, from_pip_string("1.0"))
        self.assertEqual(semver, from_pip_string("1.0.0"))

    def test_dev_version(self):
        semver = version.SemanticVersion(1, 2, 4, dev_count=5)
        self.assertEqual((1, 2, 4, 'dev', 4), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~dev5", semver.debian_string())
        self.assertEqual("1.2.4.dev5", semver.release_string())
        self.assertEqual("1.2.3.dev5", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.dev5"))

    def test_dev_no_git_version(self):
        semver = version.SemanticVersion(1, 2, 4, dev_count=5)
        self.assertEqual((1, 2, 4, 'dev', 4), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~dev5", semver.debian_string())
        self.assertEqual("1.2.4.dev5", semver.release_string())
        self.assertEqual("1.2.3.dev5", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.dev5"))

    def test_dev_zero_version(self):
        semver = version.SemanticVersion(1, 2, 0, dev_count=5)
        self.assertEqual((1, 2, 0, 'dev', 4), semver.version_tuple())
        self.assertEqual("1.2.0", semver.brief_string())
        self.assertEqual("1.2.0~dev5", semver.debian_string())
        self.assertEqual("1.2.0.dev5", semver.release_string())
        self.assertEqual("1.1.9999.dev5", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.0.dev5"))

    def test_alpha_dev_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'a', 1, 12)
        self.assertEqual((1, 2, 4, 'alphadev', 12), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~a1.dev12", semver.debian_string())
        self.assertEqual("1.2.4.0a1.dev12", semver.release_string())
        self.assertEqual("1.2.3.a1.dev12", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0a1.dev12"))

    def test_alpha_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'a', 1)
        self.assertEqual((1, 2, 4, 'alpha', 1), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~a1", semver.debian_string())
        self.assertEqual("1.2.4.0a1", semver.release_string())
        self.assertEqual("1.2.3.a1", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0a1"))

    def test_alpha_zero_version(self):
        semver = version.SemanticVersion(1, 2, 0, 'a', 1)
        self.assertEqual((1, 2, 0, 'alpha', 1), semver.version_tuple())
        self.assertEqual("1.2.0", semver.brief_string())
        self.assertEqual("1.2.0~a1", semver.debian_string())
        self.assertEqual("1.2.0.0a1", semver.release_string())
        self.assertEqual("1.1.9999.a1", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.0.0a1"))

    def test_alpha_major_zero_version(self):
        semver = version.SemanticVersion(1, 0, 0, 'a', 1)
        self.assertEqual((1, 0, 0, 'alpha', 1), semver.version_tuple())
        self.assertEqual("1.0.0", semver.brief_string())
        self.assertEqual("1.0.0~a1", semver.debian_string())
        self.assertEqual("1.0.0.0a1", semver.release_string())
        self.assertEqual("0.9999.9999.a1", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.0.0.0a1"))

    def test_alpha_default_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'a')
        self.assertEqual((1, 2, 4, 'alpha', 0), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~a0", semver.debian_string())
        self.assertEqual("1.2.4.0a0", semver.release_string())
        self.assertEqual("1.2.3.a0", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0a0"))

    def test_beta_dev_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'b', 1, 12)
        self.assertEqual((1, 2, 4, 'betadev', 12), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~b1.dev12", semver.debian_string())
        self.assertEqual("1.2.4.0b1.dev12", semver.release_string())
        self.assertEqual("1.2.3.b1.dev12", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0b1.dev12"))

    def test_beta_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'b', 1)
        self.assertEqual((1, 2, 4, 'beta', 1), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~b1", semver.debian_string())
        self.assertEqual("1.2.4.0b1", semver.release_string())
        self.assertEqual("1.2.3.b1", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0b1"))

    def test_decrement_nonrelease(self):
        # The prior version of any non-release is a release
        semver = version.SemanticVersion(1, 2, 4, 'b', 1)
        self.assertEqual(
            version.SemanticVersion(1, 2, 3), semver.decrement())

    def test_decrement_nonrelease_zero(self):
        # We set an arbitrary max version of 9999 when decrementing versions
        # - this is part of handling rpm support.
        semver = version.SemanticVersion(1, 0, 0)
        self.assertEqual(
            version.SemanticVersion(0, 9999, 9999), semver.decrement())

    def test_decrement_release(self):
        # The next patch version of a release version requires a change to the
        # patch level.
        semver = version.SemanticVersion(2, 2, 5)
        self.assertEqual(
            version.SemanticVersion(2, 2, 4), semver.decrement())

    def test_increment_nonrelease(self):
        # The next patch version of a non-release version is another
        # non-release version as the next release doesn't need to be
        # incremented.
        semver = version.SemanticVersion(1, 2, 4, 'b', 1)
        self.assertEqual(
            version.SemanticVersion(1, 2, 4, 'b', 2), semver.increment())
        # Major and minor increments however need to bump things.
        self.assertEqual(
            version.SemanticVersion(1, 3, 0), semver.increment(minor=True))
        self.assertEqual(
            version.SemanticVersion(2, 0, 0), semver.increment(major=True))

    def test_increment_release(self):
        # The next patch version of a release version requires a change to the
        # patch level.
        semver = version.SemanticVersion(1, 2, 5)
        self.assertEqual(
            version.SemanticVersion(1, 2, 6), semver.increment())
        self.assertEqual(
            version.SemanticVersion(1, 3, 0), semver.increment(minor=True))
        self.assertEqual(
            version.SemanticVersion(2, 0, 0), semver.increment(major=True))

    def test_rc_dev_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'rc', 1, 12)
        self.assertEqual((1, 2, 4, 'candidatedev', 12), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~rc1.dev12", semver.debian_string())
        self.assertEqual("1.2.4.0rc1.dev12", semver.release_string())
        self.assertEqual("1.2.3.rc1.dev12", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0rc1.dev12"))

    def test_rc_version(self):
        semver = version.SemanticVersion(1, 2, 4, 'rc', 1)
        self.assertEqual((1, 2, 4, 'candidate', 1), semver.version_tuple())
        self.assertEqual("1.2.4", semver.brief_string())
        self.assertEqual("1.2.4~rc1", semver.debian_string())
        self.assertEqual("1.2.4.0rc1", semver.release_string())
        self.assertEqual("1.2.3.rc1", semver.rpm_string())
        self.assertEqual(semver, from_pip_string("1.2.4.0rc1"))

    def test_to_dev(self):
        self.assertEqual(
            version.SemanticVersion(1, 2, 3, dev_count=1),
            version.SemanticVersion(1, 2, 3).to_dev(1))
        self.assertEqual(
            version.SemanticVersion(1, 2, 3, 'rc', 1, dev_count=1),
            version.SemanticVersion(1, 2, 3, 'rc', 1).to_dev(1))
