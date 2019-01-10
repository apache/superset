import findTopLevelComponentIds from './findTopLevelComponentIds';
import childChartsDidLoad from './childChartsDidLoad';

export default function getLoadStatsPerTopLevelComponent({
  layout,
  chartQueries,
}) {
  const topLevelComponents = findTopLevelComponentIds(layout);
  const stats = {};
  topLevelComponents.forEach(({ id, ...restStats }) => {
    const { didLoad, minQueryStartTime } = childChartsDidLoad({
      id,
      layout,
      chartQueries,
    });

    stats[id] = {
      didLoad,
      id,
      minQueryStartTime,
      ...restStats,
    };
  });

  return stats;
}
