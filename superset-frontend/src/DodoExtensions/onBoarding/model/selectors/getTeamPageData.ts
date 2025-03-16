import { OnBoardingTeamPageState } from '../types/teamPage.types';

export const getTeamPageData = (state: {
  onboardingTeamPage: OnBoardingTeamPageState;
}) => state.onboardingTeamPage.data;
