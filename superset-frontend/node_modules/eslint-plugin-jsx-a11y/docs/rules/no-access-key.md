# no-access-key

Enforce no accessKey prop on element. Access keys are HTML elements that allow web developers to assign keyboard shortcuts to elements. Inconsistencies between keyboard shortcuts and keyboard commands used by screenreader and keyboard only users create accessibility complications so to avoid complications, access keys should not be used.

## Rule details

This rule takes no arguments.

### Succeed
```jsx
<div />
```

### Fail
```jsx
<div accessKey="h" />
```