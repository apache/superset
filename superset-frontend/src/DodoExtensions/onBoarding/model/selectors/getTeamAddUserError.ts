import { OnboardingTeamAddUserState } from '../types/teamAddUser.types';

export const getTeamAddUserError = (state: {
  onboardingTeamAddUser: OnboardingTeamAddUserState;
}) => state.onboardingTeamAddUser.error;
