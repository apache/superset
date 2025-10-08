---
title: Testing Guidelines and Best Practices
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

# Testing Guidelines and Best Practices

We feel that tests are an important part of a feature and not an additional or optional effort. That's why we colocate test files with functionality and sometimes write tests upfront to help validate requirements and shape the API of our components. Every new component or file added should have an associated test file with the `.test` extension.

We use Jest, React Testing Library (RTL), and Cypress to write our unit, integration, and end-to-end tests. For each type, we have a set of best practices/tips described below:

## Jest

### Write simple, standalone tests

The importance of simplicity is often overlooked in test cases. Clear, dumb code should always be preferred over complex ones. The test cases should be pretty much standalone and should not involve any external logic if not absolutely necessary. That's because you want the corpus of the tests to be easy to read and understandable at first sight.

### Avoid nesting when you're testing

Avoid the use of `describe` blocks in favor of inlined tests. If your tests start to grow and you feel the need to group tests, prefer to break them into multiple test files. Check this awesome [article](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing) written by [Kent C. Dodds](https://kentcdodds.com/) about this topic.

### No warnings!

Your tests shouldn't trigger warnings. This is really common when testing async functionality. It's really difficult to read test results when we have a bunch of warnings.

## React Testing Library (RTL)

### Keep accessibility in mind when writing your tests

One of the most important points of RTL is accessibility and this is also a very important point for us. We should try our best to follow the RTL [Priority](https://testing-library.com/docs/queries/about/#priority) when querying for elements in our tests. `getByTestId` is not viewable by the user and should only be used when the element isn't accessible in any other way.

### Don't use `act` unnecessarily

`render` and `fireEvent` are already wrapped in `act`, so wrapping them in `act` again is a common mistake. Some solutions to the warnings related to async testing can be found in the RTL docs.

## Example Test Structure

```tsx
// MyComponent.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

// ✅ Good - Simple, standalone test
test('renders loading state initially', () => {
  render(<MyComponent />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

// ✅ Good - Tests user interaction
test('calls onSubmit when form is submitted', async () => {
  const user = userEvent.setup();
  const mockOnSubmit = jest.fn();

  render(<MyComponent onSubmit={mockOnSubmit} />);

  await user.type(screen.getByLabelText('Username'), 'testuser');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(mockOnSubmit).toHaveBeenCalledWith({ username: 'testuser' });
});

// ✅ Good - Tests async behavior
test('displays error message when API call fails', async () => {
  const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));
  global.fetch = mockFetch;

  render(<MyComponent />);

  await waitFor(() => {
    expect(screen.getByText('Error: API Error')).toBeInTheDocument();
  });
});
```

## Testing Best Practices

### Use appropriate queries in priority order

1. **Accessible to everyone**: `getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`
2. **Semantic queries**: `getByAltText`, `getByTitle`
3. **Test IDs**: `getByTestId` (last resort)

```tsx
// ✅ Good - using accessible queries
test('user can submit form', () => {
  render(<LoginForm />);

  const usernameInput = screen.getByLabelText('Username');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Log in' });

  // Test implementation
});

// ❌ Avoid - using test IDs when better options exist
test('user can submit form', () => {
  render(<LoginForm />);

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const submitButton = screen.getByTestId('submit-button');

  // Test implementation
});
```

### Test behavior, not implementation details

```tsx
// ✅ Good - tests what the user experiences
test('shows success message after successful form submission', async () => {
  render(<ContactForm />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

  await waitFor(() => {
    expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
  });
});

// ❌ Avoid - testing implementation details
test('calls setState when form is submitted', () => {
  const component = shallow(<ContactForm />);
  const instance = component.instance();
  const spy = jest.spyOn(instance, 'setState');

  instance.handleSubmit();
  expect(spy).toHaveBeenCalled();
});
```

### Mock external dependencies appropriately

```tsx
// Mock API calls
jest.mock('../api/userService', () => ({
  getUser: jest.fn(),
  createUser: jest.fn(),
}));

// Mock components that aren't relevant to the test
jest.mock('../Chart/Chart', () => {
  return function MockChart() {
    return <div data-testid="mock-chart">Chart Component</div>;
  };
});
```

## Async Testing Patterns

### Testing async operations

```tsx
test('loads and displays user data', async () => {
  const mockUser = { id: 1, name: 'John Doe' };
  const mockGetUser = jest.fn().mockResolvedValue(mockUser);

  render(<UserProfile getUserData={mockGetUser} />);

  // Wait for the async operation to complete
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  expect(mockGetUser).toHaveBeenCalledTimes(1);
});
```

### Testing loading states

```tsx
test('shows loading spinner while fetching data', async () => {
  const mockGetUser = jest.fn().mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, 100))
  );

  render(<UserProfile getUserData={mockGetUser} />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
```

## Component-Specific Testing

### Testing form components

```tsx
test('validates required fields', async () => {
  render(<RegistrationForm />);

  const submitButton = screen.getByRole('button', { name: 'Register' });
  await userEvent.click(submitButton);

  expect(screen.getByText('Username is required')).toBeInTheDocument();
  expect(screen.getByText('Email is required')).toBeInTheDocument();
});
```

### Testing modals and overlays

```tsx
test('opens and closes modal', async () => {
  render(<ModalContainer />);

  const openButton = screen.getByRole('button', { name: 'Open Modal' });
  await userEvent.click(openButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();

  const closeButton = screen.getByRole('button', { name: 'Close' });
  await userEvent.click(closeButton);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

### Testing with context providers

```tsx
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

test('applies theme colors correctly', () => {
  renderWithTheme(<ThemedButton />);

  const button = screen.getByRole('button');
  expect(button).toHaveStyle({
    backgroundColor: mockTheme.colors.primary,
  });
});
```

## Performance Testing

### Testing with large datasets

```tsx
test('handles large lists efficiently', () => {
  const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }));

  const { container } = render(<VirtualizedList items={largeDataset} />);

  // Should only render visible items
  const renderedItems = container.querySelectorAll('[data-testid="list-item"]');
  expect(renderedItems.length).toBeLessThan(100);
});
```

## Testing Accessibility

```tsx
test('is accessible to screen readers', () => {
  render(<AccessibleForm />);

  const form = screen.getByRole('form');
  const inputs = screen.getAllByRole('textbox');

  inputs.forEach(input => {
    expect(input).toHaveAttribute('aria-label');
  });

  expect(form).toHaveAttribute('aria-describedby');
});
```
