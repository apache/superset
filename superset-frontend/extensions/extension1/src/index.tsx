import React from 'react';
import { core } from '@apache-superset/types';
import Component from './Component';

export const activate = () => {
  core.registerView('extension1.component', <Component />);
  console.log('Extension 1 activated');
};

export const deactivate = () => {
  console.log('Extension 1 deactivated');
};
