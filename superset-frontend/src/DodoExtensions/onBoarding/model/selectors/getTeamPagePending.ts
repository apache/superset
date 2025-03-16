import { OnBoardingTeamPageState } from '../types/teamPage.types';

export const getTeamPagePending = (state: {
  onboardingTeamPage: OnBoardingTeamPageState;
}) => state.onboardingTeamPage.pending;
