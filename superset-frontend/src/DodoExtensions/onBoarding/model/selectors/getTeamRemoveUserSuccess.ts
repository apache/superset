import { OnboardingTeamRemoveUserState } from '../types/teamRemoveUser.types';

export const getTeamRemoveUserSuccess = (state: {
  onboardingTeamRemoveUser: OnboardingTeamRemoveUserState;
}) => state.onboardingTeamRemoveUser.success;
