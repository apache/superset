import { t } from '../../locales';
import { SMALL_HEADER, MEDIUM_HEADER, LARGE_HEADER } from './constants';

export default [
  {
    value: SMALL_HEADER,
    label: t('Small'),
    className: 'header-style-option header-small',
  },
  {
    value: MEDIUM_HEADER,
    label: t('Medium'),
    className: 'header-style-option header-medium',
  },
  {
    value: LARGE_HEADER,
    label: t('Large'),
    className: 'header-style-option header-large',
  },
];
