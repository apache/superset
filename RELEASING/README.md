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

# Apache Releases

Until things settle and we create scripts that streamline this,
you'll probably want to run these commands manually and understand what
they do prior to doing so.

For coordinating on releases, on operational topics that require more
synchronous communications, we recommend using the `#apache-releases` channel
on the Superset Slack. People crafting releases and those interested in
partaking in the process should join the channel.

## Release setup (First Time Only)

First you need to setup a few things. This is a one-off and doesn't
need to be done at every release.

```bash
    # Create PGP Key, and use your @apache.org email address
    gpg --gen-key

    # Checkout ASF dist repo

    svn checkout https://dist.apache.org/repos/dist/dev/incubator/superset/ ~/svn/superset_dev

    svn checkout https://dist.apache.org/repos/dist/release/incubator/superset/ ~/svn/superset
    cd ~/svn/superset


    # Add your GPG pub key to KEYS file. Replace "Maxime Beauchemin" with your name
    export SUPERSET_PGP_FULLNAME="Maxime Beauchemin"
    (gpg --list-sigs "${SUPERSET_PGP_FULLNAME}" && gpg --armor --export "${SUPERSET_PGP_FULLNAME}" ) >> KEYS


    # Commit the changes
    svn commit -m "Add PGP keys of new Superset committer"
```

## Crafting a source release

When crafting a new minor or major release we create 
a branch named with the release MAJOR.MINOR version (on this example 0.34).
This new branch will hold all PATCH and release candidates 
that belong to the MAJOR.MINOR version.

The MAJOR.MINOR branch is normally a "cut" from a specific point in time from the master branch.
Then (if needed) apply all cherries that will make the PATCH

Finally bump the version number on `superset/static/assets/package.json`:

```json
    "version": "0.34.1"
```

Commit the change with the version number, then git tag the version with the release candidate and push

## Setting up the release environment (do every time)

As the vote process takes a minimum of 72h (community vote) + 72h (IPMC) vote,
often stretching over several weeks calendar time if votes don't pass, chances are
the same terminal session won't be used for crafting the release candidate and the
final release. Therefore, it's a good idea to do the following every time you
work on a new phase of the release process to make sure you aren't releasing
the wrong files/using wrong names:

```bash
    # Set SUPERSET_VERSION to the release being prepared, e.g. 0.34.1.
    export SUPERSET_VERSION=XX.YY.ZZ
    # Set RC to the release candindate number. Replacing QQ below with 1
    # indicates rc1 i.e. first vote on version above (0.34.1rc1)
    export SUPERSET_RC=QQ
```

Then you can generate other derived environment variables that are used
throughout the release process:

```bash
    # Replace SUPERSET_PGP_FULLNAME with your PGP key name for Apache
    export SUPERSET_PGP_FULLNAME="YOURFULLNAMEHERE"
    export SUPERSET_VERSION_RC=${SUPERSET_VERSION}rc${SUPERSET_RC}
    export SUPERSET_RELEASE=apache-superset-incubating-${SUPERSET_VERSION}
    export SUPERSET_RELEASE_RC=apache-superset-incubating-${SUPERSET_VERSION_RC}
    export SUPERSET_RELEASE_TARBALL=${SUPERSET_RELEASE}-source.tar.gz
    export SUPERSET_RELEASE_RC_TARBALL=${SUPERSET_RELEASE_RC}-source.tar.gz
```

## Preparing the release candidate

The first step of preparing an Apache Release is packaging a release candidate
to be voted on. Start by going to the root of the repo and making sure the
prerequisites are in order:

```bash
    # Go to the root directory of the repo, e.g. `~/src/incubator-superset`
    cd ~/src/incubator-superset/
    export SUPERSET_REPO_DIR=$(pwd)
    # make sure you're on the correct branch (e.g. 0.34)
    git branch
```

Make sure the version number under `superset/assets/package.json` corresponds
to `SUPERSET_VERSION` above (`0.34.1` in example above), and has been committed to the
branch.

```bash
    grep ${SUPERSET_VERSION} superset/assets/package.json
```

