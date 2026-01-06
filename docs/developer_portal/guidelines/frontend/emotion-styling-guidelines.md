---
title: Emotion Styling Guidelines and Best Practices
sidebar_position: 3
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Emotion Styling Guidelines and Best Practices

## Emotion Styling Guidelines

### DO these things:

- **DO** use `styled` when you want to include additional (nested) class selectors in your styles
- **DO** use `styled` components when you intend to export a styled component for re-use elsewhere
- **DO** use `css` when you want to amend/merge sets of styles compositionally
- **DO** use `css` when you're making a small, or single-use set of styles for a component
- **DO** move your style definitions from direct usage in the `css` prop to an external variable when they get long
- **DO** prefer tagged template literals (`css={css`...`}`) over style objects wherever possible for maximum style portability/consistency (note: typescript support may be diminished, but IDE plugins like [this](https://marketplace.visualstudio.com/items?itemName=jpoissonnier.vscode-styled-components) make life easy)
- **DO** use `useTheme` to get theme variables. `withTheme` should be only used for wrapping legacy Class-based components.

### DON'T do these things:

- **DON'T** use `styled` for small, single-use style tweaks that would be easier to read/review if they were inline
- **DON'T** export incomplete AntD components (make sure all their compound components are exported)

## Emotion Tips and Strategies

The first thing to consider when adding styles to an element is how much you think a style might be reusable in other areas of Superset. Always err on the side of reusability here. Nobody wants to chase styling inconsistencies, or try to debug little endless overrides scattered around the codebase. The more we can consolidate, the less will have to be figured out by those who follow. Reduce, reuse, recycle.

## When to use `css` or `styled`

In short, either works for just about any use case! And you'll see them used somewhat interchangeably in the existing codebase. But we need a way to weigh it when we encounter the choice, so here's one way to think about it:

A good use of `styled` syntax if you want to re-use a styled component. In other words, if you wanted to export flavors of a component for use, like so:

```jsx
const StatusThing = styled.div`
  padding: 10px;
  border-radius: 10px;
`;

export const InfoThing = styled(StatusThing)`
  background: blue;
  &::before {
    content: "ℹ️";
  }
`;

export const WarningThing = styled(StatusThing)`
  background: orange;
  &::before {
    content: "⚠️";
  }
`;

export const TerribleThing = styled(StatusThing)`
  background: red;
  &::before {
    content: "🔥";
  }
`;
```

You can also use `styled` when you're building a bigger component, and just want to have some custom bits for internal use in your JSX. For example:

```jsx
const SeparatorOnlyUsedInThisComponent = styled.hr`
  height: 12px;
  border: 0;
  box-shadow: inset 0 12px 12px -12px rgba(0, 0, 0, 0.5);
`;

function SuperComplicatedComponent(props) {
  return (
    <>
      Daily standup for {user.name}!
      <SeparatorOnlyUsedInThisComponent />
      <h2>Yesterday:</h2>
      // spit out a list of accomplishments
      <SeparatorOnlyUsedInThisComponent />
      <h2>Today:</h2>
      // spit out a list of plans
      <SeparatorOnlyUsedInThisComponent />
      <h2>Tomorrow:</h2>
      // spit out a list of goals
    </>
  );
}
```

The `css` prop, in reality, shares all the same styling capabilities as `styled` but it does have some particular use cases that jump out as sensible. For example, if you just want to style one element in your component, you could add the styles inline like so:

```jsx
function SomeFanciness(props) {
  return (
    <>
      Here's an awesome report card for {user.name}!
      <div
        css={css`
          box-shadow: 5px 5px 10px #ccc;
          border-radius: 10px;
        `}
      >
        <h2>Yesterday:</h2>
        // ...some stuff
        <h2>Today:</h2>
        // ...some stuff
        <h2>Tomorrow:</h2>
        // ...some stuff
      </div>
    </>
  );
}
```

You can also define the styles as a variable, external to your JSX. This is handy if the styles get long and you just want it out of the way. This is also handy if you want to apply the same styles to disparate element types, kind of like you might use a CSS class on varied elements. Here's a trumped up example:

```jsx
function FakeGlobalNav(props) {
  const menuItemStyles = css`
    display: block;
    border-bottom: 1px solid cadetblue;
    font-family: "Comic Sans", cursive;
  `;

  return (
    <Nav>
      <a css={menuItemStyles} href="#">One link</a>
      <Link css={menuItemStyles} to={url}>Another link</Link>
      <div css={menuItemStyles} onClick={() => alert('clicked')}>Another link</div>
    </Nav>
  );
}
```

## CSS tips and tricks

### `css` lets you write actual CSS

By default the `css` prop uses the object syntax with JS style definitions, like so:

```jsx
<div css={{
  borderRadius: 10,
  marginTop: 10,
  backgroundColor: '#00FF00'
}}>Howdy</div>
```

But you can use the `css` interpolator as well to get away from icky JS styling syntax. Doesn't this look cleaner?

```jsx
<div css={css`
  border-radius: 10px;
  margin-top: 10px;
  background-color: #00FF00;
`}>Howdy</div>
```

You might say "whatever… I can read and write JS syntax just fine." Well, that's great. But… let's say you're migrating in some of our legacy LESS styles… now it's copy/paste! Or if you want to migrate to or from `styled` syntax… also copy/paste!

### You can combine `css` definitions with array syntax

You can use multiple groupings of styles with the `css` interpolator, and combine/override them in array syntax, like so:

```jsx
function AnotherSillyExample(props) {
  const shadowedCard = css`
    box-shadow: 2px 2px 4px #999;
    padding: 4px;
  `;
  const infoCard = css`
    background-color: #33f;
    border-radius: 4px;
  `;
  const overrideInfoCard = css`
    background-color: #f33;
  `;
  return (
    <div className="App">
      Combining two classes:
      <div css={[shadowedCard, infoCard]}>Hello</div>
      Combining again, but now with overrides:
      <div css={[shadowedCard, infoCard, overrideInfoCard]}>Hello</div>
    </div>
  );
}
```

### Style variations with props

You can give any component a custom prop, and reference that prop in your component styles, effectively using the prop to turn on a "flavor" of that component.

For example, let's make a styled component that acts as a card. Of course, this could be done with any AntD component, or any component at all. But we'll do this with a humble `div` to illustrate the point:

```jsx
const SuperCard = styled.div`
  ${({ theme, cutout }) => `
    padding: ${theme.gridUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    box-shadow: 10px 5px 10px #ccc ${cutout && 'inset'};
    border: 1px solid ${cutout ? 'transparent' : theme.colors.secondary.light3};
  `}
`;
```

Then just use the component as `<SuperCard>Some content</SuperCard>` or with the (potentially dynamic) prop: `<SuperCard cutout>Some content</SuperCard>`

## Styled component tips

### No need to use `theme` the hard way

It's very tempting (and commonly done) to use the `theme` prop inline in the template literal like so:

```jsx
const SomeStyledThing = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light3};
`;
```

Instead, you can make things a little easier to read/type by writing it like so:

```jsx
const SomeStyledThing = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 2}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colors.secondary.light3};
  `}
`;
```

## Extend an AntD component with custom styling

As mentioned, you want to keep your styling as close to the root of your component system as possible, to minimize repetitive styling/overrides, and err on the side of reusability. In some cases, that means you'll want to globally tweak one of our core components to match our design system. In Superset, that's Ant Design (AntD).

AntD uses a cool trick called compound components. For example, the `Menu` component also lets you use `Menu.Item`, `Menu.SubMenu`, `Menu.ItemGroup`, and `Menu.Divider`.

### The `Object.assign` trick

Let's say you want to override an AntD component called `Foo`, and have `Foo.Bar` display some custom CSS for the `Bar` compound component. You can do it effectively like so:

```jsx
import {
  Foo as AntdFoo,
} from 'antd';

export const StyledBar = styled(AntdFoo.Bar)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

export const Foo = Object.assign(AntdFoo, {
  Bar: StyledBar,
});
```

You can then import this customized `Foo` and use `Foo.Bar` as expected. You should probably save your creation in `src/components` for maximum reusability, and add a Storybook entry so future engineers can view your creation, and designers can better understand how it fits the Superset Design System.
