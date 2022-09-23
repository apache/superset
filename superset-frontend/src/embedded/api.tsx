import { store } from '../views/store';
import { bootstrapData } from '../preamble';
import { URL_PARAMS } from 'src/constants';
import { getDashboardPermalink as getDashboardPermalinkUtil, getUrlParam } from '../utils/urlUtils';
import { getFilterValue } from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';

type Size = {
  width: number;
  height: number;
};

type EmbeddedSupersetApi = {
  getScrollSize: () => Size;
  getDashboardPermalink: ({ anchor }: { anchor: string }) => Promise<string>;
  getActiveTabs: () => string[];
};

const getScrollSize = (): Size => ({
  width: document.body.scrollWidth,
  height: document.body.scrollHeight,
});

const getDashboardPermalink = async ({ anchor }: { anchor: string }): Promise<string> => {
  const dashboardId = store.getState()?.dashboardInfo?.id || bootstrapData?.embedded!.dashboard_id;

  let filterState = {};
  const nativeFiltersKey = getUrlParam(URL_PARAMS.nativeFiltersKey);
  if (nativeFiltersKey && dashboardId) {
    filterState = await getFilterValue(dashboardId, nativeFiltersKey);
  }

  return getDashboardPermalinkUtil({
    dashboardId,
    filterState,
    hash: anchor,
  });
};

const getActiveTabs = () => store?.getState()?.dashboardState?.activeTabs || [];

export const embeddedApi: EmbeddedSupersetApi = {
  getScrollSize,
  getDashboardPermalink,
  getActiveTabs,
};
