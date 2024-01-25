import { t } from '@superset-ui/core';

export interface TabsDataProps {
  label: string;
  icon?: string;
}

interface UserDataProps {
  image: string;
}

interface DvtNavbarTabsDataProps {
  pathname: string;
  data: TabsDataProps[];
}

export const UserData: UserDataProps = {
  image:
    'https://e7.pngegg.com/pngimages/799/987/png-clipart-computer-icons-avatar-icon-design-avatar-heroes-computer-wallpaper-thumbnail.png',
};

export const DvtNavbarTabsData: DvtNavbarTabsDataProps[] = [
  {
    pathname: '/alert/list/',
    data: [
      {
        label: t('Alerts'),
      },
      {
        label: t('Reports'),
      },
    ],
  },
  {
    pathname: '/superset/sqllab/history/',
    data: [
      {
        label: t('Saved Queries'),
      },
      {
        label: t('Query History'),
      },
    ],
  },
  {
    pathname: '/superset/sqllab/',
    data: [
      {
        label: t('Saved'),
        icon: 'caret_down',
      },
      {
        label: t('Copy Link'),
        icon: 'link',
      },
    ],
  },
];

export const WithNavbarBottom: string[] = [
  // '/superset/welcome/',
  '/alert/list/',
  '/superset/sqllab/history/',
  '/superset/sqllab/',
  '/chart/add',
];
