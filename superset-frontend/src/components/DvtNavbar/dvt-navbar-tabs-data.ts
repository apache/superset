interface TabsDataProps {
  label: string;
  icon?: string;
}

interface DvtNavbarTabsDataProps {
  pathname: string;
  data: TabsDataProps[];
}

const DvtNavbarTabsData: DvtNavbarTabsDataProps[] = [
  {
    pathname: '/superset/welcome/',
    data: [
      {
        label: 'All',
        icon: 'full',
      },
      {
        label: 'Mine',
        icon: 'minus',
      },
    ],
  },
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
];

export default DvtNavbarTabsData;
