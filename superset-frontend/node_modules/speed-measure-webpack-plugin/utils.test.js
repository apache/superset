const { prependLoader } = require("./utils");

describe("prependLoader", () => {
  const expectedMappings = [
    {
      name: "single loader",
      from: {
        test: /\.jsx?$/,
        loader: "babel-loader",
      },
      to: {
        test: /\.jsx?$/,
        use: ["speed-measure-webpack-plugin/loader", "babel-loader"],
      },
    },

    {
      name: "single use",
      from: {
        test: /\.jsx?$/,
        use: ["babel-loader"],
      },
      to: {
        test: /\.jsx?$/,
        use: ["speed-measure-webpack-plugin/loader", "babel-loader"],
      },
    },

    {
      name: "single complex use",

      from: {
        test: /\.jsx?$/,
        use: [{ loader: "babel-loader", options: {} }],
      },
      to: {
        test: /\.jsx?$/,
        use: [
          "speed-measure-webpack-plugin/loader",
          { loader: "babel-loader", options: {} },
        ],
      },
    },

    {
      name: "multiple uses",

      from: {
        test: /\.jsx?$/,
        use: [{ loader: "babel-loader", options: {} }, "thread-loader"],
      },
      to: {
        test: /\.jsx?$/,
        use: [
          "speed-measure-webpack-plugin/loader",
          { loader: "babel-loader", options: {} },
          "thread-loader",
        ],
      },
    },

    {
      name: "oneOf",

      from: {
        test: /\.jsx?$/,
        oneOf: [{ use: ["babel-loader"] }, { use: ["thread-loader"] }],
      },
      to: {
        test: /\.jsx?$/,
        oneOf: [
          {
            use: ["speed-measure-webpack-plugin/loader", "babel-loader"],
          },
          {
            use: ["speed-measure-webpack-plugin/loader", "thread-loader"],
          },
        ],
      },
    },

    {
      name: "array",
      from: [
        {
          test: /\.jsx?$/,
          loader: "babel-loader",
        },
        {
          test: /\.css$/,
          loader: "css-loader",
        },
      ],
      to: [
        {
          test: /\.jsx?$/,
          use: ["speed-measure-webpack-plugin/loader", "babel-loader"],
        },
        {
          test: /\.css$/,
          use: ["speed-measure-webpack-plugin/loader", "css-loader"],
        },
      ],
    },
  ];

  expectedMappings.forEach(mapping => {
    it('should create the expected mapping for "' + mapping.name + '"', () => {
      expect(prependLoader(mapping.from)).toEqual(mapping.to);
    });
  });
});
