---
title: Component Style Guidelines and Best Practices
sidebar_position: 1
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

## Directory and component structure

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

**Storybook:** Components should come with a storybook file whenever applicable, with the following naming convention `{ComponentName}.stories.tsx`. More details about Storybook below

**Unit and end-to-end tests:** All components should come with unit tests using Jest and React Testing Library. The file name should follow this naming convention `{ComponentName}.test.tsx.` Read the [Testing Guidelines and Best Practices](./testing-guidelines) for more details about tests

## Component Development Best Practices

### Use TypeScript

All new components should be written in TypeScript. This helps catch errors early and provides better development experience with IDE support.

```tsx
interface ComponentProps {
  title: string;
  isVisible?: boolean;
  onClose?: () => void;
}

export const MyComponent: React.FC<ComponentProps> = ({
  title,
  isVisible = true,
  onClose
}) => {
  // Component implementation
};
```

### Prefer Functional Components

Use functional components with hooks instead of class components:

```tsx
// ✅ Good - Functional component with hooks
export const MyComponent: React.FC<Props> = ({ data }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Effect logic
  }, []);

  return <div>{/* Component JSX */}</div>;
};

// ❌ Avoid - Class component
class MyComponent extends React.Component {
  // Class implementation
}
```

### Follow Ant Design Patterns

Extend Ant Design components rather than building from scratch:

```tsx
import { Button } from 'antd';
import styled from '@emotion/styled';

const StyledButton = styled(Button)`
  // Custom styling using emotion
`;
```

### Reusability and Props Design

Design components with reusability in mind:

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const CustomButton: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  ...props
}) => {
  // Implementation
};
```

## Testing Components

Every component should include comprehensive tests:

```tsx
// MyComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

test('renders component with title', () => {
  render(<MyComponent title="Test Title" />);
  expect(screen.getByText('Test Title')).toBeInTheDocument();
});

test('calls onClose when close button is clicked', () => {
  const mockOnClose = jest.fn();
  render(<MyComponent title="Test" onClose={mockOnClose} />);

  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});
```

## Storybook Stories

Create stories for visual testing and documentation:

```tsx
// MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Default Component',
    isVisible: true,
  },
};

export const Hidden: Story = {
  args: {
    title: 'Hidden Component',
    isVisible: false,
  },
};
```

## Performance Considerations

### Use React.memo for Expensive Components

```tsx
import React, { memo } from 'react';

export const ExpensiveComponent = memo<Props>(({ data }) => {
  // Expensive rendering logic
  return <div>{/* Component content */}</div>;
});
```

### Optimize Re-renders

Use `useCallback` and `useMemo` appropriately:

```tsx
export const OptimizedComponent: React.FC<Props> = ({ items, onSelect }) => {
  const expensiveValue = useMemo(() => {
    return items.reduce((acc, item) => acc + item.value, 0);
  }, [items]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]);

  return <div>{/* Component content */}</div>;
};
```

## Accessibility

Ensure components are accessible:

```tsx
export const AccessibleButton: React.FC<Props> = ({ children, onClick }) => {
  return (
    <button
      type="button"
      aria-label="Descriptive label"
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

## Error Boundaries

For components that might fail, consider error boundaries:

```tsx
export const SafeComponent: React.FC<Props> = ({ children }) => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      {children}
    </ErrorBoundary>
  );
};
```
