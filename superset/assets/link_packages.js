const glob = require("glob");
const path = require("path");
const { execSync } = require('child_process');

const repoPath = '../../../superset-ui-plugins/';
const packageGlob = "packages/*/";
const packageGlobs = path.join(repoPath,packageGlob);
console.log(path.resolve(packageGlobs));

glob(packageGlobs, function (error, files) {
    files.forEach(directory => {
        const packageName = require(path.join(directory,'package.json')).name;
        execSync("npm link",{
            cwd: directory,
            stdio: 'inherit'
        })
        execSync("npm link "+packageName,{
            stdio: 'inherit'
        })
    })
    
})
