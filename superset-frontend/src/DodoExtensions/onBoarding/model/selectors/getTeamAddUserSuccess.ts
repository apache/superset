import { OnboardingTeamAddUserState } from '../types/teamAddUser.types';

export const getTeamAddUserSuccess = (state: {
  onboardingTeamAddUser: OnboardingTeamAddUserState;
}) => state.onboardingTeamAddUser.success;
