const antdConfig = {
  prefixCls: 'antd',
  getPopupContainer: () =>
    document.getElementById('antdContainer') || document.body,
};

export default antdConfig;