# global-modules-path
Returns path to globally installed package.

## System requirements
In order to use this package you need:
 - Node.js 4.0.0 or later
 - npm 2.0.0 or later added to your PATH environment variable (you should be able to execute `npm --version` from your default terminal).

## Usage
The module has a single public method called `getPath`. It requires at least one argument - the name of the globally installed package that you need.
In case the package is not installed, `getPath` will return null.
`getPath` will throw error in case the OS is **NOT** supported. Supported OS are:
 - Windows (`process.platform` returns `win32`)
 - macOS (`process.platform` returns `darwin`)
 - Linux (`process.platform` returns `linux`)

### Using getPath with single argument
Example:
```
let pathToPackage = require("global-modules-path").getPath("packageName");
```

The method returns the path to globally installed package or null. The code constructs the path based on the result of `npm config get prefix` and checks if the package exists.

### Using getPath with package name and executable name.
Example:
```
let pathToPackage = require("global-modules-path").getPath("packageName", "executableName");
```
The method returns the path to globally installed package or null. The code constructs the path based on the result of `npm config get prefix` and checks if the package exists. In case the package cannot be found in this way, the `executableName` is used to determine if the package is globally installed.
- On Windows the package spawns `where executableName` command and parses the result.
- On macOS and Linux the package spawns `ls -l executableName` and `which executableName` and parses the results.

>NOTE: In some cases the executable name is not the same as the package name.
