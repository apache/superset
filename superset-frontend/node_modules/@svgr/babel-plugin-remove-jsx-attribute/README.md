# @svgr/babel-plugin-remove-jsx-attribute

## Install

```
npm install --save-dev @svgr/babel-plugin-remove-jsx-attribute
```

## Usage

**.babelrc**

```json
{
  "plugins": [
    [
      "@svgr/babel-plugin-remove-jsx-attribute",
      {
        "elements": ["svg"],
        "attributes": ["width", "height"]
      }
    ]
  ]
}
```

## License

MIT
