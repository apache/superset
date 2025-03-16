import { MenuObjectProps } from 'src/types/bootstrapTypes';
import { t } from '@superset-ui/core';
import { REQUEST_PAGE_LIST_URL, TEAM_PAGE_LIST_URL } from '../consts';

export const onboardingMenuAdminItems: () => MenuObjectProps[] = () => [
  {
    label: t('Requests'),
    name: 'requests',
    url: REQUEST_PAGE_LIST_URL,
  },
  {
    label: t('Teams'),
    name: 'teams',
    url: TEAM_PAGE_LIST_URL,
  },
];
