import { OnBoardingTeamListState } from '../types/teamList.types';

export const getTeamListPending = (state: {
  onboardingTeamList: OnBoardingTeamListState;
}) => state.onboardingTeamList.pending;
