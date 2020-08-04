# scarf-js

![](https://github.com/scarf-sh/scarf-js/workflows/CI/badge.svg)
[![npm version](https://badge.fury.io/js/%40scarf%2Fscarf.svg)](https://badge.fury.io/js/%40scarf%2Fscarf)

Scarf is like Google Analytics for your npm packages. By sending some basic
details after installation, this package can help you can gain insights into how
your packages are used and by which companies. Scarf aims to help support
open-source developers fund their work when used commercially.

To read more about why we wrote this library, check out [this post](https://github.com/scarf-sh/scarf-js/blob/master/WHY.org) on the topic.

### Features

- No dependencies
- Fully transparent to the user. Scarf will log it's behavior to the console
  during installation. It will never silently report analytics for someone that
  hasn't explictly given permission to do so.
- Never interrupts your package installation. Reporting is done on a best effort basis.

### Installing

You'll first need to create a library entry on [Scarf](https://scarf.sh). Once
created, add a dependency on this library to your own:

```bash
npm i --save @scarf/scarf
```

Once your library is published to npm with this change, Scarf will automatically
collect stats on install, no additional code is required!

Head to your package's dashboard on Scarf to see your reports when available.

#### Configuration

Users of your package will be opted in by default and can opt out by setting the
`SCARF_ANALYTICS=false` environment variable. If you'd Scarf analytics to
instead be opt-in, you can set this by adding an entry to your `package.json`


```json5
// your-package/package.json

{
  // ...
  "scarfSettings": {
    "defaultOptIn": false
  }
  // ...
}
```

Scarf will now be opt-out by default, and users can set `SCARF_ANALYTICS=true`
to opt in.

Regardless of the default state, Scarf will log what it is doing to users who
haven't explictly opted in or out.

### What information does Scarf provide me as a package author?

- Basic system information of your users
- Company information of your users
- Dependency tree information of packages that depend on your library

### As a user of a package using Scarf, what information does Scarf send about me?

- The operating system you are using
- Your IP address will be used to look up any available company information. The
  IP address itself will be subsequently deleted.
- Dependency tree information. Scarf sends the package name and version for
  certain packages (provided they are not scoped packages, `@org/package-name`,
  which are assumed to be private):
  - Packages in the dependency tree that directly depend on
  Scarf.
  - Packages that depend on a package that depends on Scarf.
  - The root package of the dependency tree.
### As a user of a package using Scarf, how can I opt out of analytics?

Scarf's analytics help support developers of the open source packages you are
using, so enabling analytics is appreciated. However, if you'd like to opt out,
you can add your preference to your project's `package.json`:

```json5
// your-package/package.json

{
  // ...
  "scarfSettings": {
    "enabled": false
  }
  // ...
}
```

Alternatively, you can set this variable in your environment:

```shell
export SCARF_ANALYTICS=false
```

Either route will disable Scarf for all packages.

### Developing

Setting the environment variable `SCARF_LOCAL_PORT=8080` will configure Scarf to
use http://localhost:${SCARF_LOCAL_PORT} as the analytics endpoint host.

### Future work

Future releases of scarf-js will provide a module of utility functions to
collect usage analytics in addition to the current installation analytics.
