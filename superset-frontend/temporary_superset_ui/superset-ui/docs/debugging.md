## Debugging Superset plugins in Superset app

### Activating plugins for local development

1. Enable `npm link` for the package.

```sh
cd superset-ui
cd packages/superset-ui-chart
npm link
```

2. Link the local package to `incubator-superset`.

```sh
cd incubator-superset
cd superset/assets
npm link @superset-ui/chart \# use package name in package.json, not directory name
```

3. After npm link complete, update the import statements in Superset.

Instead of

```js
import { xxx } from '@superset-ui/plugin-chart-horizon';
```

which will point to the transpiled code.

do refer to `src`

```js
import { xxx } from '@superset-ui/plugin-chart-horizon/src';
```

4. After that you can run `dev-server` as usual.

```sh
npm run dev-server
```

Now when you change the code in `@superset-ui`, it will update the app immediately similar to code
inside `incubator-superset`.

### Deactivating plugins for local development

1. Change the `import` statements back.

2. Unlink the package from `incubator-superset`.

```cd incubator-superset
cd superset/assets
npm unlink @superset-ui/chart
```

Note: Quite often, `npm link` mess up your `node_modules` and the `unlink` command above does not
work correctly, making webpack build fails or other unexpected behaviors. If that happens, just
delete your `node_modules` and `npm install` from scratch.

3. Clean up global link.

```sh
cd superset-ui
cd packages/superset-ui-chart
npm unlink
```
