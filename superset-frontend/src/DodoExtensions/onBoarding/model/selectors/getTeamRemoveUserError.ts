import { OnboardingTeamRemoveUserState } from '../types/teamRemoveUser.types';

export const getTeamRemoveUserError = (state: {
  onboardingTeamRemoveUser: OnboardingTeamRemoveUserState;
}) => state.onboardingTeamRemoveUser.error;
