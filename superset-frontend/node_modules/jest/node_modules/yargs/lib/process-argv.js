function getProcessArgvBinIndex () {
  // The binary name is the first command line argument for:
  // - bundled Electron apps: bin argv1 argv2 ... argvn
  if (isBundledElectronApp()) return 0
  // or the second one (default) for:
  // - standard node apps: node bin.js argv1 argv2 ... argvn
  // - unbundled Electron apps: electron bin.js argv1 arg2 ... argvn
  return 1
}

function isBundledElectronApp () {
  // process.defaultApp is either set by electron in an electron unbundled app, or undefined
  // see https://github.com/electron/electron/blob/master/docs/api/process.md#processdefaultapp-readonly
  return isElectronApp() && !process.defaultApp
}

function isElectronApp () {
  // process.versions.electron is either set by electron, or undefined
  // see https://github.com/electron/electron/blob/master/docs/api/process.md#processversionselectron-readonly
  return !!process.versions.electron
}

function getProcessArgvWithoutBin () {
  return process.argv.slice(getProcessArgvBinIndex() + 1)
}

function getProcessArgvBin () {
  return process.argv[getProcessArgvBinIndex()]
}

module.exports = {
  getProcessArgvBin,
  getProcessArgvWithoutBin
}
