## Using Storybook

You can demo your changes by running the storybook demo locally with the following commands:

```sh
yarn install
yarn build
cd packages/superset-ui-demo
yarn storybook:run
```

Alternatively, you can demo your changes by using the following command while in
`packages/superset-ui-demo`:

```sh
yarn storybook
```

### Tips

When developing, if you would like to see live changes in Storybook.

Instead of

```js
import { xxx } from '@superset-ui/plugin-chart-horizon';
```

which will point to the transpiled code.

Do refer to `src`

```js
import { xxx } from '@superset-ui/plugin-chart-horizon/src';
```

Then after you are satisfied with all the changes, `yarn build` the entire project and remove `/src`
from the `import` statement and check Storybook again. This rarely happens, but the minification
sometimes can cause issue and you may see different results ranging from crashing to different
behavior.
