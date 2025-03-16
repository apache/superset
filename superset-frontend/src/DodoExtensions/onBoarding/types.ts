export type OnBoardingStorageInfo = {
  theTimeOfTheLastShow?: Date;
  initialByUser?: boolean;
};

export enum Role {
  Readonly = 'readonly',
  CreateData = 'Create data',
  VizualizeData = 'Vizualize data',
  Unknown = 'Unknown',
}

export type Team = {
  label: string;
  value: string;
  roles: Array<Role>;
};

export type User = {
  label: string;
  value: number;
};

export enum UserFromEnum {
  Franchisee = 'Franchisee',
  ManagingCompany = 'Managing Company',
  Unknown = 'Unknown',
}
