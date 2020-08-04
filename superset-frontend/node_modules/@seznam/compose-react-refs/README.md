# Compose react refs

[![Build Status](https://travis-ci.org/seznam/compose-react-refs.svg?branch=master)](https://travis-ci.org/seznam/compose-react-refs)
[![npm](https://img.shields.io/npm/v/@seznam/compose-react-refs.svg)](https://www.npmjs.com/package/@seznam/compose-react-refs)
[![License](https://img.shields.io/npm/l/@seznam/compose-react-refs.svg)](LICENSE)
![npm type definitions](https://img.shields.io/npm/types/@seznam/compose-react-refs.svg)

A simple utility for composing two or more
[react refs](https://reactjs.org/docs/refs-and-the-dom.html) (ref objects and
callbacks are both supported and can be mixed) into a single callback ref. This
enables you to effectively
[set multiple refs on the same component/element](https://github.com/facebook/react/issues/13029).

This utility does not use
[react hooks](https://reactjs.org/docs/hooks-intro.html), therefore it can be
used in class components (and even outside of react world) safely.

## Installation

`compose-react-refs` is available as npm package, you can use `npm` to install
it:

```
npm install --save @seznam/compose-react-refs
```

## Usage

The following example shows usage in a functional component that composes an
external ref with its own ref it uses to focus the renderer `<input>` element:

```typescript jsx
import * as React from 'react'
import composeRefs from '@seznam/compose-react-refs'

export default React.forwardRef((props, externalRef) => {
  const myRef = React.useRef(null)
  
  React.useEffect(() => {
    myRef.current.focus()
  })

  // No need to worry about nulls and undefined refs here, they will be
  // filtered out automatically.
  return <input {...props} ref={composeRefs(myRef, externalRef)}/>
})
```

The `composeRefs` function allows combining any number of refs:

```typescript jsx
import * as React from 'react'
import composeRefs from '@seznam/compose-react-refs'

export default React.forwardRef((props, externalRef) => {
  const myRef = React.useRef(null)
  const otherRef = React.useRef(null)
  return <input {...props} ref={composeRefs(myRef, null, undefined, otherRef, props.extraRef, externalRef)}/>
})
```

The refs will be updated in the order in which they were provided to the
`composeRefs` function. The composed ref passed to react is cached (no need to
use [`useMemo`](https://reactjs.org/docs/hooks-reference.html#usememo) in your
code), improving performance and preventing
[unexpected ref updates](https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs).
