<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
## Refresh documentation website

Every once in a while we want to compile the documentation and publish it.
Here's how to do it.

```bash
# install doc dependencies
pip install -r docs/requirements.txt

# build the docs
python setup.py build_sphinx

# copy html files to temp folder
cp -r docs/_build/html/ /tmp/tmp_superset_docs/

# clone the docs repo
cd ~/
git clone https://git-wip-us.apache.org/repos/asf/incubator-superset-site.git

# copy
cp -r /tmp/tmp_superset_docs/ ~/incubator-superset-site.git/

# commit and push to `asf-site` branch
cd ~/incubator-superset-site.git/
git checkout asf-site
git add .
git commit -a -m "New doc version"
git push origin master
```

## Publishing a PyPI release

We create a branch that goes along each minor release `0.24`
and micro releases get corresponding tags as in `0.24.0`. Git history should
never be altered in release branches.
Bug fixes and security-related patches get cherry-picked
(usually from master) as in `git cherry-pick -x {SHA}`.

Following a set of cherries being picked, a release can be pushed to
PyPI as follows:

```bash
# branching off of master
git checkout -b 0.25

# cherry-picking a SHA
git cherry-pick -x f9d85bd2e1fd9bc233d19c76bed09467522b968a
# repeat with other SHAs, don't forget the -x

# source of thruth for release numbers live in package.json
vi superset/assets/package.json
# hard code release in file, commit to the release branch
git commit -a -m "0.25.0"

# create the release tag in the release branch
git tag 0.25.0
git push apache 0.25 --tags

# check travis to confirm the build succeeded as
# you shouldn't assume that a clean cherry will be clean
# when landing on a new sundae

# compile the JS, and push to pypi
# to run this part you'll need a pypi account and rights on the
# superset package. Committers that want to ship releases
# should have this access.
# You'll also need a `.pypirc` as specified here:
# https://gist.github.com/davydany/b08acef08f75fe297e13ae4d24ce9f4d
./pypi_push.sh

# publish an update to the CHANGELOG.md for the right version range
# looking the latest CHANGELOG entry for the second argument
./gen_changelog.sh 0.22.1 0.25.0
# this will overwrite the CHANGELOG.md with only the version range
# so you'll want to copy paste that on top of the previous CHANGELOG.md
# open a PR against `master`
```

In the future we'll start publishing release candidates for minor releases
only, but typically not for micro release.
The process will be similar to the process described above, expect the
tags will be formatted `0.25.0rc1`, `0.25.0rc2`, ..., until consensus
is reached.

We should also have a Github PR label process to target the proper
release, and tooling helping keeping track of all the cherries and
target versions.

For Apache releases, the process will be a bit heavier and should get
documented here. There will be extra steps for signing the binaries,
with a PGP key and providing MD5, Apache voting, as well as
publishing to Apache's SVN repository. View the ASF docs for more
information.
