# html-has-lang

<html> elements must have the lang prop.

#### References
1. [Deque University](https://dequeuniversity.com/rules/axe/1.1/html-lang)

## Rule details

This rule takes no arguments.

### Succeed
```jsx
<html lang="en">
<html lang="en-US">
<html lang={language}>
```

### Fail

```jsx
<html>
```
