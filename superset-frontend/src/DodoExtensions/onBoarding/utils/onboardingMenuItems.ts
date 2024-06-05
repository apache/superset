import { MenuObjectProps } from 'src/types/bootstrapTypes';

export const onboardingMenuItems: () => MenuObjectProps[] = () => [
  {
    label: 'Заявки',
    name: 'request',
    url: '/',
  },
  {
    label: 'Команды',
    name: 'team',
    url: '/',
  },
  {
    label: 'Тэги',
    name: 'tag',
    url: '/superset/tags/',
  },
];
