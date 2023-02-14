import { configure, supersetTheme } from '@superset-ui/core';
import { merge } from 'lodash';

import setupFormatters from 'src/setup/setupFormatters';
import { DODOPIZZA_THEME } from './constants';

configure();
setupFormatters();

export const theme = merge(supersetTheme, DODOPIZZA_THEME);
