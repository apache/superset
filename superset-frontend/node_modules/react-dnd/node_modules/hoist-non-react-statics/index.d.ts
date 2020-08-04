import * as React from 'react';

declare function hoistNonReactStatics<Own, Custom>(
  TargetComponent: React.ComponentType<Own>,
  SourceComponent: React.ComponentType<Own & Custom>,
  customStatic?: any): React.ComponentType<Own>;

export default hoistNonReactStatics
