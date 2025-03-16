import { OnboardingTeamCreateState } from '../types/teamCreate.types';

export const getCreateTeamError = (state: {
  onboardingTeamCreate: OnboardingTeamCreateState;
}) => state.onboardingTeamCreate.error;
