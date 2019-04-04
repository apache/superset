# no-redundant-roles

Some HTML elements have native semantics that are implemented by the browser. This includes default/implicit ARIA roles. Setting an ARIA role that matches its default/implicit role is redundant since it is already set by the browser.

#### References
1. [w3](https://www.w3.org/TR/html5/dom.html#aria-role-attribute)

## Rule details

This rule takes no arguments.

### Succeed
```jsx
<div />
<button role="presentation" />
<MyComponent role="main" />
```

### Fail
```jsx
<button role="button" />
<img role="img" src="foo.jpg" />
```
