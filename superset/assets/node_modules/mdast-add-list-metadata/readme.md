# mdast-add-list-metadata

Takes a markdown AST ([MDAST](https://github.com/syntax-tree/mdast)) and adds more metadata on `list` and `listItem` nodes, such as the depth of nesting of a list, the index of each list item, and whether list items are ordered or unordered. Mutates the given AST.

## Installation

```sh
npm install mdast-add-list-metadata
```

## Usage

```js
// ...
var addListMetadata = require('mdast-add-list-metadata');

unified()
  .use(parse)
  .use(addListMetadata)
// ...
```

Markdown document:

```
# Title

- First
- Second
  - a
- Third
```

Input AST:

```
root[2] (1:1-8:1, 0-41)
├─ heading[1] (2:1-2:8, 1-8) [depth=1]
│  └─ text: "Title" (2:3-2:8, 3-8)
└─ list[3] (4:1-7:8, 10-40) [ordered=false][loose=false]
   ├─ listItem[1] (4:1-4:8, 10-17) [loose=false]
   │  └─ paragraph[1] (4:3-4:8, 12-17)
   │     └─ text: "First" (4:3-4:8, 12-17)
   ├─ listItem[2] (5:1-6:6, 18-32) [loose=false]
   │  ├─ paragraph[1] (5:3-5:9, 20-26)
   │  │  └─ text: "Second" (5:3-5:9, 20-26)
   │  └─ list[1] (6:3-6:6, 29-32) [ordered=false][loose=false]
   │     └─ listItem[1] (6:3-6:6, 29-32) [loose=false]
   │        └─ paragraph[1] (6:5-6:6, 31-32)
   │           └─ text: "a" (6:5-6:6, 31-32)
   └─ listItem[1] (7:1-7:8, 33-40) [loose=false]
      └─ paragraph[1] (7:3-7:8, 35-40)
         └─ text: "Third" (7:3-7:8, 35-40)
```

Output AST:

```
root[2] (1:1-8:1, 0-41)
├─ heading[1] (2:1-2:8, 1-8) [depth=1]
│  └─ text: "Title" (2:3-2:8, 3-8)
└─ list[3] (4:1-7:8, 10-40) [ordered=false][loose=false][depth=0]
   ├─ listItem[1] (4:1-4:8, 10-17) [loose=false][index=0][ordered=false]
   │  └─ paragraph[1] (4:3-4:8, 12-17)
   │     └─ text: "First" (4:3-4:8, 12-17)
   ├─ listItem[2] (5:1-6:6, 18-32) [loose=false][index=1][ordered=false]
   │  ├─ paragraph[1] (5:3-5:9, 20-26)
   │  │  └─ text: "Second" (5:3-5:9, 20-26)
   │  └─ list[1] (6:3-6:6, 29-32) [ordered=false][loose=false][depth=1]
   │     └─ listItem[1] (6:3-6:6, 29-32) [loose=false][index=0][ordered=false]
   │        └─ paragraph[1] (6:5-6:6, 31-32)
   │           └─ text: "a" (6:5-6:6, 31-32)
   └─ listItem[1] (7:1-7:8, 33-40) [loose=false][index=2][ordered=false]
      └─ paragraph[1] (7:3-7:8, 35-40)
         └─ text: "Third" (7:3-7:8, 35-40)
```

## License

[MIT](LICENSE)