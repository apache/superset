# Publishing

So the time has come to publish the latest version of ts-loader to npm. Exciting!

Before you can actually publish make sure the following statements are true:

- Tests should be green
- The version number in [package.json](package.json) has been incremented.
- The [changelog](CHANGELOG.md) has been updated with details of the changes in this release.  Where possible include the details of the issues affected and the PRs raised.

OK - you're actually ready.  We're going to publish.  Here we need to tread carefully. Follow these steps: 

- clone ts-loader from the main repo with this command: `git clone https://github.com/TypeStrong/ts-loader.git`
- [Login to npm](https://docs.npmjs.com/cli/adduser) if you need to: `npm login`
- install ts-loaders packages with `yarn install`
- build ts-loader with `yarn build`
- run the tests to ensure all is still good: `yarn test`

If all the tests passed then we're going to ship:
- tag the release in git.  You can see existing tags with the command `git tag`.  If the version in your `package.json` is `"1.0.1"` then you would tag the release like so: `git tag v1.0.1`.  For more on type of tags we're using read [here](https://git-scm.com/book/en/v2/Git-Basics-Tagging#Lightweight-Tags).
- Push the tag so the new version will show up in the [releases](https://github.com/TypeStrong/ts-loader/releases): `git push origin --tags`
- On the releases page, click the "Draft a new release button" and, on the presented page, select the version you've just released, name it and copy in the new markdown that you added to the [changelog](CHANGELOG.md).
- Now the big moment: `npm publish` ([alas `yarn publish` doesn't seem to publish all the js to npm](https://github.com/TypeStrong/ts-loader/issues/654))

You've released!  Pat yourself on the back.