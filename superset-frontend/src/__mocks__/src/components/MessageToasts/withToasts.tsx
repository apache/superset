import { ComponentType } from 'react';

const withToasts = (WrappedComponent: ComponentType<any>) => {
  const WithToastsWrapper = (props: any) => <WrappedComponent {...props} />;
  WithToastsWrapper.displayName = `WithToasts(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithToastsWrapper;
};

export default withToasts;
