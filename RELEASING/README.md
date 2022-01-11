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

## Release notes for recent releases

- [1.3](release-notes-1-3/README.md)
- [1.2](release-notes-1-2/README.md)
- [1.1](release-notes-1-1/README.md)
- [1.0](release-notes-1-0/README.md)
- [0.38](release-notes-0-38/README.md)

## Release setup (First Time Only)

First you need to setup a few things. This is a one-off and doesn't
need to be done at every release.

```bash
    # Create PGP Key, and use your @apache.org email address
    gpg --gen-key

    # Checkout ASF dist repo

    svn checkout https://dist.apache.org/repos/dist/dev/superset/ ~/svn/superset_dev

    svn checkout https://dist.apache.org/repos/dist/release/superset/ ~/svn/superset
    cd ~/svn/superset


    # Add your GPG pub key to KEYS file. Replace "Maxime Beauchemin" with your name
    export SUPERSET_PGP_FULLNAME="Maxime Beauchemin"
    (gpg --list-sigs "${SUPERSET_PGP_FULLNAME}" && gpg --armor --export "${SUPERSET_PGP_FULLNAME}" ) >> KEYS


    # Commit the changes
    svn commit -m "Add PGP keys of new Superset committer"

    # push the changes
    svn update
```

## Setting up the release environment (do every time)

As the vote process takes a minimum of 72h, sometimes stretching over several weeks
of calendar time if votes don't pass, chances are
the same terminal session won't be used for crafting the release candidate and the
final release. Therefore, it's a good idea to do the following every time you
work on a new phase of the release process to make sure you aren't releasing
the wrong files/using wrong names. There's a script to help you set correctly all the
necessary environment variables. Change your current directory to `superset/RELEASING`
and execute the `set_release_env.sh` script with the relevant parameters:

Usage (BASH):
```bash
. set_release_env.sh <SUPERSET_RC_VERSION> <PGP_KEY_FULLNAME>
```

Usage (ZSH):
```bash
source set_release_env.sh <SUPERSET_RC_VERSION> <PGP_KEY_FULLNAME>
```

Example:
```bash
source set_release_env.sh 0.38.0rc1 myid@apache.org
```

The script will output the exported variables. Here's example for 0.38.0rc1:

```
Set Release env variables
SUPERSET_VERSION=0.38.0
SUPERSET_RC=1
SUPERSET_GITHUB_BRANCH=0.38
SUPERSET_PGP_FULLNAME=myid@apache.org
SUPERSET_VERSION_RC=0.38.0rc1
SUPERSET_RELEASE=apache-superset-0.38.0
SUPERSET_RELEASE_RC=apache-superset-0.38.0rc1
SUPERSET_RELEASE_TARBALL=apache-superset-0.38.0-source.tar.gz
SUPERSET_RELEASE_RC_TARBALL=apache-superset-0.38.0rc1-source.tar.gz
SUPERSET_TMP_ASF_SITE_PATH=/tmp/superset-site-0.38.0
```

## Crafting a source release

When crafting a new minor or major release we create
a branch named with the release MAJOR.MINOR version (on this example 0.37).
This new branch will hold all PATCH and release candidates
that belong to the MAJOR.MINOR version.

The MAJOR.MINOR branch is normally a "cut" from a specific point in time from the master branch.
Then (if needed) apply all cherries that will make the PATCH.

```bash
git checkout -b $SUPERSET_GITHUB_BRANCH
git push upstream $SUPERSET_GITHUB_BRANCH
```

Next, update the `CHANGELOG.md` with all the changes that are included in the release.
Make sure the branch has been pushed to `upstream` to ensure the changelog generator
can pick up changes since the previous release.
Change log script requires a github token and will try to use your env var GITHUB_TOKEN.
you can also pass the token using the parameter `--access_token`.

Example:
```bash
python changelog.py --previous_version 0.37 --current_version 0.38 changelog
```

You can get a list of pull requests with labels started with blocking, risk, hold, revert and security by using the parameter `--risk`.
Example:
```bash
python changelog.py --previous_version 0.37 --current_version 0.38 changelog --access_token {GITHUB_TOKEN} --risk
```

The script will checkout both branches and compare all the PR's, copy the output and paste it on the `CHANGELOG.md`

Then, in `UPDATING.md`, a file that contains a list of notifications around
deprecations and upgrading-related topics,
make sure to move the content now under the `Next Version` section under a new
section for the new release.

Finally bump the version number on `superset-frontend/package.json` (replace with whichever version is being released excluding the RC version):

```json
"version": "0.38.0"
```

Commit the change with the version number, then git tag the version with the release candidate and push to the branch:

```
# add changed files and commit
git add ...
git commit ...
# push new tag
git tag ${SUPERSET_VERSION_RC}
git push upstream ${SUPERSET_VERSION_RC}
```

## Preparing the release candidate

The first step of preparing an Apache Release is packaging a release candidate
to be voted on. Make sure you have correctly prepared and tagged the ready to ship
release on Superset's repo (MAJOR.MINOR branch), the following script will clone
the tag and create a signed source tarball from it:

