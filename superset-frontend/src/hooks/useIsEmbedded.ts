import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';

export const useIsEmbedded = () =>
  useSelector<RootState, boolean>(({ dashboardInfo }) => !dashboardInfo.userId);
