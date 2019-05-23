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

# Apache Releases

You'll probably want to run these commands manually and understand what
they do prior to doing so.

## Release setup

First you need to setup a few things. This is a one-off and doesn't
need to be done at every release.

```bash
    # Create PGP Key
    gpg --gen-key
     
    # Checkout ASF dist repo

    svn checkout https://dist.apache.org/repos/dist/dev/incubator/superset/ ~/svn/superset_dev

    svn checkout https://dist.apache.org/repos/dist/incubator/superset/ ~/svn/superset
    cd ~/svn/superset
 
  
    # Add your GPG pub key to KEYS file. Replace "Maxime Beauchemin" with your name
    export FULLNAME="Maxime Beauchemin"
    (gpg --list-sigs $FULLNAME && gpg --armor --export $FULLNAME ) >> KEYS
   
    
    # Commit the changes
    svn commit -m "Add PGP keys of new Superset committer"
```

## Crafting tarball and signatures

Now let's craft a source release
```bash
    # Assuming these commands are executed from the root of the repo
    # Setting a VERSION var will be useful
    export VERSION=0.31.0rc18

    # Let's create a git tag
    git tag -f ${VERSION}

    # [WARNING!] This command wipes everything in your repo that is
    # gitignored in preparation for the source release.
    # You may want to check that there's nothing your care about here first.
    # Alternatively you could clone the repo into another location as in
    # git clone git@github.com:apache/incubator-superset.git superset-releases
    git clean -fxd
    # Create the target folder
    mkdir -p ~/svn/superset_dev/${VERSION}/
    git archive \
        --format=tar.gz ${VERSION} \
        --prefix=apache-superset-${VERSION}/ \
        -o ~/svn/superset_dev/${VERSION}/apache-superset-${VERSION}-source.tar.gz

    cd ~/svn/superset_dev/
    scripts/sign.sh apache-superset-${VERSION}-source.tar.gz
```

## Shipping to SVN

Now let's ship this RC into svn's dev folder

```bash
    # cp or mv the files over to the svn repo
    mkdir ~/svn/superset_dev/${VERSION}/
    cp apache-superset-${VERSION}* ~/svn/superset_dev/${VERSION}/
    cd ~/svn/superset_dev/
    svn add ${VERSION}
    svn commit
```

Now you're ready to start the VOTE thread.

## Validating a release

https://www.apache.org/info/verification.html

## Publishing a successful release

Upon a successful vote, you'll have to copy the folder into the non-"dev/"
folder.
```bash
    cp -r ~/svn/superset_dev/${VERSION}/ ~/svn/superset/${VERSION}/
    cd ~/svn/superset/
    svn add ${VERSION}
    svn commit
```

Now you can announce the release on the mailing list, make sure to use the
proper template
