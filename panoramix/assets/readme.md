Front End Assets
----------------

This directory contains all npm-managed, front end assets. Flask-Appbuilder itself comes bundled
with jQuery and bootstrap. While these may be phased out over time, these packages are currently not
managed with npm.


Using npm to generate bundled files
-----------------------------------

#### npm
First, npm must be available in your environment. If it is not you can run the following commands 
(taken from [this source](https://gist.github.com/DanHerbert/9520689)) 
```
brew install node --without-npm
echo prefix=~/.npm-packages >> ~/.npmrc
curl -L https://www.npmjs.com/install.sh | sh
```

The final step is to add ```~/.node/bin``` to your ```PATH``` so commands you install globally are usable. Add something like this to your ```.bashrc``` or ```.zshrc``` file.
```
export PATH="$HOME/.node/bin:$PATH"
```

#### npm packages
To install third party libraries defined in ```package.json```, run the following within this directory which will install them in a new ```node_modules/``` folder within ```assets/```.

```
npm install
```

To parse and generate bundled files for panoramix, run either of the following commands. The ```dev``` flag will keep the npm script running and re-run it upon any changes within the assets directory.

```
npm run prod
npm run dev
```
