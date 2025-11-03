---
title: Emotion Styling Guidelines and Best Practices
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

# Emotion Styling Guidelines and Best Practices

## Emotion Styling Guidelines

### DO these things:

- **DO** use `styled` when you want to include additional (nested) class selectors in your styles
- **DO** use `styled` components when you intend to export a styled component for re-use elsewhere
- **DO** use `css` when you want to amend/merge sets of styles compositionally
- **DO** use `css` when you're making a small, or single-use set of styles for a component
- **DO** move your style definitions from direct usage in the `css` prop to an external variable when they get long
- **DO** prefer tagged template literals (`css={css\`...\`}`) over style objects wherever possible for maximum style portability/consistency
- **DO** use `useTheme` to get theme variables

### DON'T do these things:

- **DON'T** use `styled` for small, single-use style tweaks that would be easier to read/review if they were inline
- **DON'T** export incomplete Ant Design components

## When to use `css` or `styled`

### Use `css` for:

1. **Small, single-use styles**
```tsx
import { css } from '@emotion/react';

const MyComponent = () => (
  <div
    css={css`
      margin: 8px;
      padding: 16px;
    `}
  >
    Content
  </div>
);
```

2. **Composing styles**
```tsx
const baseStyles = css`
  padding: 16px;
  border-radius: 4px;
`;

const primaryStyles = css`
  ${baseStyles}
  background-color: blue;
  color: white;
`;

const secondaryStyles = css`
  ${baseStyles}
  background-color: gray;
  color: black;
`;
```

3. **Conditional styling**
```tsx
const MyComponent = ({ isActive }: { isActive: boolean }) => (
  <div
    css={[
      baseStyles,
      isActive && activeStyles,
    ]}
  >
    Content
  </div>
);
```

### Use `styled` for:

1. **Reusable components**
```tsx
import styled from '@emotion/styled';

const StyledButton = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryDark};
  }
`;
```

2. **Components with complex nested selectors**
```tsx
const StyledCard = styled.div`
  padding: 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};

  .card-header {
    font-weight: bold;
    margin-bottom: 8px;
  }

  .card-content {
    color: ${({ theme }) => theme.colors.text};

    p {
      margin-bottom: 12px;
    }
  }
`;
```

3. **Extending Ant Design components**
```tsx
import { Button } from 'antd';
import styled from '@emotion/styled';

const CustomButton = styled(Button)`
  border-radius: 8px;
  font-weight: 600;

  &.ant-btn-primary {
    background: linear-gradient(45deg, #1890ff, #722ed1);
  }
`;
```

## Using Theme Variables

Always use theme variables for consistent styling:

```tsx
import { useTheme } from '@emotion/react';

const MyComponent = () => {
  const theme = useTheme();

  return (
    <div
      css={css`
        background-color: ${theme.colors.grayscale.light5};
        color: ${theme.colors.grayscale.dark2};
        padding: ${theme.gridUnit * 4}px;
        border-radius: ${theme.borderRadius}px;
      `}
    >
      Content
    </div>
  );
};
```

## Common Patterns

### Responsive Design
```tsx
const ResponsiveContainer = styled.div`
  display: flex;
  flex-direction: column;

  ${({ theme }) => theme.breakpoints.up('md')} {
    flex-direction: row;
  }
`;
```

### Animation
```tsx
const FadeInComponent = styled.div`
  opacity: 0;
  transition: opacity 0.3s ease-in-out;

  &.visible {
    opacity: 1;
  }
`;
```

### Conditional Props
```tsx
interface StyledDivProps {
  isHighlighted?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const StyledDiv = styled.div<StyledDivProps>`
  padding: 16px;
  background-color: ${({ isHighlighted, theme }) =>
    isHighlighted ? theme.colors.primary : theme.colors.grayscale.light5};

  ${({ size }) => {
    switch (size) {
      case 'small':
        return css`font-size: 12px;`;
      case 'large':
        return css`font-size: 18px;`;
      default:
        return css`font-size: 14px;`;
    }
  }}
`;
```

## Best Practices

### 1. Use Semantic CSS Properties
```tsx
// ✅ Good - semantic property names
const Header = styled.h1`
  font-size: ${({ theme }) => theme.typography.sizes.xl};
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

// ❌ Avoid - magic numbers
const Header = styled.h1`
  font-size: 24px;
  margin-bottom: 16px;
`;
```

### 2. Group Related Styles
```tsx
// ✅ Good - grouped styles
const Card = styled.div`
  /* Layout */
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.gridUnit * 4}px;

  /* Appearance */
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;

  /* Typography */
  font-family: ${({ theme }) => theme.typography.families.sansSerif};
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;
```

### 3. Extract Complex Styles
```tsx
// ✅ Good - extract complex styles to variables
const complexGradient = css`
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.primary} 0%,
    ${({ theme }) => theme.colors.secondary} 100%
  );
`;

const GradientButton = styled.button`
  ${complexGradient}
  padding: 12px 24px;
  border: none;
  color: white;
`;
```

### 4. Avoid Deep Nesting
```tsx
// ✅ Good - shallow nesting
const Navigation = styled.nav`
  .nav-item {
    padding: 8px 16px;
  }

  .nav-link {
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
  }
`;

// ❌ Avoid - deep nesting
const Navigation = styled.nav`
  ul {
    li {
      a {
        span {
          color: blue; /* Too nested */
        }
      }
    }
  }
`;
```

## Performance Tips

### 1. Avoid Inline Functions in CSS
```tsx
// ✅ Good - external function
const getBackgroundColor = (isActive: boolean, theme: any) =>
  isActive ? theme.colors.primary : theme.colors.secondary;

const Button = styled.button<{ isActive: boolean }>`
  background-color: ${({ isActive, theme }) => getBackgroundColor(isActive, theme)};
`;

// ❌ Avoid - inline function (creates new function on each render)
const Button = styled.button<{ isActive: boolean }>`
  background-color: ${({ isActive, theme }) =>
    isActive ? theme.colors.primary : theme.colors.secondary};
`;
```

### 2. Use CSS Objects for Dynamic Styles
```tsx
// For highly dynamic styles, consider CSS objects
const dynamicStyles = (props: Props) => ({
  backgroundColor: props.color,
  fontSize: `${props.size}px`,
  // ... other dynamic properties
});

const DynamicComponent = (props: Props) => (
  <div css={dynamicStyles(props)}>
    Content
  </div>
);
```
