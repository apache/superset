import { UserFromEnum } from '../types';

export const getTeamSlug = (value: string | null, userFrom?: UserFromEnum) => {
  const v = value?.trim().toLowerCase().replace(/ /g, '_') ?? '';

  if (userFrom === UserFromEnum.Franchisee) {
    return `fr_${v}`;
  }
  return v;
};
