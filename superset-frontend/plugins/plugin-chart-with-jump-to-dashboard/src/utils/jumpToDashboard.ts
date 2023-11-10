export const createJumpToDashboardHandler = (chartProps: any) => {
  const jumpToDashboard = JSON.parse(chartProps.formData.jumpToDashboard);
  return (e: any) => {
    const jumpTo = jumpToDashboard[e.name];
    if (jumpTo) {
      // eslint-disable-next-line no-restricted-globals
      if (location.href.indexOf('embedded') > -1) {
        // eslint-disable-next-line no-restricted-globals
        location.replace(`${location.origin}/embedded/${jumpTo}${location.search}`);
      }
    }
  };
};
