var childProcess = require('child_process')
var pkgUp = require('pkg-up')
var path = require('path')
var fs = require('fs')

var BrowserslistError = require('./error')

function detectLockfile () {
  var packagePath = pkgUp.sync()
  if (!packagePath) {
    throw new BrowserslistError(
      'Cannot find package.json. ' +
      'Is it a right project to run npx browserslist --update-db?'
    )
  }

  var rootDir = path.dirname(packagePath)
  var lockfileNpm = path.join(rootDir, 'package-lock.json')
  var lockfileYarn = path.join(rootDir, 'yarn.lock')
  var lockfilePnpm = path.join(rootDir, 'pnpm-lock.yaml')

  /* istanbul ignore next */
  if (fs.existsSync(lockfilePnpm)) {
    return { mode: 'pnpm', file: lockfilePnpm }
  } else if (fs.existsSync(lockfileNpm)) {
    return { mode: 'npm', file: lockfileNpm }
  } else if (fs.existsSync(lockfileYarn)) {
    return { mode: 'yarn', file: lockfileYarn }
  } else {
    throw new BrowserslistError(
      'No lockfile found. Run "npm install", "yarn install" or "pnpm install"'
    )
  }
}

function getCurrentVersion (lock) {
  var match
  /* istanbul ignore if */
  if (lock.mode === 'pnpm') {
    match = /\/caniuse-lite\/([^:]+):/.exec(lock.content)
    if (match[1]) return match[1]
  } else if (lock.mode === 'npm') {
    var dependencies = JSON.parse(lock.content).dependencies
    if (dependencies && dependencies['caniuse-lite']) {
      return dependencies['caniuse-lite'].version
    }
  } else if (lock.mode === 'yarn') {
    match = /caniuse-lite@[^:]+:\n\s+version\s+"([^"]+)"/.exec(lock.content)
    if (match[1]) return match[1]
  }
  return null
}

function getLastestInfo () {
  return JSON.parse(
    childProcess.execSync('npm show caniuse-lite --json').toString()
  )
}

function updateLockfile (lock, latest) {
  if (lock.mode === 'npm') {
    var fixed = deletePackage(JSON.parse(lock.content))
    return JSON.stringify(fixed, null, '  ')
  } else {
    var lines = lock.content.split('\n')
    var i
    /* istanbul ignore if */
    if (lock.mode === 'pnpm') {
      for (i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('caniuse-lite:') >= 0) {
          lines[i] = lines[i].replace(/: .*$/, ': ' + latest.version)
        } else if (lines[i].indexOf('/caniuse-lite') >= 0) {
          lines[i] = lines[i].replace(/\/[^/:]+:/, '/' + latest.version + ':')
          for (i = i + 1; i < lines.length; i++) {
            if (lines[i].indexOf('integrity: ') !== -1) {
              lines[i] = lines[i].replace(
                /integrity: .+/, 'integrity: ' + latest.dist.integrity
              )
            } else if (lines[i].indexOf(' /') !== -1) {
              break
            }
          }
        }
      }
    } else if (lock.mode === 'yarn') {
      for (i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('caniuse-lite@') !== -1) {
          lines[i + 1] = lines[i + 1].replace(
            /version "[^"]+"/, 'version "' + latest.version + '"'
          )
          lines[i + 2] = lines[i + 2].replace(
            /resolved "[^"]+"/, 'resolved "' + latest.dist.tarball + '"'
          )
          lines[i + 3] = lines[i + 3].replace(
            /integrity .+/, 'integrity ' + latest.dist.integrity
          )
          i += 4
        }
      }
    }
    return lines.join('\n')
  }
}

function deletePackage (node) {
  if (node.dependencies) {
    delete node.dependencies['caniuse-lite']
    for (var i in node.dependencies) {
      node.dependencies[i] = deletePackage(node.dependencies[i])
    }
  }
  return node
}

module.exports = function updateDB (print) {
  var lock = detectLockfile()
  lock.content = fs.readFileSync(lock.file).toString()

  var current = getCurrentVersion(lock)
  var latest = getLastestInfo()

  if (typeof current === 'string') {
    print('Current version: ' + current + '\n')
  }
  print(
    'New version: ' + latest.version + '\n' +
    'Updating caniuse-lite…\n'
  )

  fs.writeFileSync(lock.file, updateLockfile(lock, latest))
  childProcess.execSync(lock.mode + ' install')

  print('caniuse-lite has been successfully updated')
}
