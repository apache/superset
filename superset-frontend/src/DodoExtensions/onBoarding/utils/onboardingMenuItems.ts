import { MenuObjectProps } from 'src/types/bootstrapTypes';
import { t } from '@superset-ui/core';

export const onboardingMenuItems: () => MenuObjectProps[] = () => [
  {
    label: t('Requests'),
    name: 'requests',
    url: '/',
  },
  {
    label: t('Teams'),
    name: 'teams',
    url: '/',
  },
  {
    label: t('Tags'),
    name: 'tags',
    url: '/superset/tags/',
  },
];
