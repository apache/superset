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
Here's the source to the documentation hosted at
<a href="https://superset.apache.org">superset.apache.org</a>

The site runs on the Gatsby framework and uses docz for it's
`Documentation` subsection.


## Getting Started

```bash
cd docs/
npm install
npm run start
# navigate to localhost:8000`
```

## To Publish

To publish, the static site that Gatsby generates needs to be pushed
to the `asf-site` branch on the
[apache/incubator-superset-site](https://github.com/apache/incubator-superset-site/)
repository. No need to PR here, just `git push`!

```bash
# Get in the docs/ folder in the main repo
cd ~/repos/incubator-superset/docs
# have Gatsby build the static website, this puts in under `docs/public`
npm run build

# go to the docs repo
cd ~/repos/incubator-superset-site
# checkout the proper branch
git checkout asf-site

# BE CAREFUL WITH THIS COMMAND
# wipe the content of the repo
rm -rf *

# copy the static site here
cp -r ~/repos/incubator-superset/docs/public ./

# git push
git add .
git commit "{{ relevant commit msg }}"
git push origin asf-site

# SUCCESS - it should take minutes to take effect on superset.apache.org
```
