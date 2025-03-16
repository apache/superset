import { UserFromEnum } from '../types';

export const getTeamName = (value: string | null, userFrom?: UserFromEnum) => {
  const v = value?.trim().toUpperCase() ?? '';

  if (userFrom === UserFromEnum.Franchisee) {
    return `FRANCHISEE ${v}`;
  }
  return v;
};