If nothing shows up, either the version isn't correctly set in `package.json`,
or the environment variable is misconfigured.

### Crafting tarball and signatures

Now let's craft a source release
```bash
    # Let's create a git tag
    git tag -f ${SUPERSET_VERSION_RC}

    # Create the target folder
    mkdir -p ~/svn/superset_dev/${SUPERSET_VERSION_RC}/
    git archive \
        --format=tar.gz ${SUPERSET_VERSION_RC} \
        --prefix="${SUPERSET_RELEASE_RC}/" \
        -o ~/svn/superset_dev/${SUPERSET_VERSION_RC}/${SUPERSET_RELEASE_RC_TARBALL}

    cd ~/svn/superset_dev/${SUPERSET_VERSION_RC}/
    ${SUPERSET_REPO_DIR}/scripts/sign.sh "${SUPERSET_RELEASE_RC_TARBALL}" "${SUPERSET_PGP_FULLNAME}"

    # To verify to signature
    gpg --verify "${SUPERSET_RELEASE_RC_TARBALL}".asc "${SUPERSET_RELEASE_RC_TARBALL}"

```

### Shipping to SVN

Now let's ship this RC into svn's dev folder

```bash
    cd ~/svn/superset_dev/
    svn add ${SUPERSET_VERSION_RC}
    svn commit -m "Release ${SUPERSET_VERSION_RC}"
```

### Build and test from source tarball

To make a working build given a tarball
```bash
# Build and run a release candidate tarball
./test_run_tarball.sh
# you should be able to access localhost:5001 on your browser
# login using admin/admin
```

### Voting
Now you're ready to start the [VOTE] thread. Here's an example of a
previous release vote thread:
https://lists.apache.org/thread.html/e60f080ebdda26896214f7d3d5be1ccadfab95d48fbe813252762879@<dev.superset.apache.org>

Once 3+ binding votes (by PMC members) have been cast and at
least 72 hours have past, you can post a [RESULT] thread:
https://lists.apache.org/thread.html/50a6b134d66b86b237d5d7bc89df1b567246d125a71394d78b45f9a8@%3Cdev.superset.apache.org%3E

Following the result thread, yet another [VOTE] thread should be
started at general@incubator.apache.org.

### Announcing

Once it's all done, an [ANNOUNCE] thread announcing the release to the dev@ mailing list is the final step.

### Validating a release

https://www.apache.org/info/verification.html

## Publishing a successful release

Upon a successful vote (community AND IPMC), you'll have to copy the folder
into the non-"dev/" folder.
```bash
    cp -r ~/svn/superset_dev/${SUPERSET_VERSION_RC}/ ~/svn/superset/${SUPERSET_VERSION}/
    cd ~/svn/superset/
    # Rename the RC (0.34.1rc1) to the actual version being released (0.34.1)
    for f in ${SUPERSET_VERSION}/*; do mv "$f" "${f/${SUPERSET_VERSION_RC}/${SUPERSET_VERSION}}"; done
    svn add ${SUPERSET_VERSION}
    svn commit -m "Release ${SUPERSET_VERSION}"
```

Then tag the final release:
```bash
    # Go to the root directory of the repo, e.g. `~/src/incubator-superset`
    cd ~/src/incubator-superset/
    # make sure you're on the correct branch (e.g. 0.34)
    git branch
    # Create the release tag
    git tag -f ${SUPERSET_VERSION}
```

Now you can announce the release on the mailing list, make sure to use the
proper template

### Publishing a Convenience Release to PyPI
From the root of the repo running ./pypi_push.sh will build the
Javascript bundle and echo the twine command allowing you to publish
to PyPI. You may need to ask a fellow committer to grant
you access to it if you don't have access already. Make sure to create
an account first if you don't have one, and reference your username
while requesting access to push packages.

## Post release

In `UPDATING.md`, a file that contains a list of notifications around
deprecations and upgrading-related topics,
make sure to move the content now under the `Next Version` section under a new
section for the new release.

# Refresh documentation website

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
