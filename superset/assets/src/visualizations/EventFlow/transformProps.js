import {
  cleanEvents,
  TS,
  EVENT_NAME,
  ENTITY_ID,
} from '@data-ui/event-flow';

export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    allColumnsX,
    entity,
    minLeafNodeEventCount,
  } = formData;
  const { data } = payload;

  const hasData = data && data.length > 0;
  if (hasData) {
    const userKey = entity;
    const eventNameKey = allColumnsX;

    // map from the Superset form fields to <EventFlow />'s expected data keys
    const accessorFunctions = {
      [TS]: datum => new Date(datum.__timestamp), // eslint-disable-line no-underscore-dangle
      [EVENT_NAME]: datum => datum[eventNameKey],
      [ENTITY_ID]: datum => String(datum[userKey]),
    };

    const cleanData = cleanEvents(data, accessorFunctions);
    return {
      data: cleanData,
      initialMinEventCount: minLeafNodeEventCount,
    };
  }
  return { data: null };
}
