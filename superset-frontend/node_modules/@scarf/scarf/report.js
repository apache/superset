const path = require('path')
const os = require('os')
const exec = require('child_process').exec
const localDevPort = process.env.SCARF_LOCAL_PORT
const https = localDevPort ? require('http') : require('https')
const fs = require('fs').promises

const scarfHost = localDevPort ? 'localhost' : 'scarf.sh'
const scarfLibName = '@scarf/scarf'

const rootPath = path.resolve(__dirname).split('node_modules')[0]

const makeDefaultSettings = () => {
  return {
    defaultOptIn: true
  }
}

function logIfVerbose (toLog, stream) {
  if (process.env.SCARF_VERBOSE === 'true') {
    (stream || console.log)(toLog)
  }
}

// SCARF_NO_ANALYTICS was the orginal variable, we'll get rid of it eventually
const userHasOptedOut = (rootPackage) => {
  return (rootPackage && rootPackage.scarfSettings && rootPackage.scarfSettings.enabled === false) ||
    (process.env.SCARF_ANALYTICS === 'false' || process.env.SCARF_NO_ANALYTICS === 'true')
}

const userHasOptedIn = (rootPackage) => {
  return (rootPackage && rootPackage.scarfSettings && rootPackage.scarfSettings.enabled) || process.env.SCARF_ANALYTICS === 'true'
}

// We don't send any paths, we don't send any scoped package names or versions
function redactSensitivePackageInfo (dependencyInfo) {
  const scopedRegex = /@\S+\//
  const privatePackageRewrite = '@private/private'
  const privateVersionRewrite = '0'
  if (dependencyInfo.grandparent && dependencyInfo.grandparent.name.match(scopedRegex)) {
    dependencyInfo.grandparent.name = privatePackageRewrite
    dependencyInfo.grandparent.version = privateVersionRewrite
  }
  if (dependencyInfo.rootPackage && dependencyInfo.rootPackage.name.match(scopedRegex)) {
    dependencyInfo.rootPackage.name = privateVersionRewrite
    dependencyInfo.rootPackage.version = privateVersionRewrite
  }
  delete (dependencyInfo.rootPackage.packageJsonPath)
  delete (dependencyInfo.rootPackage.path)
  delete (dependencyInfo.parent.path)
  delete (dependencyInfo.scarf.path)
  if (dependencyInfo.grandparent) {
    delete (dependencyInfo.grandparent.path)
  }
  return dependencyInfo
}

async function getDependencyInfo () {
  return new Promise((resolve, reject) => {
    exec(`cd ${rootPath} && npm ls @scarf/scarf --json --long`, function (error, stdout, stderr) {
      if (error) {
        return reject(new Error(`Scarf received an error from npm -ls: ${error}`))
      }

      const output = JSON.parse(stdout)

      let depsToScarf = findScarfInFullDependencyTree(output)
      depsToScarf = depsToScarf.filter(depChain => depChain.length > 2)
      if (depsToScarf.length === 0) {
        return reject(new Error('No Scarf parent package found'))
      }

      const rootPackageDetails = rootPackageDepInfo(output)

      const dependencyInfo = depsToScarf.map(depChain => {
        return {
          scarf: depChain[depChain.length - 1],
          parent: depChain[depChain.length - 2],
          grandparent: depChain[depChain.length - 3], // might be undefined
          rootPackage: rootPackageDetails
        }
      })

      dependencyInfo.forEach(d => {
        d.parent.scarfSettings = Object.assign(makeDefaultSettings(), d.parent.scarfSettings || {})
      })

      // Here, we find the dependency chain that corresponds to the scarf package we're currently in
      const dependencyToReport = dependencyInfo.find(dep => (dep.scarf.path === __dirname))
      if (!dependencyToReport) {
        return reject(new Error(`Couldn't find dependency info for path ${__dirname}`))
      }

      return resolve(dependencyToReport)
    })
  })
}

