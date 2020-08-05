import { shallow as enzymeShallow, mount as enzymeMount } from 'enzyme';
import { supersetTheme, ThemeProvider } from '@superset-ui/style';
import { ReactElement } from 'react';

type optionsType = {
  wrappingComponentProps?: any;
  wrappingComponent?: ReactElement;
  context?: any,
}

export function styledMount(
  component: ReactElement,
  options: optionsType = {},
) {
  return enzymeMount(component, {
    ...options,
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: supersetTheme,
      ...options?.wrappingComponentProps,
    },
  });
}

export function styledShallow(
  component: ReactElement,
  options: optionsType = {},
) {
  return enzymeShallow(component, {
    ...options,
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: {
      theme: supersetTheme,
      ...options?.wrappingComponentProps,
    },
  });
}