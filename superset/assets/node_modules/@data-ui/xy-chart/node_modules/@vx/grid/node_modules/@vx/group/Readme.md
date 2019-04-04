# @vx/group

```
npm install --save @vx/group
```

A Group is a container for other objects. It lets you pass in a top and left margin and a classname.

Example usage:

```js
import { Group } from '@vx/group';
const myGroup = (
  <Group top={50} left={20}>
    /* Children here */
  </Group>
)
```

## Properties

|   Name    | Default |  Type  |                     Description                     |
|:--------- |:------- |:------ |:--------------------------------------------------- |
| top       | 0       | number | Margin on top                                       |
| left      | 0       | number | Margin on left                                      |
| className |         | string | The class name associated with the svg `g` element. |

## Source For Components
+ [`<Group />`](https://github.com/hshoff/vx/blob/master/packages/vx-group/src/index.js)
