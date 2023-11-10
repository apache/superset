export const createJumpToDashboardHandler = (chartProps: any) => {
  const jumpToDashboard = JSON.parse(chartProps.formData.jumpToDashboard);
  return (e: any) => {
    const jumpTo = jumpToDashboard[e.name];
    if (jumpTo) {
      // eslint-disable-next-line no-restricted-globals
      location.replace(`${location.origin}/superset/dashboard/${jumpTo}`);
    }
  };
};
