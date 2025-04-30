import { SupersetClient, t } from '@superset-ui/core';

interface FetchPaginatedOptions {
  endpoint: string;
  pageSize?: number;
  setData: (data: any[]) => void;
  setLoadingState: React.Dispatch<React.SetStateAction<any>>;
  loadingKey: string;
  addDangerToast: (message: string) => void;
  errorMessage?: string;
  mapResult?: (item: any) => any;
}

export const fetchPaginatedData = async ({
  endpoint,
  pageSize = 100,
  setData,
  setLoadingState,
  loadingKey,
  addDangerToast,
  errorMessage = 'Error while fetching data',
  mapResult = (item: any) => item,
}: FetchPaginatedOptions) => {
  try {
    const fetchPage = async (pageIndex: number) => {
      const response = await SupersetClient.get({
        endpoint: `${endpoint}?q=(page_size:${pageSize},page:${pageIndex})`,
      });

      return {
        count: response.json.count,
        results: response.json.result.map(mapResult),
      };
    };

    const initialResponse = await fetchPage(0);
    const totalItems = initialResponse.count;
    const firstPageResults = initialResponse.results;

    if (pageSize >= totalItems) {
      setData(firstPageResults);
      return;
    }

    const totalPages = Math.ceil(totalItems / pageSize);

    const requests = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchPage(i + 1),
    );
    const remainingResults = await Promise.all(requests);

    setData([
      ...firstPageResults,
      ...remainingResults.flatMap(res => res.results),
    ]);
  } catch (err) {
    addDangerToast(t(errorMessage));
  } finally {
    setLoadingState((prev: Record<string, boolean>) => ({
      ...prev,
      [loadingKey]: false,
    }));
  }
};
