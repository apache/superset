export const ONBOARDING_TEAM_LIST_PENDING = 'ONBOARDING_TEAM_LIST_PENDING';
export const ONBOARDING_TEAM_LIST_SUCCESS = 'ONBOARDING_TEAM_LIST_SUCCESS';
export const ONBOARDING_TEAM_LIST_ERROR = 'ONBOARDING_TEAM_LIST_ERROR';

type TeamListRecord = {
  id: number;
  isExternal: boolean;
  name: string;
  slug: string;
  roles: string;
  membersCount: number;
};

type OnboardingTeamListSuccessPayload = {
  count: number;
  rows: Array<TeamListRecord>;
};

type Pending = {
  type: typeof ONBOARDING_TEAM_LIST_PENDING;
};

type Success = {
  type: typeof ONBOARDING_TEAM_LIST_SUCCESS;
  payload: OnboardingTeamListSuccessPayload;
};

type Error = {
  type: typeof ONBOARDING_TEAM_LIST_ERROR;
  payload: { error: string };
};

type OnboardingTeamListAction = Pending | Success | Error;

type OnBoardingTeamListState = {
  pending: boolean;
  error: string | null;
  data: OnboardingTeamListSuccessPayload | null;
};

export type {
  OnBoardingTeamListState,
  OnboardingTeamListSuccessPayload,
  OnboardingTeamListAction,
};
