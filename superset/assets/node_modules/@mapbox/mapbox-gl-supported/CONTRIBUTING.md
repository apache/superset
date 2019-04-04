# Deploying a new release

 - `npm test`
 - `npm version {patch|minor|major}`
 - `git push --follow-tags`
 - `aws s3 cp --acl public-read index.js s3://mapbox-gl-js/plugins/mapbox-gl-supported/v$(node --print --eval "require('./package.json').version")/mapbox-gl-supported.js`