```bash
# make_tarball will use the previously set environment variables
# you can override by passing arguments: make_tarball.sh <SUPERSET_VERSION> <SUPERSET_VERSION_RC> "<PGP_KEY_FULLNAME>"
./make_tarball.sh
```

Note that `make_tarball.sh`:

- By default assumes you have already executed an SVN checkout to `$HOME/svn/superset_dev`.
This can be overriden by setting `SUPERSET_SVN_DEV_PATH` environment var to a different svn dev directory
- Will refuse to craft a new release candidate if a release already exists on your local svn dev directory
- Will check `package.json` version number and fails if it's not correctly set

### Build and test the created source tarball

To build and run the **local copy** of the recently created tarball:
```bash
# Build and run a release candidate tarball
./test_run_tarball.sh local
# you should be able to access localhost:5001 on your browser
# login using admin/admin
```

### Shipping to SVN

Now let's ship this RC into svn's dev folder

```bash
cd ~/svn/superset_dev/
svn add ${SUPERSET_VERSION_RC}
svn commit -m "Release ${SUPERSET_VERSION_RC}"
svn update
```

### Build and test from SVN source tarball

To build and run the recently created tarball **from SVN**:
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

To easily send a voting request to Superset community, still on the `superset/RELEASING` directory:

```bash
# Note: use Superset's virtualenv
(venv)$ python send_email.py vote_pmc
```

The script will interactively ask for extra information so it can authenticate on the Apache Email Relay.
The release version and release candidate number are fetched from the previously set environment variables.

```
Sender email (ex: user@apache.org): your_apache_email@apache.org
Apache username: your_apache_user
Apache password: your_apache_password
```

Once 3+ binding votes (by PMC members) have been cast and at
least 72 hours have past, you can post a [RESULT] thread:
https://lists.apache.org/thread.html/50a6b134d66b86b237d5d7bc89df1b567246d125a71394d78b45f9a8@%3Cdev.superset.apache.org%3E

To easily send the result email, still on the `superset/RELEASING` directory:

```bash
# Note: use Superset's virtualenv
python send_email.py result_pmc
```

The script will interactively ask for extra information needed to fill out the email template. Based on the
voting description, it will generate a passing, non passing or non conclusive email.
here's an example:

```
Sender email (ex: user@apache.org): your_apache_email@apache.org
Apache username: your_apache_user
Apache password: your_apache_password
A List of people with +1 binding vote (ex: Max,Grace,Krist): Daniel,Alan,Max,Grace
A List of people with +1 non binding vote (ex: Ville): Ville
A List of people with -1 vote (ex: John):
```

Following the result thread, yet another [VOTE] thread should be

### Validating a release

https://www.apache.org/info/verification.html

## Publishing a successful release

Upon a successful vote, you'll have to copy the folder into the non-"dev/" folder.
```bash
cp -r ~/svn/superset_dev/${SUPERSET_VERSION_RC}/ ~/svn/superset/${SUPERSET_VERSION}/
cd ~/svn/superset/
# Rename the RC (0.34.1rc1) to the actual version being released (0.34.1)
for f in ${SUPERSET_VERSION}/*; do mv "$f" "${f/${SUPERSET_VERSION_RC}/${SUPERSET_VERSION}}"; done
svn add ${SUPERSET_VERSION}
svn commit -m "Release ${SUPERSET_VERSION}"
svn update
```

Then tag the final release:
```bash
# Go to the root directory of the repo, e.g. `~/src/superset`
cd ~/src/superset/
# make sure you're on the correct branch (e.g. 0.34)
git branch
# Create the release tag
git tag -f ${SUPERSET_VERSION}
```

### Update CHANGELOG and UPDATING on superset

Now that we have a final Apache source release we need to open a pull request on Superset
with the changes on `CHANGELOG.md` and `UPDATING.md`.

### Publishing a Convenience Release to PyPI

Using the final release tarball, unpack it and run `./pypi_push.sh`.
This script will build the Javascript bundle and echo the twine command
allowing you to publish to PyPI. You may need to ask a fellow committer to grant
you access to it if you don't have access already. Make sure to create
an account first if you don't have one, and reference your username
while requesting access to push packages.

### Announcing

Once it's all done, an [ANNOUNCE] thread announcing the release to the dev@ mailing list is the final step.

```bash
# Note use Superset's virtualenv
python send_email.py announce
```

### Github Release

Finally, so the Github UI reflects the latest release, you should create a release from the
tag corresponding with the new version. Go to https://github.com/apache/superset/tags,
click the 3-dot icon and select `Create Release`, paste the content of the ANNOUNCE thread in the
release notes, and publish the new release.

At this point, a GitHub action will run that will check whether this release's version number is higher than the current 'latest' release. If that condition is true, this release sha will automatically be tagged as `latest` so that the most recent release can be referenced simply by using the 'latest' tag instead of looking up the version number. The existing version number tag will still exist, and can also be used for reference.
