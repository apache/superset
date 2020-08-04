# css-what [![Build Status](https://secure.travis-ci.org/fb55/css-what.svg?branch=master)](http://travis-ci.org/fb55/css-what)

a CSS selector parser

## Example

```js
const CSSwhat = require("css-what")
CSSwhat.parse("foo[bar]:baz")

~> [
    [
        { type: "tag", name: "foo" },
        {
            type: "attribute",
            name: "bar",
            action: "exists",
            value: "",
            ignoreCase: false
        },
        { type: "pseudo", name: "baz", data: null }
    ]
]
```

## API

**`CSSwhat.parse(str, options)` - Parses `str`, optionally with the passed `options`.**

The function returns a two-dimensional array. The first array represents selectors separated by commas (eg. `sub1, sub2`), the second contains the relevant tokens for that selector. Possible token types are:

| name             | attributes                              | example       | output                                                                                   |
| ---------------- | --------------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `tag`            | `name`                                  | `div`         | `{ type: 'tag', name: 'div' }`                                                           |
| `universal`      | -                                       | `*`           | `{ type: 'universal' }`                                                                  |
| `pseudo`         | `name`, `data`                          | `:name(data)` | `{ type: 'pseudo', name: 'name', data: 'data' }`                                         |
| `pseudo`         | `name`, `data`                          | `:name`       | `{ type: 'pseudo', name: 'name', data: null }`                                           |
| `pseudo-element` | `name`                                  | `::name`      | `{ type: 'pseudo-element', name: 'name' }`                                               |
| `attribute`      | `name`, `action`, `value`, `ignoreCase` | `[attr]`      | `{ type: 'attribute', name: 'attr', action: 'exists', value: '', ignoreCase: false }`    |
| `attribute`      | `name`, `action`, `value`, `ignoreCase` | `[attr=val]`  | `{ type: 'attribute', name: 'attr', action: 'equals', value: 'val', ignoreCase: false }` |
| `attribute`      | `name`, `action`, `value`, `ignoreCase` | `[attr^=val]` | `{ type: 'attribute', name: 'attr', action: 'start', value: 'val', ignoreCase: false }`  |
| `attribute`      | `name`, `action`, `value`, `ignoreCase` | `[attr$=val]` | `{ type: 'attribute', name: 'attr', action: 'end', value: 'val', ignoreCase: false }`    |
| `child`          | -                                       | `>`           | `{ type: 'child' }`                                                                      |
| `parent`         | -                                       | `<`           | `{ type: 'parent' }`                                                                     |
| `sibling`        | -                                       | `~`           | `{ type: 'sibling' }`                                                                    |
| `adjacent`       | -                                       | `+`           | `{ type: 'adjacent' }`                                                                   |
| `descendant`     | -                                       |               | `{ type: 'descendant' }`                                                                 |

**Options:**

-   `lowerCaseTags`: When false, tag names will not be lowercased. Defaults to `true`.
-   `lowerCaseAttributeNames`: When false, attribute names will not be lowercased. Defaults to `true`.
-   `xmlMode`: When `true`, `xmlMode` implies both `lowerCaseTags` and `lowerCaseAttributeNames` are set to `false`.

**`CSSwhat.stringify(selector)` - Turns `selector` back into a string.**

---

License: BSD-2-Clause

## Security contact information

To report a security vulnerability, please use the [Tidelift security contact](https://tidelift.com/security).
Tidelift will coordinate the fix and disclosure.

## `css-what` for enterprise

Available as part of the Tidelift Subscription

The maintainers of `css-what` and thousands of other packages are working with Tidelift to deliver commercial support and maintenance for the open source dependencies you use to build your applications. Save time, reduce risk, and improve code health, while paying the maintainers of the exact dependencies you use. [Learn more.](https://tidelift.com/subscription/pkg/npm-css-what?utm_source=npm-css-what&utm_medium=referral&utm_campaign=enterprise&utm_term=repo)
