interface TabsDataProps {
  label: string;
  icon?: string;
}

interface UserDataProps {
  image: string
}

interface DvtNavbarTabsDataProps {
  pathname: string;
  data: TabsDataProps[];
}

export const UserData: UserDataProps[] = [
  {
    image: 'https://s3-alpha-sig.figma.com/img/b367/a97e/b3452351a5be6194229715c7cb6da622?Expires=1702252800&Signature=KEpNfEpqoD1WcoinBiGaLTMNU0ZYjlHnJmCgOakjRhMMWwn8iHVMw~CNAEDGCcTfl8lmn9dFKq5DFeqEPisgIGSGo02ykcyI5HZ4D35kqJK7HayItECqzKDtHyu~Fp~U0E06kwiG00xzWlvgsvN5n4Kosq~5i3IZLIQe7D7vRWU0MLKlVgTCaDeq6kvZSRFAUXPpYJ37TiM6s83rjJpFRO1A1yHO7MIn7CvZrh4WwdKbhBoqDu5WPjJ~jx45GMMQYCi6XjVdA3LZMzTIPeLIr206h7nQzQM0giDm5q6B8GvvNpxeITuQkvZARsyLVVvU4RY3n1-CemXBVPbFotFT8g__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4',
  }
]

export const DvtNavbarTabsData: DvtNavbarTabsDataProps[] = [
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
