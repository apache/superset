import controlPanel from './Regular/Line/controlPanel';
// Define the createGenericControlPanel function outside of the class
const createRemovedSeriesStyleControlPanel = {
  ...controlPanel,
  controlPanelSections: controlPanel.controlPanelSections.map(section => {
    // Check if section is not null before accessing its properties
    if (section === null) {
      return section;
    }
    return {
      ...section,
      controlSetRows: section.controlSetRows?.map((row: any[]) =>
        row.map(item => {
          if (item?.name === 'seriesType') {
            return {
              ...item,
              config: {
                ...item.config,
                visibility: () => true,
              },
            };
          }
          return item;
        }),
      ),
    };
  }),
};

export default createRemovedSeriesStyleControlPanel;
