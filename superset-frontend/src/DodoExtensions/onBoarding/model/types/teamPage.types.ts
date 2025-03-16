export const ONBOARDING_TEAM_PAGE_PENDING = 'ONBOARDING_TEAM_PAGE_PENDING';
export const ONBOARDING_TEAM_PAGE_SUCCESS = 'ONBOARDING_TEAM_PAGE_SUCCESS';
export const ONBOARDING_TEAM_PAGE_ERROR = 'ONBOARDING_TEAM_PAGE_ERROR';

type TeamPageSuccessPayload = {
  id: number;
  isExternal: boolean;
  name: string;
  slug: string;
  roles: string;
  membersCount: number;
  participants: Array<{
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    createdOn: Date;
    lastLogin: Date;
    loginCount: number;
  }>;
};

type Pending = {
  type: typeof ONBOARDING_TEAM_PAGE_PENDING;
};

type Success = {
  type: typeof ONBOARDING_TEAM_PAGE_SUCCESS;
  payload: TeamPageSuccessPayload;
};

type Error = {
  type: typeof ONBOARDING_TEAM_PAGE_ERROR;
  payload: { error: string };
};

type OnboardingTeamPageAction = Pending | Success | Error;

type OnBoardingTeamPageState = {
  pending: boolean;
  error: string | null;
  data: TeamPageSuccessPayload | null;
};

export type {
  OnBoardingTeamPageState,
  TeamPageSuccessPayload,
  OnboardingTeamPageAction,
};
