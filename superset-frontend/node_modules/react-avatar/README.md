# &lt;Avatar&gt; [![Build Status](https://travis-ci.org/Sitebase/react-avatar.svg?branch=master)](https://travis-ci.org/Sitebase/react-avatar) [![npm downloads](https://img.shields.io/npm/dm/react-avatar.svg)](https://www.npmjs.com/package/react-avatar) [![version](https://img.shields.io/npm/v/react-avatar.svg)](https://www.npmjs.com/package/react-avatar) ![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/react-avatar.svg) ![npm type definitions](https://img.shields.io/npm/types/react-avatar.svg)

Universal avatar makes it possible to fetch/generate an avatar based on the information you have about that user.
We use a fallback system that if for example an invalid Facebook ID is used it will try Google, and so on.

![React Avatar component preview](docs/example1.jpg)

For the moment we support following types:

* Facebook
* GitHub
* Google (using [Avatar Redirect](#avatar-redirect))
* Twitter (using [Avatar Redirect](#avatar-redirect))
* Instagram (using [Avatar Redirect](#avatar-redirect))
* Vkontakte (using [Avatar Redirect](#avatar-redirect))
* Skype
* Gravatar
* Custom image
* Name initials

The fallbacks are in the same order as the list above were Facebook has the highest priority.

## Demo

[Check it live!](https://www.sitebase.be/react-avatar/?utm_source=github&utm_medium=readme&utm_campaign=react-avatar)

## Install

Install the component using [NPM](https://www.npmjs.com/):

```sh
$ npm install react-avatar --save

# besides React, react-avatar also has prop-types as peer dependency,
# make sure to install it into your project
$ npm install prop-types --save
```

Or [download as ZIP](https://github.com/sitebase/react-avatar/archive/master.zip).

#### Note on usage in Gatsby projects

Users of **Gatsby** who are experiencing issues with the latest release should install `react-avatar@corejs2` instead. This is an older version (v3.7.0) release of `react-avatar` that still used `core-js@2`.

If you'd like to use the latest version of `react-avatar` have a look at [#187](https://github.com/Sitebase/react-avatar/issues/187) for a workaround and [#187](https://github.com/Sitebase/react-avatar/issues/187#issuecomment-587187113), [#181](https://github.com/Sitebase/react-avatar/issues/181) and [#198](https://github.com/Sitebase/react-avatar/issues/198) for a description of the issue.


## Usage

1. Import Custom Element:

    ```js
    import Avatar from 'react-avatar';
    ```

2. Start using it!

    ```html
    <Avatar name="Foo Bar" />
    ```

**Some examples:**

```html
<Avatar googleId="118096717852922241760" size="100" round={true} />
<Avatar facebookId="100008343750912" size="150" />
<Avatar githubHandle="sitebase" size={150} round="20px" />
<Avatar vkontakteId="1" size="150" />
<Avatar skypeId="sitebase" size="200" />
<Avatar twitterHandle="sitebase" size="40" />
<Avatar name="Wim Mostmans" size="150" />
<Avatar name="Wim Mostmans" size="150" textSizeRatio={1.75} />
<Avatar value="86%" size="40" />
<Avatar size="100" facebook-id="invalidfacebookusername" src="http://www.gravatar.com/avatar/a16a38cdfe8b2cbd38e8a56ab93238d3" />
<Avatar name="Wim Mostmans" unstyled="true" />
```

**Manually generating a color:**

```html
import Avatar from 'react-avatar';

<Avatar color={Avatar.getRandomColor('sitebase', ['red', 'green', 'blue'])} name="Wim Mostmans" />
```

**Configuring React Avatar globally**

```html
import Avatar, { ConfigProvider } from 'react-avatar';

<ConfigProvider colors={['red', 'green', 'blue']}>
    <YourApp>
        ...
        <Avatar name="Wim Mostmans" />
        ...
    </YourApp>
</ConfigProvider>

```

## Options

### Avatar

|   Attribute   |      Options      | Default |                                              Description                                               |
| ------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `className`   | *string*          |         | Name of the CSS class you want to add to this component alongside the default `sb-avatar`.             |
| `email`       | *string*          |         | String of the email address of the user.                             |
| `md5Email` | *string* |         | String of the MD5 hash of email address of the user. |
| `facebookId` | *string* |         |                                                                                                        |
| `twitterHandle` | *string* |         |                                                                                                        |
| `instagramId` | *string* |         |                                                                                                        |
| `googleId`   | *string*             |         |                                                                                                        |
| `githubHandle`| *string*          |         | String of the user's GitHub handle.  |
| `skypeId`    | *string*          |         |                                                                                                        |
| `name`        | *string*          |         | Will be used to generate avatar based on the initials of the person                                    |
| `maxInitials` | *number*          |         | Set max nr of characters used for the initials. If maxInitials=2 and the name is Foo Bar Var the initials will be FB  |
| `initials` | *string or function* | [defaultInitials][3] | Set the initials to show or a function that derives them from the component props, the method should have the signature `fn(name, props)` |
| `value`       | *string*          |         | Show a value as avatar                                                                                 |
| `alt`         | *string*          | `name` or `value` | The `alt` attribute used on the avatar `img` tag. If not set we will fallback to either `name` or `value` |
| `title`       | *string*          | `name` or `value` | The `title` attribute used on the avatar `img` tag. If not set we will fallback to either `name` or `value` |
| `color`       | *string*          | random  | Used in combination with `name` and `value`. Give the background a fixed color with a hex like for example #FF0000 |
| `fgColor`     | *string*          | #FFF  | Used in combination with `name` and `value`. Give the text a fixed color with a hex like for example #FF0000 |
| `size`        | *[length][1]*             | 50px      | Size of the avatar                                                                                     |
| `textSizeRatio` | *number*             | 3      | For text based avatars the size of the text as a fragment of size (size / textSizeRatio)                                 |
| `textMarginRatio` | *number*             | .15      | For text based avatars. The size of the minimum margin between the text and the avatar's edge, used to make sure the text will always fit inside the avatar. (calculated as `size * textMarginRatio`)                                 |
| `round`       | *bool or [length][1]*            | false   | The amount of `border-radius` to apply to the avatar corners, `true` shows the avatar in a circle.          |
| `src`         | *string*          |         | Fallback image to use                                                                                  |
| `style`         | *object*          |         | Style that will be applied on the root element                                                       |
| `unstyled`    | *bool*            | false   | Disable all styles                                                                                     |
| `onClick`    | *function*            |        | Mouse click event                                                                                     |

### ConfigProvider

|   Attribute   |      Options      | Default |                                              Description                                               |
| ------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `colors`       | *array(string)*  | [default colors](https://github.com/Sitebase/react-avatar/tree/master/src/utils.js#L39-L47)  | A list of color values as strings from which the `getRandomColor` picks one at random. |
| `cache`       | *[cache](#implementing-a-custom-cache)*          | [internal cache](https://github.com/Sitebase/react-avatar/tree/master/src/cache.js)  | Cache implementation used to track broken img URLs |
| `initials` | *function* | [defaultInitials][3] | A function that derives the initials from the component props, the method should have the signature `fn(name, props)`  |
| `avatarRedirectUrl`  | *URL*          | `undefined`  | Base URL to a [Avatar Redirect](#avatar-redirect) instance |

**Example**

```html
import Avatar, { ConfigProvider } from 'react-avatar';

<ConfigProvider colors={['red', 'green', 'blue']}>
    <YourApp>
        ...
        <Avatar name="Wim Mostmans" />
        ...
    </YourApp>
</ConfigProvider>

```

### Cache

This class represents the default implementation of the cache used by react-avatar.

Looking to implement more complex [custom cache behaviour](#implementing-a-custom-cache)?

|   Attribute   |      Options      | Default |                                              Description                                               |
| ------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `cachePrefix`   | *string*          | `react-avatar/`  | The prefix for `localStorage` keys used by the cache. |
| `sourceTTL`   | *number*          | 604800000 (7 days)  | The amount of time a failed source is kept in cache. (in milliseconds) |
| `sourceSize`  | *number*          | 20      | The maximum number of failed source entries to keep in cache at any time. |

**usage**

```html
import Avatar, { Cache, ConfigProvider } from 'react-avatar';

const cache = new Cache({

    // Keep cached source failures for up to 7 days
    sourceTTL: 7 * 24 * 3600 * 1000,

    // Keep a maximum of 20 entries in the source cache
    sourceSize: 20
});

// Apply cache globally
<ConfigProvider cache={cache}>
    <YourApp>
        ...
        <Avatar name="Wim Mostmans" />
        ...
    </YourApp>
</ConfigProvider>

// For specific instances
<Avatar name="Wim Mostmans" cache={cache} />

```

### Avatar Redirect

[Avatar Redirect][2] adds support for social networks which require a server-side service to find the correct avatar URL.

Examples of this are:

- Twitter
- Instagram

An open Avatar Redirect endpoint is provided at `https://avatar-redirect.appspot.com`. However this endpoint is provided for free and as such an explicit opt-in is required as no guarantees can be made about uptime of this endpoint.

Avatar Redirect is enabled by setting the `avatarRedirectUrl` property on the [ConfigProvider context](#configprovider)

## Development

In order to run it locally you'll need to fetch some dependencies and a basic server setup.

* Install local dependencies:

    ```sh
    $ npm install
    ```

* To test your react-avatar and your changes, start the development server and open `http://localhost:8000/index.html`.

    ```sh
    $ npm run dev
    ```
    
* To create a local production build into the `lib` and `es` folders.

   ```sh
   $ npm run build
   ```
    
### Implementing a custom cache

`cache` as provided to the `ConfigProvider` should be an object implementing the methods below. The default cache implementation can be found [here](https://github.com/Sitebase/react-avatar/tree/master/src/cache.js)

|   Method   |                                              Description                                               |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `set(key, value)`                 | Save `value` at `key`, such that it can be retrieved using `get(key)`. Returns `undefined` |
| `get(key)`                        | Retrieve the value stored at `key`, if the cache does not contain a value for `key` return `null` |
| `sourceFailed(source)`            | Mark the image URL specified in `source` as failed. Returns `undefined` |
| `hasSourceFailedBefore(source)`   | Returns `true` if the `source` has been tagged as failed using `sourceFailed(source)`, otherwise `false`. |

## Reducing bundle size

### Webpack 4

When using webpack 4 you can rely on [tree shaking](https://webpack.js.org/guides/tree-shaking/) to drop unused sources when creating your Avatar component like the example below.

```javascript
import { createAvatarComponent, TwitterSource } from 'react-avatar';

const Avatar = createAvatarComponent({
    sources: [ TwitterSource ]
});
```

Exported sources:
- GravatarSource
- FacebookSource
- GithubSource
- SkypeSource
- ValueSource
- SrcSource
- IconSource
- VKontakteSource
- InstagramSource
- TwitterSource
- GoogleSource
- RedirectSource

### Without Webpack >= 4

If you are using a version of webpack that does not support tree shaking or are using a different bundler you'll need to import only those files you need.

#### ES6 modules
```javascript
import createAvatarComponent from 'react-avatar/es/avatar';
import TwitterSource from 'react-avatar/es/sources/Twitter';

const Avatar = createAvatarComponent({
    sources: [ TwitterSource ]
});
```

#### Transpiled ES5 javascript / commonjs
```javascript
const createAvatarComponent = require('react-avatar/lib/avatar').default;
const TwitterSource = require('react-avatar/lib/sources/Twitter').default;

const Avatar = createAvatarComponent({
    sources: [ TwitterSource ]
});
```

## Products using React Avatar

* [Ambassify](https://www.ambassify.com/?utm_source=github&utm_medium=readme&utm_campaign=react-avatar)

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## History

For detailed changelog, check [Releases](https://github.com/sitebase/react-avatar/releases).

## Maintainers

 - [@Sitebase](https://github.com/Sitebase) (Creator)
 - [@JorgenEvens](https://github.com/JorgenEvens)

## License

[MIT License](http://opensource.org/licenses/MIT)

[1]: https://developer.mozilla.org/en-US/docs/Web/CSS/length
[2]: https://github.com/JorgenEvens/avatar-redirect
[3]: https://github.com/Sitebase/react-avatar/blob/master/src/utils.js
