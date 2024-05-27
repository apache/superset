// DODO added #34037254
import {
  getAnnotationLayersData,
  getSingleAnnotationData,
  getSingleAnnotationLayerIdsData,
} from '../../Superstructure/Root/utils';
import {
  AnnotationLayer,
  InitializedResponse,
  SingleAnnotation,
} from '../../Superstructure/types/global';

type AnnotationsRequestDto = Array<
  InitializedResponse<{ result: SingleAnnotation } | null>
>;

const ALERT_PREFIX = '[ALERT]';

const handleAnnotationLayersRequest = async () => {
  const annotationsResponse = await getAnnotationLayersData();

  if (annotationsResponse.loaded && annotationsResponse.data) {
    const filteredAnnotationLayers = annotationsResponse.data.filter(
      (layer: AnnotationLayer) => layer.name.includes(ALERT_PREFIX),
    );

    const foundAnnotationLayer = filteredAnnotationLayers[0] || null;

    if (foundAnnotationLayer) {
      const idsResponse = await getSingleAnnotationLayerIdsData(
        foundAnnotationLayer.id,
      );

      if (
        idsResponse?.loaded &&
        idsResponse.data?.ids &&
        idsResponse.data?.ids.length
      ) {
        const dataWithIds = {
          layerId: idsResponse.data.layerId,
          ids: idsResponse.data.ids,
        };

        return dataWithIds;
      }

      return null;
    }

    return null;
  }

  return null;
};

const handleAnnotationsRequest = async ({
  layerId,
  ids,
}: {
  layerId: number;
  ids: number[];
}): Promise<InitializedResponse<{ result: SingleAnnotation } | null>[]> =>
  Promise.all(
    ids.map(
      async (
        id,
      ): Promise<InitializedResponse<{ result: SingleAnnotation } | null>> =>
        getSingleAnnotationData(layerId, id),
    ),
  );

const loadAnnotations = async (): Promise<AnnotationsRequestDto | null> => {
  const annotationIds = await handleAnnotationLayersRequest();

  if (annotationIds) {
    const annotations = await handleAnnotationsRequest(annotationIds);
    if (annotations?.length) {
      return annotations.filter(annotation =>
        annotation?.data?.result.short_descr.includes(ALERT_PREFIX),
      );
    }
  }

  return null;
};

const loadAnnotationMessages = async (): Promise<Array<SingleAnnotation>> => {
  const annotations = (await loadAnnotations()) ?? [];

  const result: Array<SingleAnnotation> = [];
  annotations.forEach(item => {
    if (item?.data !== null) {
      result.push(item.data.result);
    }
  });

  return result;
};

export { handleAnnotationsRequest, loadAnnotations, loadAnnotationMessages };
export type { AnnotationsRequestDto };
