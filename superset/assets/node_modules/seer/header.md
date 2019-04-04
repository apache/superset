# Seer API

This library provides an abstraction around the [Window.postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
to interact with the Seer extension.

How the communication is done exactly relies on the bridge, that you can checkout
in its dedicated [directory](../src/bridge). The following schema represent the
complete data flow:

<img src="https://cdn.pbrd.co/images/92al0O7cY.png" height="300" />

## Install

Simply download the package from the npm registry

    yarn add seer

## Notes

The extension will declare a `__SEER_INITIALIZED__` boolean on the window,
that you can use to check if the extension is installed and prevent any useless
processing in production or for real-users.

