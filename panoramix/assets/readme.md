Front End Assets
----------------

This directory contains all npm-managed, front end assets. Flask-Appbuilder itself comes bundled
with jQuery and bootstrap. While these may be phased out over time, these packages are currently not
managed with npm.


Using npm to generate bundled files
-----------------------------------

To install third party libraries defined in package.json, run the following within this directory

```
npm install
```

To parse and generate bundled files, run either of the following. The dev flag will keep the npm script running
and re-run upon any changes within the dev directory

```
npm run prod
npm run dev
```
