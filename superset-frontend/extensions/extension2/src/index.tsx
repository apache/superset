import React from 'react';
import { core } from '@apache-superset/types';
import ExtensionExample from './Example';

export const activate = () => {
  core.registerView('extension2.example', <ExtensionExample />);
  console.log('Extension 2 activated');
};

export const deactivate = () => {
  console.log('Extension 2 deactivated');
};
