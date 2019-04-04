const defaultParserOptions = {
  ecmaVersion: 6,
  ecmaFeatures: {
    jsx: true,
  },
};

export default function parserOptionsMapper({
  code,
  errors,
  options,
  parserOptions = {},
}) {
  return {
    code,
    errors,
    options,
    parserOptions: {
      ...defaultParserOptions,
      ...parserOptions,
    },
  };
}
