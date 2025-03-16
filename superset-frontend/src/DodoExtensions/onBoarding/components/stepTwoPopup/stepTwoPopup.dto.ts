import { Role, UserFromEnum } from '../../types';

export type StepTwoPopupDto = {
  userFrom: UserFromEnum;
  isNewTeam: boolean;
  teamName: string;
  teamSlug: string;
  roles: Array<Role>;
};
