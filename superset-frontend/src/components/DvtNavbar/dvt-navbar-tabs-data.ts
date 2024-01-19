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
        label: 'Alerts',
      },
      {
        label: 'Reports',
      },
    ],
  },
  {
    pathname: '/superset/sqllab/history/',
    data: [
      {
        label: 'Saved Queries',
      },
      {
        label: 'Query History',
      },
    ],
  },
  {
    pathname: '/superset/sqllab/',
    data: [
      {
        label: 'Saved ',
        icon: 'caret_down',
      },
      {
        label: 'Copy Link',
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
