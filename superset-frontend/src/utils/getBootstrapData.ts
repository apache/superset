// DODO was here

import { BootstrapData } from 'src/types/bootstrapTypes';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import { redefineLocale } from './bootstrapHelpers'; // DODO added 44611022

export default function getBootstrapData(): BootstrapData {
  const appContainer = document.getElementById('app');
  const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
  // DODO added 44611022
  const tempBootstrapData = dataBootstrap
    ? JSON.parse(dataBootstrap)
    : DEFAULT_BOOTSTRAP_DATA;

  // DODO changed 44611022
  return redefineLocale(tempBootstrapData);
}
