export const createJumpToDashboardHandler = (chartProps: any) => {
  const jumpToDashboard = JSON.parse(chartProps.formData.jumpToDashboard);
  return (e: any) => {
    const jumpTo = jumpToDashboard[e.name];
    if (jumpTo) {
      if (window.location.href.indexOf('embedded') > -1) {
        window.parent?.postMessage(
          {
            type: 'JUMP_TO_DASHBOARD',
            dashboard_uuid: jumpTo,
          },
          '*',
        );
      }
    }
  };
};
