react-error-boundary
====================

**A simple, reusable React error boundary component for React 16+.**

[![NPM registry](https://img.shields.io/npm/v/react-error-boundary.svg?style=for-the-badge)](https://yarnpkg.com/en/package/react-error-boundary)
[![NPM license](https://img.shields.io/npm/l/react-error-boundary.svg?style=for-the-badge)](LICENSE)

React [v16](https://reactjs.org/blog/2017/09/26/react-v16.0.html) introduced the concept of [“error boundaries”](https://reactjs.org/docs/error-boundaries.html).

This component provides a simple and reusable wrapper that you can use to wrap around your components. Any rendering errors in your components hierarchy can then be gracefully handled.

# Usage

The simplest way to use `<ErrorBoundary>` is to wrap it around any component that may throw an error.
This will handle errors thrown by that component and its descendants too.

```jsx
import ErrorBoundary from 'react-error-boundary';

<ErrorBoundary>
  <ComponentThatMayError />
</ErrorBoundary>
```

You can react to errors (e.g. for logging) by providing an `onError` callback:

```jsx
import ErrorBoundary from 'react-error-boundary';

const myErrorHandler = (error: Error, componentStack: string) => {
  // Do something with the error
  // E.g. log to an error logging client here
};

<ErrorBoundary onError={myErrorHandler}>
  <ComponentThatMayError />
</ErrorBoundary>
```

You can also customize the fallback component’s appearance:

```jsx
import { ErrorBoundary } from 'react-error-boundary';

const MyFallbackComponent = ({ componentStack, error }) => (
  <div>
    <p><strong>Oops! An error occured!</strong></p>
    <p>Here’s what we know…</p>
    <p><strong>Error:</strong> {error.toString()}</p>
    <p><strong>Stacktrace:</strong> {componentStack}</p>
  </div>
);

<ErrorBoundary FallbackComponent={MyFallbackComponent}>
  <ComponentThatMayError />
</ErrorBoundary>
```

You can also use it as a [higher-order component](https://reactjs.org/docs/higher-order-components.html):

```jsx
import { ErrorBoundaryFallbackComponent, withErrorBoundary } from 'react-error-boundary';

const ComponentWithErrorBoundary = withErrorBoundary(
  ComponentThatMayError,
  ErrorBoundaryFallbackComponent, // Or pass in your own fallback component
  onErrorHandler: (error, componentStack) => {
    // Do something with the error
    // E.g. log to an error logging client here
  },
);

<ComponentWithErrorBoundary />
```
