import { OnboardingTeamCreateState } from '../types/teamCreate.types';

export const getCreateTeamData = (state: {
  onboardingTeamCreate: OnboardingTeamCreateState;
}) => state.onboardingTeamCreate.data;
