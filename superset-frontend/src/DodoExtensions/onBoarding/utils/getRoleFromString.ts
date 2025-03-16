import { Role } from '../types';

export const getRoleFromString = ({ name }: { name: string }): Role => {
  switch (name) {
    case Role.Readonly: {
      return Role.Readonly;
    }
    case Role.CreateData: {
      return Role.CreateData;
    }
    case Role.VizualizeData: {
      return Role.VizualizeData;
    }
    default:
      return Role.Unknown;
  }
};
