// DODO was here

import { BootstrapData } from 'src/types/bootstrapTypes';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import { redefineLocale } from './bootstrapHelpers';

export default function getBootstrapData(): BootstrapData {
  const appContainer = document.getElementById('app');
  const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
  const tempBootstrapData = dataBootstrap
    ? JSON.parse(dataBootstrap)
    : DEFAULT_BOOTSTRAP_DATA;

  return redefineLocale(tempBootstrapData);
}
