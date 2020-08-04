# @svgr/babel-plugin-add-jsx-attribute

## Install

```
npm install --save-dev @svgr/babel-plugin-add-jsx-attribute
```

## Usage

**.babelrc**

```json
{
  "plugins": [
    [
      "@svgr/babel-plugin-add-jsx-attribute",
      {
        "elements": ["svg"],
        "attributes": [
          {
            "name": "width",
            "value": "200",
            "spread": false,
            "literal": false,
            "position": "end"
          }
        ]
      }
    ]
  ]
}
```

## License

MIT
