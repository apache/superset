# React-Bootstrap [![Travis][build-badge]][build] [![npm][npm-badge]][npm]

[Bootstrap 3][bootstrap] components built with [React][react].

[![Codecov][codecov-badge]][codecov]
[![Discord][discord-badge]][discord]
[![Netlify][netlify-badge]][netlify]

__Under active development - APIs will change.__ Check out the [1.0.0 roadmap](https://github.com/react-bootstrap/react-bootstrap/wiki#100-roadmap) and [contributing guidelines][contributing] to see where you can help out. Prior to the 1.0.0 release, deprecations or breaking changes will result in a minor version bump.

## Docs

See the [documentation][documentation] with live editable examples.

## Related modules

- [react-router-bootstrap][react-router-bootstrap] – Integration with [React Router][react-router]
- [React Bootstrap Extended][react-bootstrap-extended] - A version of React Bootstrap where each component has extra props that map to bootstrap's utility classes. For example, `pullRight` adds the class `pull-right` to a component.
- [Awesome React Bootstrap Components][awesome-react-bootstrap-components] - Additional components like off-canvas navbar, switch and sliders.

## Local setup

Yarn is the our package manager of choice here. Check out setup
instructions [here](https://yarnpkg.com/en/docs/install) if you don't have it installed already.
After that you can run `yarn run bootstrap` to install all the needed dependencies.

From there you can:

- Run the tests once with `yarn test` (Or run them in watch mode with `yarn run tdd`).
- Start a local copy of the docs site with `yarn start`
- Or build a local copy of the library with `yarn run build`

## Contributions

Yes please! See the [contributing guidelines][contributing] for details.

[bootstrap]: https://getbootstrap.com/docs/3.3/
[react]: http://facebook.github.io/react/

[documentation]: http://react-bootstrap.github.io
[contributing]: CONTRIBUTING.md

[build-badge]: https://travis-ci.org/react-bootstrap/react-bootstrap.svg?branch=master
[build]: https://travis-ci.org/react-bootstrap/react-bootstrap

[npm-badge]: https://badge.fury.io/js/react-bootstrap.svg
[npm]: http://badge.fury.io/js/react-bootstrap

[react-router-bootstrap]: https://github.com/react-bootstrap/react-router-bootstrap
[react-router]: https://github.com/reactjs/react-router
[react-bootstrap-extended]: https://github.com/rbalicki2/react-bootstrap-extended
[awesome-react-bootstrap-components]: https://github.com/Hermanya/awesome-react-bootstrap-components

[codecov-badge]: https://img.shields.io/codecov/c/github/react-bootstrap/react-bootstrap/master.svg
[codecov]: https://codecov.io/gh/react-bootstrap/react-bootstrap

[discord-badge]: https://img.shields.io/badge/Discord-Join%20chat%20%E2%86%92-738bd7.svg
[discord]: https://discord.gg/0ZcbPKXt5bXLs9XK

[netlify-badge]: https://api.netlify.com/api/v1/badges/a74fbeb8-f950-4c97-854d-7c8363bef45e/deploy-status
[netlify]: https://app.netlify.com/sites/react-bootstrap-v3/deploys
