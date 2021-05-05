const config = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: false,
        targets: '> 0.25%, not dead',
      },
    ],
  ],
};

module.exports = config;