async function reportPostInstall () {
  const scarfApiToken = process.env.SCARF_API_TOKEN
  const dependencyInfo = await getDependencyInfo()
  if (!dependencyInfo.parent || !dependencyInfo.parent.name) {
    return Promise.reject(new Error('No parent, nothing to report'))
  }

  const rootPackage = dependencyInfo.rootPackage

  await new Promise((resolve, reject) => {
    if (dependencyInfo.parent.scarfSettings.defaultOptIn) {
      if (userHasOptedOut(rootPackage)) {
        return reject(new Error('User has opted out'))
      }

      if (!userHasOptedIn(rootPackage)) {
        console.log(`
    The dependency '${dependencyInfo.parent.name}' is tracking installation
    statistics using Scarf (https://scarf.sh), which helps open-source developers
    fund and maintain their projects. Scarf securely logs basic installation
    details when this package is installed. The Scarf npm library is open source
    and permissively licensed at https://github.com/scarf-sh/scarf-js. For more
    details about your project's dependencies, try running 'npm ls'. To opt out of
    analytics, set the environment variable 'SCARF_ANALYTICS=false'.
  `)
      }
      resolve(dependencyInfo)
    } else {
      if (!userHasOptedIn(rootPackage)) {
        if (!userHasOptedOut(rootPackage)) {
          // We'll only print the 'please opt in' text if the user hasn't
          // already opted out
          console.log(`
    The dependency '${dependencyInfo.parent.name}' would like to track
    installation statistics using Scarf (https://scarf.sh), which helps
    open-source developers fund and maintain their projects. Reporting is disabled
    by default for this package. When enabled, Scarf securely logs basic
    installation details when this package is installed. The Scarf npm library is
    open source and permissively licensed at https://github.com/scarf-sh/scarf-js.
    For more details about your project's dependencies, try running 'npm ls'.
  `
          )
          const stdin = process.stdin
          stdin.setEncoding('utf-8')

          process.stdout.write(`Would you like to support ${dependencyInfo.parent.name} by sending analytics for this install? (y/N): `)

          const timeout1 = setTimeout(() => {
            console.log('')
            reject(new Error('Timeout waiting for user opt in'))
          }, 7000)

          stdin.on('data', async function (data) {
            clearTimeout(timeout1)
            const enabled = data.trim().toLowerCase() === 'y'

            const afterUserInput = (enabled, saved) => {
              if (enabled) {
                console.log('Thanks for enabling analytics!')
              }

              if (!saved) {
                console.log('To prevent this message in the future, you can also set the `SCARF_ANALYTICS=true|false` environment variable')
              }

              if (enabled) {
                return resolve(dependencyInfo)
              } else {
                return reject(new Error('Not enabled via cli'))
              }
            }

            process.stdout.write('Save this preference to your project\'s package.json file? (y/N): ')

            setTimeout(() => {
              console.log('')
              return afterUserInput(enabled, false)
            }, 15000)

            stdin.removeAllListeners('data')
            stdin.on('data', async function (data) {
              const savePreference = data.trim().toLowerCase() === 'y'
              if (savePreference) {
                await savePreferencesToRootPackage(dependencyInfo.rootPackage.packageJsonPath, enabled)
              }
              return afterUserInput(enabled, savePreference)
            })
          })
        }
      } else {
        resolve(dependencyInfo)
      }
    }
  })

  redactSensitivePackageInfo(dependencyInfo)

  const infoPayload = {
    libraryType: 'npm',
    rawPlatform: os.platform(),
    rawArch: os.arch(),
    dependencyInfo: dependencyInfo
  }

  const data = JSON.stringify(infoPayload)
  logIfVerbose(`Scarf payload: ${data}`)

  const reqOptions = {
    host: scarfHost,
    port: localDevPort,
    method: 'POST',
    path: '/package-event/install',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  }

  if (scarfApiToken) {
    const authToken = Buffer.from(`n/a:${scarfApiToken}`).toString('base64')
    reqOptions.headers.Authorization = `Basic ${authToken}`
  }

  await new Promise((resolve, reject) => {
    const req = https.request(reqOptions, (res) => {
      logIfVerbose(`Response status: ${res.statusCode}`)
      resolve()
    })

    req.on('error', error => {
      logIfVerbose(error, console.error)
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

// Find all paths to Scarf from the json output of npm ls @scarf/scarf --json in
// the root package being installed by the user
//
// [{
//   scarfPackage: {name: `@scarf/scarf`, version: '0.0.1'},
//   parentPackage: { name: 'scarfed-library', version: '1.0.0', scarfSettings: { defaultOptIn: true } },
//   grandparentPackage: { name: 'scarfed-lib-consumer', version: '1.0.0' }
// }]
function findScarfInSubDepTree (pathToDep, deps) {
  const depNames = Object.keys(deps || {})

  if (!depNames) {
    return []
  }

  const scarfFound = depNames.find(depName => depName === scarfLibName)
  const output = []
  if (scarfFound) {
    output.push(pathToDep.concat([{ name: scarfLibName, version: deps[scarfLibName].version, path: deps[scarfLibName].path }]))
  }
  for (let i = 0; i < depNames.length; i++) {
    const depName = depNames[i]
    const newPathToDep = pathToDep.concat([
      {
        name: depName,
        version: deps[depName].version,
        scarfSettings: deps[depName].scarfSettings,
        path: deps[depName].path
      }
    ])
    const results = findScarfInSubDepTree(newPathToDep, deps[depName].dependencies)
    if (results) {
      for (let j = 0; j < results.length; j++) {
        output.push(results[j])
      }
    }
  }

  return output
}

function findScarfInFullDependencyTree (tree) {
  if (tree.name === scarfLibName) {
    return [[{ name: scarfLibName, version: tree.version }]]
  } else {
    return findScarfInSubDepTree([packageDetailsFromDepInfo(tree)], tree.dependencies)
  }
}

function packageDetailsFromDepInfo (tree) {
  return {
    name: tree.name,
    version: tree.version,
    scarfSettings: tree.scarfSettings,
    path: tree.path
  }
}

function rootPackageDepInfo (packageInfo) {
  const info = packageDetailsFromDepInfo(packageInfo)
  info.packageJsonPath = `${packageInfo.path}/package.json`
  return info
}

async function savePreferencesToRootPackage (path, optIn) {
  const packageJsonString = await fs.readFile(path)
  const parsed = JSON.parse(packageJsonString)
  parsed.scarfSettings = {
    enabled: optIn
  }
  await fs.writeFile(path, JSON.stringify(parsed, null, 2))
}

if (require.main === module) {
  try {
    reportPostInstall().catch(e => {
      // This is an optional, best effort attempt. If there are any errors in
      // Scarf, we must not interfere with whatever the user is doing
      logIfVerbose(`\n\n${e}`, console.error)
    }).finally(() => {
      process.exit(0)
    })
  } catch (e) {
    logIfVerbose(`\n\nTop level error: ${e}`, console.error)
    process.exit(0)
  }
}
