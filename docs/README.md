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
repository. No need to PR here, simply `git push`.

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
cp -r ~/repos/incubator-superset/docs/public/ ./

# git push
git add .
git commit -m "relevant commit msg"
git push origin asf-site

# SUCCESS - it should take minutes to take effect on superset.apache.org
```

## Contributing Screenshots to the Gallery

We welcome the addition of screenshots to our gallery. All you have to do is
to drop high
resolution images (ideally retina quality)
[here](https://github.com/apache/incubator-superset/tree/master/docs/src/images/gallery)
and Gatsby does all the work of creating thumbnails for the
[gallery](https://superset.apache.org/gallery/) at build time.
Ordering, captions and tags can be defined
[in this file](https://github.com/apache/incubator-superset/blob/master/docs/src/pages/gallery.tsx#L41).
