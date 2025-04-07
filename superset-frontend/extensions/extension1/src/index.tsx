import React from 'react';
import { core } from '@apache-superset/types';
import Component from './Component';
import { formatDatabase } from './formatter';
import { Extension1API } from './publicAPI';

export const activate = () => {
  core.registerView('extension1.component', <Component />);
  return {
    formatDatabase,
  } as Extension1API;
};

export const deactivate = () => {
  console.log('Extension 1 deactivated');
};
