import { store } from '../views/store';
import { bootstrapData } from '../preamble';
import { getDashboardPermalink as getDashboardPermalinkUtil } from "../utils/urlUtils";

type Size = {
  width: number, height: number
}

type EmbeddedSupersetApi = {
  getScrollSize: () => Size;
  getDashboardPermalink: ({ anchor }: { anchor: string }) => Promise<string>;
  getActiveTabs: () => string[];
}

const getScrollSize = (): Size => ({
  width: document.body.scrollWidth,
  height: document.body.scrollHeight,
})

const getDashboardPermalink = async ({anchor}: {anchor: string}): Promise<string> => {
  const state = store?.getState();
  const { dashboardId, dataMask, activeTabs } = {
    dashboardId: state?.dashboardInfo?.id || bootstrapData?.embedded!.dashboard_id,
    dataMask: state?.dataMask,
    activeTabs: state.dashboardState?.activeTabs,
  }

  return getDashboardPermalinkUtil({
    dashboardId,
    dataMask,
    activeTabs,
    anchor,
  });
}

const getActiveTabs = () => store?.getState()?.dashboardState?.activeTabs || [];

export const embeddedApi: EmbeddedSupersetApi = {
  getScrollSize,
  getDashboardPermalink,
  getActiveTabs
};
