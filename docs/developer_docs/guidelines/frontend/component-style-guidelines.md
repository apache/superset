---
title: Component Style Guidelines and Best Practices
sidebar_position: 2
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

# Component Style Guidelines and Best Practices

This documentation illustrates how we approach component development in Superset and provides examples to help you in writing new components or updating existing ones by following our community-approved standards.

This guide is intended primarily for reusable components. Whenever possible, all new components should be designed with reusability in mind.

## General Guidelines

- We use [Ant Design](https://ant.design/) as our component library. Do not build a new component if Ant Design provides one but rather instead extend or customize what the library provides
- Always style your component using Emotion and always prefer the theme variables whenever applicable. See: [Emotion Styling Guidelines and Best Practices](./emotion-styling-guidelines)
- All components should be made to be reusable whenever possible
- All components should follow the structure and best practices as detailed below

### Directory and component structure

```
superset-frontend/src/components
   {ComponentName}/
      index.tsx
      {ComponentName}.test.tsx
      {ComponentName}.stories.tsx
```

**Components root directory:** Components that are meant to be re-used across different parts of the application should go in the `superset-frontend/src/components` directory. Components that are meant to be specific for a single part of the application should be located in the nearest directory where the component is used, for example, `superset-frontend/src/Explore/components`

**Exporting the component:** All components within the `superset-frontend/src/components` directory should be exported from `superset-frontend/src/components/index.ts` to facilitate their imports by other components

**Component directory name:** Use `PascalCase` for the component directory name

**Storybook:** Components should come with a storybook file whenever applicable, with the following naming convention `\{ComponentName\}.stories.tsx`. More details about Storybook below

**Unit and end-to-end tests:** All components should come with unit tests using Jest and React Testing Library. The file name should follow this naming convention `\{ComponentName\}.test.tsx`. Read the [Testing Guidelines and Best Practices](../../testing/testing-guidelines) for more details

**Reference naming:** Use `PascalCase` for React components and `camelCase` for component instances

**BAD:**
```jsx
import mainNav from './MainNav';
```

**GOOD:**
```jsx
import MainNav from './MainNav';
```

**BAD:**
```jsx
const NavItem = <MainNav />;
```

**GOOD:**
```jsx
const navItem = <MainNav />;
```

**Component naming:** Use the file name as the component name

**BAD:**
```jsx
import MainNav from './MainNav/index';
```

**GOOD:**
```jsx
import MainNav from './MainNav';
```

**Props naming:** Do not use DOM related props for different purposes

**BAD:**
```jsx
<MainNav style="big" />
```

**GOOD:**
```jsx
<MainNav variant="big" />
```

**Importing dependencies:** Only import what you need

**BAD:**
```jsx
import * as React from "react";
```

**GOOD:**
```jsx
import React, { useState } from "react";
```

**Default VS named exports:** As recommended by [TypeScript](https://www.typescriptlang.org/docs/handbook/modules.html), "If a module's primary purpose is to house one specific export, then you should consider exporting it as a default export. This makes both importing and actually using the import a little easier". If you're exporting multiple objects, use named exports instead.

_As a default export_
```jsx
import MainNav from './MainNav';
```

_As a named export_
```jsx
import { MainNav, SecondaryNav } from './Navbars';
```

**ARIA roles:** Always make sure you are writing accessible components by using the official [ARIA roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques)

## Use TypeScript

All components should be written in TypeScript and their extensions should be `.ts` or `.tsx`

### type vs interface

Validate all props with the correct types. This replaces the need for a run-time validation as provided by the prop-types library.

```tsx
type HeadingProps = {
  param: string;
}

export default function Heading({ children }: HeadingProps) {
  return <h2>{children}</h2>
}
```

Use `type` for your component props and state. Use `interface` when you want to enable _declaration merging_.

### Define default values for non-required props

In order to improve the readability of your code and reduce assumptions, always add default values for non required props, when applicable, for example:

```tsx
const applyDiscount = (price: number, discount = 0.05) => price * (1 - discount);
```

## Functional components and Hooks

We prefer functional components and the usage of hooks over class components.

### useState

Always explicitly declare the type unless the type can easily be assumed by the declaration.

```tsx
const [customer, setCustomer] = useState<ICustomer | null>(null);
```

### useReducer

Always prefer `useReducer` over `useState` when your state has complex logics.

### useMemo and useCallback

Always memoize when your components take functions or complex objects as props to avoid unnecessary rerenders.

### Custom hooks

All custom hooks should be located in the directory `/src/hooks`. Before creating a new custom hook, make sure that is not available in the existing custom hooks.

## Storybook

Each component should come with its dedicated storybook file.

**One component per story:** Each storybook file should only contain one component unless substantially different variants are required

**Component variants:** If the component behavior is substantially different when certain props are used, it is best to separate the story into different types. See the `superset-frontend/src/components/Select/Select.stories.tsx` as an example.

**Isolated state:** The storybook should show how the component works in an isolated state and with as few dependencies as possible

**Use args:** It should be possible to test the component with every variant of the available props. We recommend using [args](https://storybook.js.org/docs/react/writing-stories/args)
