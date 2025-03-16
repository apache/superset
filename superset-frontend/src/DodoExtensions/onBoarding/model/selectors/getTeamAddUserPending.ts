import { OnboardingTeamAddUserState } from '../types/teamAddUser.types';

export const getTeamAddUserPending = (state: {
  onboardingTeamAddUser: OnboardingTeamAddUserState;
}) => state.onboardingTeamAddUser.pending;
