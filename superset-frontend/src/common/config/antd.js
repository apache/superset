const antdConfig = {
  getPopupContainer: () =>
    document.getElementById('antdContainer') || document.body,
};

export default antdConfig;