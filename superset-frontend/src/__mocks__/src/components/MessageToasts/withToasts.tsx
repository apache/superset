import React from 'react';

const withToasts = (WrappedComponent: React.ComponentType<any>) => {
  const WithToastsWrapper = (props: any) => {
    return <WrappedComponent {...props} />;
  };
  WithToastsWrapper.displayName = `WithToasts(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithToastsWrapper;
};

export default withToasts;