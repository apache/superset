# href-no-hash

Enforce an anchor element's href prop value is not just #. You should use something more descriptive, or use a button instead.

## Rule details

This rule takes one optional object argument of type object:

```json
{
    "rules": {
        "jsx-a11y/href-no-hash": [ 2, {
            "components": [ "Link" ],
            "specialLink": [ "hrefLeft", "hrefRight" ]
          }],
    }
}
```

For the `components` option, these strings determine which JSX elements (**always including** `<a>`) should be checked for the props designated in the `specialLink` options (**always including** `href`). This is a good use case when you have a wrapper component that simply renders an `a` element (like in React):

```js
// Link.js
const Link = props => <a {...props}>A link</a>;

...

// NavBar.js (for example)
...
return (
  <nav>
    <Link href="/home" />
  </nav>
);
```


### Succeed
```jsx
<a href="https://github.com" />
<a href="#section" />
<a href="foo" />
<a href={undefined} /> // This check will pass, but WTF?
```

### Fail
```jsx
<a href="#" />
<a href={"#"} />
<a href={`#`} />
```
