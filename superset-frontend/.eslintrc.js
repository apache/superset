/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const packageConfig = require('./package');

const importCoreModules = [];
Object.entries(packageConfig.dependencies).forEach(([pkg]) => {
  if (/@superset-ui/.test(pkg)) {
    importCoreModules.push(pkg);
  }
});

// ignore files in production mode
let ignorePatterns = [];
if (process.env.NODE_ENV === 'production') {
  ignorePatterns = [
    '*.test.{js,ts,jsx,tsx}',
    'plugins/**/test/**/*',
    'packages/**/test/**/*',
    'packages/generator-superset/**/*',
  ];
}

const restrictedImportsRules = {
  'no-design-icons': {
    name: '@ant-design/icons',
    message:
      'Avoid importing icons directly from @ant-design/icons. Use the src/components/Icons component instead.',
  },
  'no-moment': {
    name: 'moment',
    message:
      'Please use the dayjs library instead of moment.js. See https://day.js.org',
  },
  'no-lodash-memoize': {
    name: 'lodash/memoize',
    message: 'Lodash Memoize is unsafe! Please use memoize-one instead',
  },
  'no-testing-library-react': {
    name: '@superset-ui/core/spec',
    message: 'Please use spec/helpers/testing-library instead',
  },
  'no-testing-library-react-dom-utils': {
    name: '@testing-library/react-dom-utils',
    message: 'Please use spec/helpers/testing-library instead',
  },
  'no-antd': {
    name: 'antd',
    message: 'Please import Ant components from the index of src/components',
  },
  'no-superset-theme': {
    name: '@superset-ui/core',
    importNames: ['supersetTheme'],
    message:
      'Please use the theme directly from the ThemeProvider rather than importing supersetTheme.',
  },
  'no-query-string': {
    name: 'query-string',
    message: 'Please use the URLSearchParams API instead of query-string.',
  },
};

module.exports = {
  extends: [
    'prettier',
    'prettier/react',
    'plugin:react-hooks/recommended',
    'plugin:react-prefer-function-component/recommended',
    'plugin:storybook/recommended',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2018,
  },
  env: {
    browser: true,
    node: true,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        // resolve modules from `/superset_frontend/node_modules` and `/superset_frontend`
        moduleDirectory: ['node_modules', '.'],
      },
      typescript: {
        alwaysTryTypes: true,
        project: [
          './tsconfig.json',
          './packages/superset-ui-core/tsconfig.json',
          './packages/superset-ui-chart-controls/',
          './plugins/*/tsconfig.json',
        ],
      },
    },
    // only allow import from top level of module
    'import/core-modules': importCoreModules,
    react: {
      version: 'detect',
    },
  },
  plugins: [
    'import',
    'react',
    'jsx-a11y',
    'react-hooks',
    'file-progress',
    'lodash',
    'theme-colors',
    'icons',
    'i18n-strings',
    'react-prefer-function-component',
    'prettier',
  ],
  // Add this TS ESlint rule in separate `rules` section to avoid breakages with JS/TS files in /cypress-base.
  // TODO(hainenber): merge it to below `rules` section.
  rules: {
    // === Core Airbnb ESLint rules (extracted from eslint-config-airbnb) ===
    // Plugin rules (react/*, import/*, jsx-a11y/*) remain in the 'extends: ["airbnb"]' config

    'array-callback-return': [
      'error',
      {
        allowImplicit: true,
      },
    ],
    'block-scoped-var': 'error',
    complexity: ['off', 20],
    'consistent-return': 'error',
    'default-case': [
      'error',
      {
        commentPattern: '^no default$',
      },
    ],
    'dot-notation': [
      'error',
      {
        allowKeywords: true,
      },
    ],
    'dot-location': ['error', 'property'],
    eqeqeq: [
      'error',
      'always',
      {
        null: 'ignore',
      },
    ],
    'grouped-accessor-pairs': 'error',
    'no-alert': 'warn',
    'no-caller': 'error',

    'no-constructor-return': 'error',

    'no-else-return': [
      'error',
      {
        allowElseIf: false,
      },
    ],
    'no-empty-function': [
      'error',
      {
        allow: ['arrowFunctions', 'functions', 'methods'],
      },
    ],

    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-extra-label': 'error',

    'no-floating-decimal': 'error',
    'no-global-assign': [
      'error',
      {
        exceptions: [],
      },
    ],

    'no-implicit-coercion': [
      'off',
      {
        boolean: false,
        number: true,
        string: true,
        allow: [],
      },
    ],

    'no-implied-eval': 'error',

    'no-iterator': 'error',
    'no-labels': [
      'error',
      {
        allowLoop: false,
        allowSwitch: false,
      },
    ],
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': [
      'off',
      {
        ignore: [],
        ignoreArrayIndexes: true,
        enforceConst: true,
        detectObjects: false,
      },
    ],
    'no-multi-str': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',

    'no-octal-escape': 'error',
    'no-param-reassign': [
      'error',
      {
        props: true,
        ignorePropertyModificationsFor: [
          'acc',
          'accumulator',
          'e',
          'ctx',
          'context',
          'req',
          'request',
          'res',
          'response',
          '$scope',
          'staticContext',
        ],
      },
    ],
    'no-proto': 'error',

    'no-return-assign': ['error', 'always'],
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-self-assign': [
      'error',
      {
        props: true,
      },
    ],
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',

    'no-unused-expressions': [
      'error',
      {
        allowShortCircuit: false,
        allowTernary: false,
        allowTaggedTemplates: false,
      },
    ],

    'no-useless-concat': 'error',

    'no-useless-return': 'error',
    'no-void': 'error',
    'no-warning-comments': [
      'off',
      {
        terms: ['todo', 'fixme', 'xxx'],
        location: 'start',
      },
    ],

    'prefer-promise-reject-errors': [
      'error',
      {
        allowEmptyReject: true,
      },
    ],

    radix: 'error',

    'vars-on-top': 'error',
    'wrap-iife': [
      'error',
      'outside',
      {
        functionPrototypeMethods: false,
      },
    ],
    yoda: 'error',

    'getter-return': [
      'error',
      {
        allowImplicit: true,
      },
    ],

    'no-await-in-loop': 'error',

    'no-cond-assign': ['error', 'always'],
    'no-console': 'warn',
    'no-constant-condition': 'warn',

    'no-extra-parens': [
      'off',
      'all',
      {
        conditionalAssign: true,
        nestedBinaryExpressions: false,
        returnAssign: false,
        ignoreJSX: 'all',
        enforceForArrowConditionals: false,
      },
    ],
    'no-extra-semi': 'error',

    'no-template-curly-in-string': 'error',

    'no-unreachable-loop': [
      'error',
      {
        ignore: [],
      },
    ],

    'valid-typeof': [
      'error',
      {
        requireStringLiterals: true,
      },
    ],

    'no-mixed-requires': ['off', false],

    'array-bracket-newline': ['off', 'consistent'],
    'array-element-newline': [
      'off',
      {
        multiline: true,
        minItems: 3,
      },
    ],
    'array-bracket-spacing': 'off',
    'block-spacing': ['error', 'always'],
    'brace-style': 'off',
    'capitalized-comments': [
      'off',
      'never',
      {
        line: {
          ignorePattern: '.*',
          ignoreInlineComments: true,
          ignoreConsecutiveComments: true,
        },
        block: {
          ignorePattern: '.*',
          ignoreInlineComments: true,
          ignoreConsecutiveComments: true,
        },
      },
    ],
    'comma-dangle': 'off',
    'comma-spacing': 'off',
    'comma-style': [
      'error',
      'last',
      {
        exceptions: {
          ArrayExpression: false,
          ArrayPattern: false,
          ArrowFunctionExpression: false,
          CallExpression: false,
          FunctionDeclaration: false,
          FunctionExpression: false,
          ImportDeclaration: false,
          ObjectExpression: false,
          ObjectPattern: false,
          VariableDeclaration: false,
          NewExpression: false,
        },
      },
    ],
    'computed-property-spacing': 'off',

    'eol-last': 'off',
    'function-call-argument-newline': ['error', 'consistent'],
    'func-call-spacing': 'off',
    'func-name-matching': [
      'off',
      'always',
      {
        includeCommonJSModuleExports: false,
        considerPropertyDescriptor: true,
      },
    ],
    'func-style': ['off', 'expression'],
    'function-paren-newline': 'off',

    'implicit-arrow-linebreak': 'off',
    'jsx-quotes': 'off',
    'key-spacing': 'off',
    'keyword-spacing': 'off',
    'line-comment-position': [
      'off',
      {
        position: 'above',
        ignorePattern: '',
        applyDefaultPatterns: true,
      },
    ],
    'linebreak-style': 'off',
    'lines-between-class-members': 'off',
    'max-depth': ['off', 4],
    'max-len': 'off',
    'max-lines': [
      'off',
      {
        max: 300,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    'max-lines-per-function': [
      'off',
      {
        max: 50,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true,
      },
    ],

    'max-params': ['off', 3],
    'max-statements': ['off', 10],
    'max-statements-per-line': [
      'off',
      {
        max: 1,
      },
    ],
    'multiline-comment-style': ['off', 'starred-block'],
    'multiline-ternary': ['off', 'never'],
    'new-parens': 'error',

    'newline-per-chained-call': [
      'error',
      {
        ignoreChainWithDepth: 4,
      },
    ],
    'no-array-constructor': 'error',

    'no-lonely-if': 'error',
    'no-mixed-spaces-and-tabs': 'off',
    'no-multiple-empty-lines': 'off',

    'no-new-object': 'error',
    'no-plusplus': 'error',

    'no-tabs': 'off',

    'no-trailing-spaces': 'off',
    'no-underscore-dangle': [
      'error',
      {
        allow: ['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'],
        allowAfterThis: false,
        allowAfterSuper: false,
        enforceInMethodNames: true,
      },
    ],
    'no-unneeded-ternary': [
      'error',
      {
        defaultAssignment: false,
      },
    ],
    'no-whitespace-before-property': 'off',
    'nonblock-statement-body-position': 'off',
    'object-curly-spacing': 'off',
    'object-curly-newline': 'off',
    'object-property-newline': [
      'error',
      {
        allowAllPropertiesOnSameLine: true,
      },
    ],
    'one-var': ['error', 'never'],
    'one-var-declaration-per-line': ['error', 'always'],
    'operator-assignment': ['error', 'always'],
    'operator-linebreak': 'off',

    'quote-props': 'off',
    quotes: 'off',

    semi: 'off',
    'semi-spacing': 'off',
    'semi-style': ['error', 'last'],
    'sort-keys': [
      'off',
      'asc',
      {
        caseSensitive: false,
        natural: true,
      },
    ],

    'space-before-blocks': 'off',
    'space-before-function-paren': 'off',
    'space-in-parens': 'off',
    'space-infix-ops': 'off',
    'space-unary-ops': 'off',
    'spaced-comment': [
      'error',
      'always',
      {
        line: {
          exceptions: ['-', '+'],
          markers: ['=', '!', '/'],
        },
        block: {
          exceptions: ['-', '+'],
          markers: ['=', '!', ':', '::'],
          balanced: true,
        },
      },
    ],
    'switch-colon-spacing': [
      'error',
      {
        after: true,
        before: false,
      },
    ],
    'template-tag-spacing': ['error', 'never'],
    'unicode-bom': 'off',

    'no-label-var': 'error',
    'no-restricted-globals': [
      'error',
      {
        name: 'isFinite',
        message:
          'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
      },
      {
        name: 'isNaN',
        message:
          'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
      },
      'addEventListener',
      'blur',
      'close',
      'closed',
      'confirm',
      'defaultStatus',
      'defaultstatus',
      'event',
      'external',
      'find',
      'focus',
      'frameElement',
      'frames',
      'history',
      'innerHeight',
      'innerWidth',
      'length',
      'location',
      'locationbar',
      'menubar',
      'moveBy',
      'moveTo',
      'name',
      'onblur',
      'onerror',
      'onfocus',
      'onload',
      'onresize',
      'onunload',
      'open',
      'opener',
      'opera',
      'outerHeight',
      'outerWidth',
      'pageXOffset',
      'pageYOffset',
      'parent',
      'print',
      'removeEventListener',
      'resizeBy',
      'resizeTo',
      'screen',
      'screenLeft',
      'screenTop',
      'screenX',
      'screenY',
      'scroll',
      'scrollbars',
      'scrollBy',
      'scrollTo',
      'scrollX',
      'scrollY',
      'self',
      'status',
      'statusbar',
      'stop',
      'toolbar',
      'top',
    ],
    'no-shadow-restricted-names': 'error',

    'no-undef-init': 'error',

    'no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
      },
    ],
    'arrow-body-style': [
      'error',
      'as-needed',
      {
        requireReturnForObjectLiteral: false,
      },
    ],
    'arrow-parens': 'off',
    'arrow-spacing': [
      'error',
      {
        before: true,
        after: true,
      },
    ],

    'generator-star-spacing': [
      'error',
      {
        before: false,
        after: true,
      },
    ],

    'no-confusing-arrow': 'off',

    'no-useless-computed-key': 'error',
    'no-useless-constructor': 'error',
    'no-useless-rename': [
      'error',
      {
        ignoreDestructuring: false,
        ignoreImport: false,
        ignoreExport: false,
      },
    ],
    'no-var': 'error',
    'object-shorthand': [
      'error',
      'always',
      {
        ignoreConstructors: false,
        avoidQuotes: true,
      },
    ],
    'prefer-const': [
      'error',
      {
        destructuring: 'any',
        ignoreReadBeforeAssign: true,
      },
    ],
    'prefer-numeric-literals': 'error',

    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',

    'rest-spread-spacing': ['error', 'never'],
    'sort-imports': [
      'off',
      {
        ignoreCase: false,
        ignoreDeclarationSort: false,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],
    'symbol-description': 'error',
    'template-curly-spacing': 'error',
    'yield-star-spacing': ['error', 'after'],
    strict: ['error', 'never'],
    // === End of core Airbnb rules ===

    // === Plugin rules from Airbnb (previously in eslint-config-airbnb) ===

    // Import plugin rules (43 rules)
    'import/no-unresolved': [
      'error',
      {
        commonjs: true,
        caseSensitive: true,
      },
    ],
    'import/named': 'error',

    'import/export': 'error',
    'import/no-named-as-default': 'error',
    'import/no-named-as-default-member': 'error',

    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'test/**',
          'tests/**',
          'spec/**',
          '**/__tests__/**',
          '**/__mocks__/**',
          'test.{js,jsx}',
          'test-*.{js,jsx}',
          '**/*{.,_}{test,spec}.{js,jsx}',
          '**/jest.config.js',
          '**/jest.setup.js',
          '**/vue.config.js',
          '**/webpack.config.js',
          '**/webpack.config.*.js',
          '**/rollup.config.js',
          '**/rollup.config.*.js',
          '**/gulpfile.js',
          '**/gulpfile.*.js',
          '**/Gruntfile{,.js}',
          '**/protractor.conf.js',
          '**/protractor.conf.*.js',
          '**/karma.conf.js',
          '**/.eslintrc.js',
        ],
        optionalDependencies: false,
      },
    ],
    'import/no-mutable-exports': 'error',

    'import/no-amd': 'error',

    'import/first': 'error',

    'import/no-duplicates': 'error',

    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        mjs: 'never',
        jsx: 'never',
      },
    ],
    'import/order': [
      'error',
      {
        groups: [['builtin', 'external', 'internal']],
      },
    ],
    'import/newline-after-import': 'error',
    'import/prefer-default-export': 'error',

    'import/max-dependencies': [
      'off',
      {
        max: 10,
      },
    ],
    'import/no-absolute-path': 'error',
    'import/no-dynamic-require': 'error',
    'import/no-internal-modules': [
      'off',
      {
        allow: [],
      },
    ],

    'import/no-webpack-loader-syntax': 'error',

    'import/no-named-default': 'error',
    'import/no-anonymous-default-export': [
      'off',
      {
        allowArray: false,
        allowArrowFunction: false,
        allowAnonymousClass: false,
        allowAnonymousFunction: false,
        allowLiteral: false,
        allowObject: false,
      },
    ],

    'import/no-self-import': 'error',
    'import/no-cycle': [
      'error',
      {
        maxDepth: '∞',
      },
    ],
    'import/no-useless-path-segments': [
      'error',
      {
        commonjs: true,
      },
    ],
    'import/dynamic-import-chunkname': [
      'off',
      {
        importFunctions: [],
        webpackChunknameFormat: '[0-9a-zA-Z-_/.]+',
      },
    ],

    'import/no-unused-modules': [
      'off',
      {
        ignoreExports: [],
        missingExports: true,
        unusedExports: true,
      },
    ],
    'import/no-import-module-exports': [
      'error',
      {
        exceptions: [],
      },
    ],
    'import/no-relative-packages': 'error',

    // React plugin rules (94 rules)
    'react/display-name': [
      'off',
      {
        ignoreTranspilerName: false,
      },
    ],
    'react/forbid-prop-types': [
      'error',
      {
        forbid: ['any', 'array', 'object'],
        checkContextTypes: true,
        checkChildContextTypes: true,
      },
    ],
    'react/forbid-dom-props': [
      'off',
      {
        forbid: [],
      },
    ],
    'react/jsx-boolean-value': [
      'error',
      'never',
      {
        always: [],
      },
    ],
    'react/jsx-closing-bracket-location': 'off',
    'react/jsx-closing-tag-location': 'off',
    'react/jsx-curly-spacing': 'off',
    'react/jsx-handler-names': [
      'off',
      {
        eventHandlerPrefix: 'handle',
        eventHandlerPropPrefix: 'on',
      },
    ],
    'react/jsx-indent-props': 'off',
    'react/jsx-key': 'off',
    'react/jsx-max-props-per-line': 'off',
    'react/jsx-no-bind': [
      'error',
      {
        ignoreRefs: true,
        allowArrowFunctions: true,
        allowFunctions: false,
        allowBind: false,
        ignoreDOMComponents: true,
      },
    ],
    'react/jsx-no-duplicate-props': [
      'error',
      {
        ignoreCase: true,
      },
    ],
    'react/jsx-no-literals': [
      'off',
      {
        noStrings: true,
      },
    ],
    'react/jsx-no-undef': 'error',
    'react/jsx-pascal-case': [
      'error',
      {
        allowAllCaps: true,
        ignore: [],
      },
    ],
    'react/sort-prop-types': [
      'off',
      {
        ignoreCase: true,
        callbacksLast: false,
        requiredFirst: false,
        sortShapeProp: true,
      },
    ],

    'react/jsx-sort-props': [
      'off',
      {
        ignoreCase: true,
        callbacksLast: false,
        shorthandFirst: false,
        shorthandLast: false,
        noSortAlphabetically: false,
        reservedFirst: true,
      },
    ],
    'react/jsx-sort-default-props': [
      'off',
      {
        ignoreCase: true,
      },
    ],
    'react/jsx-uses-vars': 'error',
    'react/no-danger': 'warn',
    'react/no-deprecated': ['error'],

    'react/no-did-update-set-state': 'error',
    'react/no-will-update-set-state': 'error',
    'react/no-direct-mutation-state': 'off',
    'react/no-is-mounted': 'error',

    'react/no-string-refs': 'error',
    'react/no-unknown-property': 'error',
    'react/prefer-es6-class': ['error', 'always'],
    'react/prefer-stateless-function': [
      'error',
      {
        ignorePureComponents: true,
      },
    ],
    'react/prop-types': [
      'error',
      {
        ignore: [],
        customValidators: [],
        skipUndeclared: false,
      },
    ],
    'react/require-render-return': 'error',
    'react/self-closing-comp': 'error',
    'react/sort-comp': [
      'error',
      {
        order: [
          'static-variables',
          'static-methods',
          'instance-variables',
          'lifecycle',
          '/^handle.+$/',
          '/^on.+$/',
          'getters',
          'setters',
          '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
          'instance-methods',
          'everything-else',
          'rendering',
        ],
        groups: {
          lifecycle: [
            'displayName',
            'propTypes',
            'contextTypes',
            'childContextTypes',
            'mixins',
            'statics',
            'defaultProps',
            'constructor',
            'getDefaultProps',
            'getInitialState',
            'state',
            'getChildContext',
            'getDerivedStateFromProps',
            'componentWillMount',
            'UNSAFE_componentWillMount',
            'componentDidMount',
            'componentWillReceiveProps',
            'UNSAFE_componentWillReceiveProps',
            'shouldComponentUpdate',
            'componentWillUpdate',
            'UNSAFE_componentWillUpdate',
            'getSnapshotBeforeUpdate',
            'componentDidUpdate',
            'componentDidCatch',
            'componentWillUnmount',
          ],
          rendering: ['/^render.+$/', 'render'],
        },
      },
    ],
    'react/jsx-wrap-multilines': 'off',
    'react/jsx-first-prop-new-line': 'off',
    'react/jsx-equals-spacing': 'off',
    'react/jsx-indent': 'off',
    'react/jsx-no-target-blank': [
      'error',
      {
        enforceDynamicLinks: 'always',
      },
    ],
    'react/jsx-filename-extension': [
      'error',
      {
        extensions: ['.jsx'],
      },
    ],
    'react/jsx-no-comment-textnodes': 'error',
    'react/no-render-return-value': 'error',
    'react/require-optimization': [
      'off',
      {
        allowDecorators: [],
      },
    ],
    'react/no-find-dom-node': 'error',
    'react/forbid-component-props': [
      'off',
      {
        forbid: [],
      },
    ],
    'react/forbid-elements': [
      'off',
      {
        forbid: [],
      },
    ],
    'react/no-danger-with-children': 'error',
    'react/no-unused-prop-types': [
      'error',
      {
        customValidators: [],
        skipShapeProps: true,
      },
    ],
    'react/style-prop-object': 'error',
    'react/no-unescaped-entities': 'error',
    'react/no-children-prop': 'error',
    'react/jsx-tag-spacing': 'off',
    'react/jsx-space-before-closing': ['off', 'always'],
    'react/no-array-index-key': 'error',
    'react/require-default-props': [
      'error',
      {
        forbidDefaultForRequired: true,
      },
    ],
    'react/forbid-foreign-prop-types': [
      'warn',
      {
        allowInPropTypes: true,
      },
    ],
    'react/void-dom-elements-no-children': 'error',
    'react/default-props-match-prop-types': [
      'error',
      {
        allowRequiredDefaults: false,
      },
    ],
    'react/no-redundant-should-component-update': 'error',
    'react/no-unused-state': 'error',
    'react/boolean-prop-naming': [
      'off',
      {
        propTypeNames: ['bool', 'mutuallyExclusiveTrueProps'],
        rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
        message: '',
      },
    ],
    'react/no-typos': 'error',
    'react/jsx-curly-brace-presence': [
      'error',
      {
        props: 'never',
        children: 'never',
      },
    ],
    'react/jsx-one-expression-per-line': 'off',
    'react/destructuring-assignment': ['error', 'always'],
    'react/no-access-state-in-setstate': 'error',
    'react/button-has-type': [
      'error',
      {
        button: true,
        submit: true,
        reset: false,
      },
    ],

    'react/no-this-in-sfc': 'error',

    'react/jsx-props-no-multi-spaces': 'off',
    'react/no-unsafe': 'off',
    'react/jsx-fragments': ['error', 'syntax'],
    'react/jsx-curly-newline': 'off',
    'react/state-in-constructor': ['error', 'always'],
    'react/static-property-placement': ['error', 'property assignment'],
    'react/jsx-props-no-spreading': [
      'error',
      {
        html: 'enforce',
        custom: 'enforce',
        explicitSpread: 'ignore',
        exceptions: [],
      },
    ],

    'react/jsx-no-script-url': [
      'error',
      [
        {
          name: 'Link',
          props: ['to'],
        },
      ],
    ],
    'react/jsx-no-useless-fragment': 'error',

    'react/function-component-definition': [
      'error',
      {
        namedComponents: ['function-declaration', 'function-expression'],
        unnamedComponents: 'function-expression',
      },
    ],

    'react/jsx-no-constructed-context-values': 'error',
    'react/no-unstable-nested-components': 'error',
    'react/no-namespace': 'error',
    'react/prefer-exact-props': 'error',
    'react/no-arrow-function-lifecycle': 'error',
    'react/no-invalid-html-attribute': 'error',
    'react/no-unused-class-component-methods': 'error',

    // JSX-a11y plugin rules (36 rules)

    'jsx-a11y/alt-text': [
      'error',
      {
        elements: ['img', 'object', 'area', 'input[type="image"]'],
        img: [],
        object: [],
        area: [],
        'input[type="image"]': [],
      },
    ],
    'jsx-a11y/anchor-has-content': [
      'error',
      {
        components: [],
      },
    ],
    'jsx-a11y/anchor-is-valid': [
      'error',
      {
        components: ['Link'],
        specialLink: ['to'],
        aspects: ['noHref', 'invalidHref', 'preferButton'],
      },
    ],
    'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': [
      'error',
      {
        ignoreNonDOM: false,
      },
    ],
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/autocomplete-valid': [
      'off',
      {
        inputComponents: [],
      },
    ],
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/control-has-associated-label': [
      'error',
      {
        labelAttributes: ['label'],
        controlComponents: [],
        ignoreElements: [
          'audio',
          'canvas',
          'embed',
          'input',
          'textarea',
          'tr',
          'video',
        ],
        ignoreRoles: [
          'grid',
          'listbox',
          'menu',
          'menubar',
          'radiogroup',
          'row',
          'tablist',
          'toolbar',
          'tree',
          'treegrid',
        ],
        depth: 5,
      },
    ],
    'jsx-a11y/heading-has-content': [
      'error',
      {
        components: [''],
      },
    ],
    'jsx-a11y/html-has-lang': 'error',
    'jsx-a11y/iframe-has-title': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/interactive-supports-focus': 'error',
    'jsx-a11y/label-has-associated-control': [
      'error',
      {
        labelComponents: [],
        labelAttributes: [],
        controlComponents: [],
        assert: 'both',
        depth: 25,
      },
    ],
    'jsx-a11y/lang': 'error',
    'jsx-a11y/media-has-caption': [
      'error',
      {
        audio: [],
        video: [],
        track: [],
      },
    ],
    'jsx-a11y/mouse-events-have-key-events': 'error',
    'jsx-a11y/no-access-key': 'error',
    'jsx-a11y/no-autofocus': [
      'error',
      {
        ignoreNonDOM: true,
      },
    ],
    'jsx-a11y/no-distracting-elements': [
      'error',
      {
        elements: ['marquee', 'blink'],
      },
    ],
    'jsx-a11y/no-interactive-element-to-noninteractive-role': [
      'error',
      {
        tr: ['none', 'presentation'],
      },
    ],
    'jsx-a11y/no-noninteractive-element-interactions': [
      'error',
      {
        handlers: [
          'onClick',
          'onMouseDown',
          'onMouseUp',
          'onKeyPress',
          'onKeyDown',
          'onKeyUp',
        ],
      },
    ],
    'jsx-a11y/no-noninteractive-element-to-interactive-role': [
      'error',
      {
        ul: [
          'listbox',
          'menu',
          'menubar',
          'radiogroup',
          'tablist',
          'tree',
          'treegrid',
        ],
        ol: [
          'listbox',
          'menu',
          'menubar',
          'radiogroup',
          'tablist',
          'tree',
          'treegrid',
        ],
        li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
        table: ['grid'],
        td: ['gridcell'],
      },
    ],
    'jsx-a11y/no-noninteractive-tabindex': [
      'error',
      {
        tags: [],
        roles: ['tabpanel'],
      },
    ],

    'jsx-a11y/no-redundant-roles': 'error',
    'jsx-a11y/no-static-element-interactions': [
      'error',
      {
        handlers: [
          'onClick',
          'onMouseDown',
          'onMouseUp',
          'onKeyPress',
          'onKeyDown',
          'onKeyUp',
        ],
      },
    ],
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/scope': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
    'jsx-a11y/label-has-for': [
      'off',
      {
        components: [],
        required: {
          every: ['nesting', 'id'],
        },
        allowChildren: false,
      },
    ],

    // React-hooks plugin rules (2 rules)

    // === End of plugin rules from Airbnb ===

    // === Custom rules ===
    '@typescript-eslint/prefer-optional-chain': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'prettier/@typescript-eslint',
        'prettier/react',
      ],
      plugins: ['@typescript-eslint/eslint-plugin', 'react', 'prettier'],
      rules: {
        // === Core Airbnb ESLint rules (extracted from eslint-config-airbnb) ===

        'array-callback-return': [
          'error',
          {
            allowImplicit: true,
          },
        ],
        'block-scoped-var': 'error',
        complexity: ['off', 20],
        'consistent-return': 'error',
        'default-case': [
          'error',
          {
            commentPattern: '^no default$',
          },
        ],
        'dot-notation': [
          'error',
          {
            allowKeywords: true,
          },
        ],
        'dot-location': ['error', 'property'],
        eqeqeq: [
          'error',
          'always',
          {
            null: 'ignore',
          },
        ],
        'grouped-accessor-pairs': 'error',
        'no-alert': 'warn',
        'no-caller': 'error',

        'no-constructor-return': 'error',

        'no-else-return': [
          'error',
          {
            allowElseIf: false,
          },
        ],
        'no-empty-function': [
          'error',
          {
            allow: ['arrowFunctions', 'functions', 'methods'],
          },
        ],

        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-extra-label': 'error',

        'no-floating-decimal': 'error',
        'no-global-assign': [
          'error',
          {
            exceptions: [],
          },
        ],

        'no-implicit-coercion': [
          'off',
          {
            boolean: false,
            number: true,
            string: true,
            allow: [],
          },
        ],

        'no-implied-eval': 'error',

        'no-iterator': 'error',
        'no-labels': [
          'error',
          {
            allowLoop: false,
            allowSwitch: false,
          },
        ],
        'no-lone-blocks': 'error',
        'no-loop-func': 'error',
        'no-magic-numbers': [
          'off',
          {
            ignore: [],
            ignoreArrayIndexes: true,
            enforceConst: true,
            detectObjects: false,
          },
        ],
        'no-multi-str': 'error',
        'no-new': 'error',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',

        'no-octal-escape': 'error',
        'no-param-reassign': [
          'error',
          {
            props: true,
            ignorePropertyModificationsFor: [
              'acc',
              'accumulator',
              'e',
              'ctx',
              'context',
              'req',
              'request',
              'res',
              'response',
              '$scope',
              'staticContext',
            ],
          },
        ],
        'no-proto': 'error',

        'no-return-assign': ['error', 'always'],
        'no-return-await': 'error',
        'no-script-url': 'error',
        'no-self-assign': [
          'error',
          {
            props: true,
          },
        ],
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',

        'no-unused-expressions': [
          'error',
          {
            allowShortCircuit: false,
            allowTernary: false,
            allowTaggedTemplates: false,
          },
        ],

        'no-useless-concat': 'error',

        'no-useless-return': 'error',
        'no-void': 'error',
        'no-warning-comments': [
          'off',
          {
            terms: ['todo', 'fixme', 'xxx'],
            location: 'start',
          },
        ],

        'prefer-promise-reject-errors': [
          'error',
          {
            allowEmptyReject: true,
          },
        ],

        radix: 'error',

        'vars-on-top': 'error',
        'wrap-iife': [
          'error',
          'outside',
          {
            functionPrototypeMethods: false,
          },
        ],
        yoda: 'error',

        'getter-return': [
          'error',
          {
            allowImplicit: true,
          },
        ],

        'no-await-in-loop': 'error',

        'no-cond-assign': ['error', 'always'],
        'no-console': 'warn',
        'no-constant-condition': 'warn',

        'no-extra-parens': [
          'off',
          'all',
          {
            conditionalAssign: true,
            nestedBinaryExpressions: false,
            returnAssign: false,
            ignoreJSX: 'all',
            enforceForArrowConditionals: false,
          },
        ],
        'no-extra-semi': 'error',

        'no-template-curly-in-string': 'error',

        'no-unreachable-loop': [
          'error',
          {
            ignore: [],
          },
        ],

        'valid-typeof': [
          'error',
          {
            requireStringLiterals: true,
          },
        ],

        'no-mixed-requires': ['off', false],

        'array-bracket-newline': ['off', 'consistent'],
        'array-element-newline': [
          'off',
          {
            multiline: true,
            minItems: 3,
          },
        ],
        'array-bracket-spacing': 'off',
        'block-spacing': ['error', 'always'],
        'brace-style': 'off',
        'capitalized-comments': [
          'off',
          'never',
          {
            line: {
              ignorePattern: '.*',
              ignoreInlineComments: true,
              ignoreConsecutiveComments: true,
            },
            block: {
              ignorePattern: '.*',
              ignoreInlineComments: true,
              ignoreConsecutiveComments: true,
            },
          },
        ],
        'comma-dangle': 'off',
        'comma-spacing': 'off',
        'comma-style': [
          'error',
          'last',
          {
            exceptions: {
              ArrayExpression: false,
              ArrayPattern: false,
              ArrowFunctionExpression: false,
              CallExpression: false,
              FunctionDeclaration: false,
              FunctionExpression: false,
              ImportDeclaration: false,
              ObjectExpression: false,
              ObjectPattern: false,
              VariableDeclaration: false,
              NewExpression: false,
            },
          },
        ],
        'computed-property-spacing': 'off',

        'eol-last': 'off',
        'function-call-argument-newline': ['error', 'consistent'],
        'func-call-spacing': 'off',
        'func-name-matching': [
          'off',
          'always',
          {
            includeCommonJSModuleExports: false,
            considerPropertyDescriptor: true,
          },
        ],
        'func-style': ['off', 'expression'],
        'function-paren-newline': 'off',

        'implicit-arrow-linebreak': 'off',
        'jsx-quotes': 'off',
        'key-spacing': 'off',
        'keyword-spacing': 'off',
        'line-comment-position': [
          'off',
          {
            position: 'above',
            ignorePattern: '',
            applyDefaultPatterns: true,
          },
        ],
        'linebreak-style': 'off',
        'lines-between-class-members': 'off',
        'max-depth': ['off', 4],
        'max-len': 'off',
        'max-lines': [
          'off',
          {
            max: 300,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
        'max-lines-per-function': [
          'off',
          {
            max: 50,
            skipBlankLines: true,
            skipComments: true,
            IIFEs: true,
          },
        ],

        'max-params': ['off', 3],
        'max-statements': ['off', 10],
        'max-statements-per-line': [
          'off',
          {
            max: 1,
          },
        ],
        'multiline-comment-style': ['off', 'starred-block'],
        'multiline-ternary': ['off', 'never'],
        'new-parens': 'error',

        'newline-per-chained-call': [
          'error',
          {
            ignoreChainWithDepth: 4,
          },
        ],
        'no-array-constructor': 'error',

        'no-lonely-if': 'error',
        'no-mixed-spaces-and-tabs': 'off',
        'no-multiple-empty-lines': 'off',

        'no-new-object': 'error',
        'no-plusplus': 'error',

        'no-tabs': 'off',

        'no-trailing-spaces': 'off',
        'no-underscore-dangle': [
          'error',
          {
            allow: ['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'],
            allowAfterThis: false,
            allowAfterSuper: false,
            enforceInMethodNames: true,
          },
        ],
        'no-unneeded-ternary': [
          'error',
          {
            defaultAssignment: false,
          },
        ],
        'no-whitespace-before-property': 'off',
        'nonblock-statement-body-position': 'off',
        'object-curly-spacing': 'off',
        'object-curly-newline': 'off',
        'object-property-newline': [
          'error',
          {
            allowAllPropertiesOnSameLine: true,
          },
        ],
        'one-var': ['error', 'never'],
        'one-var-declaration-per-line': ['error', 'always'],
        'operator-assignment': ['error', 'always'],
        'operator-linebreak': 'off',

        'quote-props': 'off',
        quotes: 'off',

        semi: 'off',
        'semi-spacing': 'off',
        'semi-style': ['error', 'last'],
        'sort-keys': [
          'off',
          'asc',
          {
            caseSensitive: false,
            natural: true,
          },
        ],

        'space-before-blocks': 'off',
        'space-before-function-paren': 'off',
        'space-in-parens': 'off',
        'space-infix-ops': 'off',
        'space-unary-ops': 'off',
        'spaced-comment': [
          'error',
          'always',
          {
            line: {
              exceptions: ['-', '+'],
              markers: ['=', '!', '/'],
            },
            block: {
              exceptions: ['-', '+'],
              markers: ['=', '!', ':', '::'],
              balanced: true,
            },
          },
        ],
        'switch-colon-spacing': [
          'error',
          {
            after: true,
            before: false,
          },
        ],
        'template-tag-spacing': ['error', 'never'],
        'unicode-bom': 'off',

        'no-label-var': 'error',
        'no-restricted-globals': [
          'error',
          {
            name: 'isFinite',
            message:
              'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
          },
          {
            name: 'isNaN',
            message:
              'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
          },
          'addEventListener',
          'blur',
          'close',
          'closed',
          'confirm',
          'defaultStatus',
          'defaultstatus',
          'event',
          'external',
          'find',
          'focus',
          'frameElement',
          'frames',
          'history',
          'innerHeight',
          'innerWidth',
          'length',
          'location',
          'locationbar',
          'menubar',
          'moveBy',
          'moveTo',
          'name',
          'onblur',
          'onerror',
          'onfocus',
          'onload',
          'onresize',
          'onunload',
          'open',
          'opener',
          'opera',
          'outerHeight',
          'outerWidth',
          'pageXOffset',
          'pageYOffset',
          'parent',
          'print',
          'removeEventListener',
          'resizeBy',
          'resizeTo',
          'screen',
          'screenLeft',
          'screenTop',
          'screenX',
          'screenY',
          'scroll',
          'scrollbars',
          'scrollBy',
          'scrollTo',
          'scrollX',
          'scrollY',
          'self',
          'status',
          'statusbar',
          'stop',
          'toolbar',
          'top',
        ],
        'no-shadow-restricted-names': 'error',

        'no-undef-init': 'error',

        'no-unused-vars': [
          'error',
          {
            vars: 'all',
            args: 'after-used',
            ignoreRestSiblings: true,
          },
        ],
        'arrow-body-style': [
          'error',
          'as-needed',
          {
            requireReturnForObjectLiteral: false,
          },
        ],
        'arrow-parens': 'off',
        'arrow-spacing': [
          'error',
          {
            before: true,
            after: true,
          },
        ],

        'generator-star-spacing': [
          'error',
          {
            before: false,
            after: true,
          },
        ],

        'no-confusing-arrow': 'off',

        'no-useless-computed-key': 'error',
        'no-useless-constructor': 'error',
        'no-useless-rename': [
          'error',
          {
            ignoreDestructuring: false,
            ignoreImport: false,
            ignoreExport: false,
          },
        ],
        'no-var': 'error',
        'object-shorthand': [
          'error',
          'always',
          {
            ignoreConstructors: false,
            avoidQuotes: true,
          },
        ],
        'prefer-const': [
          'error',
          {
            destructuring: 'any',
            ignoreReadBeforeAssign: true,
          },
        ],
        'prefer-numeric-literals': 'error',

        'prefer-rest-params': 'error',
        'prefer-spread': 'error',
        'prefer-template': 'error',

        'rest-spread-spacing': ['error', 'never'],
        'sort-imports': [
          'off',
          {
            ignoreCase: false,
            ignoreDeclarationSort: false,
            ignoreMemberSort: false,
            memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          },
        ],
        'symbol-description': 'error',
        'template-curly-spacing': 'error',
        'yield-star-spacing': ['error', 'after'],
        strict: ['error', 'never'],
        // === End of core Airbnb rules ===

        // === Plugin rules from Airbnb (previously in eslint-config-airbnb) ===

        // Import plugin rules (43 rules)
        'import/no-unresolved': [
          'error',
          {
            commonjs: true,
            caseSensitive: true,
          },
        ],
        'import/named': 'error',

        'import/export': 'error',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',

        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: [
              'test/**',
              'tests/**',
              'spec/**',
              '**/__tests__/**',
              '**/__mocks__/**',
              'test.{js,jsx}',
              'test-*.{js,jsx}',
              '**/*{.,_}{test,spec}.{js,jsx}',
              '**/jest.config.js',
              '**/jest.setup.js',
              '**/vue.config.js',
              '**/webpack.config.js',
              '**/webpack.config.*.js',
              '**/rollup.config.js',
              '**/rollup.config.*.js',
              '**/gulpfile.js',
              '**/gulpfile.*.js',
              '**/Gruntfile{,.js}',
              '**/protractor.conf.js',
              '**/protractor.conf.*.js',
              '**/karma.conf.js',
              '**/.eslintrc.js',
            ],
            optionalDependencies: false,
          },
        ],
        'import/no-mutable-exports': 'error',

        'import/no-amd': 'error',

        'import/first': 'error',

        'import/no-duplicates': 'error',

        'import/extensions': [
          'error',
          'ignorePackages',
          {
            js: 'never',
            mjs: 'never',
            jsx: 'never',
          },
        ],
        'import/order': [
          'error',
          {
            groups: [['builtin', 'external', 'internal']],
          },
        ],
        'import/newline-after-import': 'error',
        'import/prefer-default-export': 'error',

        'import/max-dependencies': [
          'off',
          {
            max: 10,
          },
        ],
        'import/no-absolute-path': 'error',
        'import/no-dynamic-require': 'error',
        'import/no-internal-modules': [
          'off',
          {
            allow: [],
          },
        ],

        'import/no-webpack-loader-syntax': 'error',

        'import/no-named-default': 'error',
        'import/no-anonymous-default-export': [
          'off',
          {
            allowArray: false,
            allowArrowFunction: false,
            allowAnonymousClass: false,
            allowAnonymousFunction: false,
            allowLiteral: false,
            allowObject: false,
          },
        ],

        'import/no-self-import': 'error',
        'import/no-cycle': [
          'error',
          {
            maxDepth: '∞',
          },
        ],
        'import/no-useless-path-segments': [
          'error',
          {
            commonjs: true,
          },
        ],
        'import/dynamic-import-chunkname': [
          'off',
          {
            importFunctions: [],
            webpackChunknameFormat: '[0-9a-zA-Z-_/.]+',
          },
        ],

        'import/no-unused-modules': [
          'off',
          {
            ignoreExports: [],
            missingExports: true,
            unusedExports: true,
          },
        ],
        'import/no-import-module-exports': [
          'error',
          {
            exceptions: [],
          },
        ],
        'import/no-relative-packages': 'error',

        // React plugin rules (94 rules)
        'react/display-name': [
          'off',
          {
            ignoreTranspilerName: false,
          },
        ],
        'react/forbid-prop-types': [
          'error',
          {
            forbid: ['any', 'array', 'object'],
            checkContextTypes: true,
            checkChildContextTypes: true,
          },
        ],
        'react/forbid-dom-props': [
          'off',
          {
            forbid: [],
          },
        ],
        'react/jsx-boolean-value': [
          'error',
          'never',
          {
            always: [],
          },
        ],
        'react/jsx-closing-bracket-location': 'off',
        'react/jsx-closing-tag-location': 'off',
        'react/jsx-curly-spacing': 'off',
        'react/jsx-handler-names': [
          'off',
          {
            eventHandlerPrefix: 'handle',
            eventHandlerPropPrefix: 'on',
          },
        ],
        'react/jsx-indent-props': 'off',
        'react/jsx-key': 'off',
        'react/jsx-max-props-per-line': 'off',
        'react/jsx-no-bind': [
          'error',
          {
            ignoreRefs: true,
            allowArrowFunctions: true,
            allowFunctions: false,
            allowBind: false,
            ignoreDOMComponents: true,
          },
        ],
        'react/jsx-no-duplicate-props': [
          'error',
          {
            ignoreCase: true,
          },
        ],
        'react/jsx-no-literals': [
          'off',
          {
            noStrings: true,
          },
        ],
        'react/jsx-no-undef': 'error',
        'react/jsx-pascal-case': [
          'error',
          {
            allowAllCaps: true,
            ignore: [],
          },
        ],
        'react/sort-prop-types': [
          'off',
          {
            ignoreCase: true,
            callbacksLast: false,
            requiredFirst: false,
            sortShapeProp: true,
          },
        ],

        'react/jsx-sort-props': [
          'off',
          {
            ignoreCase: true,
            callbacksLast: false,
            shorthandFirst: false,
            shorthandLast: false,
            noSortAlphabetically: false,
            reservedFirst: true,
          },
        ],
        'react/jsx-sort-default-props': [
          'off',
          {
            ignoreCase: true,
          },
        ],
        'react/jsx-uses-vars': 'error',
        'react/no-danger': 'warn',
        'react/no-deprecated': ['error'],

        'react/no-did-update-set-state': 'error',
        'react/no-will-update-set-state': 'error',
        'react/no-direct-mutation-state': 'off',
        'react/no-is-mounted': 'error',

        'react/no-string-refs': 'error',
        'react/no-unknown-property': 'error',
        'react/prefer-es6-class': ['error', 'always'],
        'react/prefer-stateless-function': [
          'error',
          {
            ignorePureComponents: true,
          },
        ],
        'react/prop-types': [
          'error',
          {
            ignore: [],
            customValidators: [],
            skipUndeclared: false,
          },
        ],
        'react/require-render-return': 'error',
        'react/self-closing-comp': 'error',
        'react/sort-comp': [
          'error',
          {
            order: [
              'static-variables',
              'static-methods',
              'instance-variables',
              'lifecycle',
              '/^handle.+$/',
              '/^on.+$/',
              'getters',
              'setters',
              '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
              'instance-methods',
              'everything-else',
              'rendering',
            ],
            groups: {
              lifecycle: [
                'displayName',
                'propTypes',
                'contextTypes',
                'childContextTypes',
                'mixins',
                'statics',
                'defaultProps',
                'constructor',
                'getDefaultProps',
                'getInitialState',
                'state',
                'getChildContext',
                'getDerivedStateFromProps',
                'componentWillMount',
                'UNSAFE_componentWillMount',
                'componentDidMount',
                'componentWillReceiveProps',
                'UNSAFE_componentWillReceiveProps',
                'shouldComponentUpdate',
                'componentWillUpdate',
                'UNSAFE_componentWillUpdate',
                'getSnapshotBeforeUpdate',
                'componentDidUpdate',
                'componentDidCatch',
                'componentWillUnmount',
              ],
              rendering: ['/^render.+$/', 'render'],
            },
          },
        ],
        'react/jsx-wrap-multilines': 'off',
        'react/jsx-first-prop-new-line': 'off',
        'react/jsx-equals-spacing': 'off',
        'react/jsx-indent': 'off',
        'react/jsx-no-target-blank': [
          'error',
          {
            enforceDynamicLinks: 'always',
          },
        ],
        'react/jsx-filename-extension': [
          'error',
          {
            extensions: ['.jsx'],
          },
        ],
        'react/jsx-no-comment-textnodes': 'error',
        'react/no-render-return-value': 'error',
        'react/require-optimization': [
          'off',
          {
            allowDecorators: [],
          },
        ],
        'react/no-find-dom-node': 'error',
        'react/forbid-component-props': [
          'off',
          {
            forbid: [],
          },
        ],
        'react/forbid-elements': [
          'off',
          {
            forbid: [],
          },
        ],
        'react/no-danger-with-children': 'error',
        'react/no-unused-prop-types': [
          'error',
          {
            customValidators: [],
            skipShapeProps: true,
          },
        ],
        'react/style-prop-object': 'error',
        'react/no-unescaped-entities': 'error',
        'react/no-children-prop': 'error',
        'react/jsx-tag-spacing': 'off',
        'react/jsx-space-before-closing': ['off', 'always'],
        'react/no-array-index-key': 'error',
        'react/require-default-props': [
          'error',
          {
            forbidDefaultForRequired: true,
          },
        ],
        'react/forbid-foreign-prop-types': [
          'warn',
          {
            allowInPropTypes: true,
          },
        ],
        'react/void-dom-elements-no-children': 'error',
        'react/default-props-match-prop-types': [
          'error',
          {
            allowRequiredDefaults: false,
          },
        ],
        'react/no-redundant-should-component-update': 'error',
        'react/no-unused-state': 'error',
        'react/boolean-prop-naming': [
          'off',
          {
            propTypeNames: ['bool', 'mutuallyExclusiveTrueProps'],
            rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
            message: '',
          },
        ],
        'react/no-typos': 'error',
        'react/jsx-curly-brace-presence': [
          'error',
          {
            props: 'never',
            children: 'never',
          },
        ],
        'react/jsx-one-expression-per-line': 'off',
        'react/destructuring-assignment': ['error', 'always'],
        'react/no-access-state-in-setstate': 'error',
        'react/button-has-type': [
          'error',
          {
            button: true,
            submit: true,
            reset: false,
          },
        ],

        'react/no-this-in-sfc': 'error',

        'react/jsx-props-no-multi-spaces': 'off',
        'react/no-unsafe': 'off',
        'react/jsx-fragments': ['error', 'syntax'],
        'react/jsx-curly-newline': 'off',
        'react/state-in-constructor': ['error', 'always'],
        'react/static-property-placement': ['error', 'property assignment'],
        'react/jsx-props-no-spreading': [
          'error',
          {
            html: 'enforce',
            custom: 'enforce',
            explicitSpread: 'ignore',
            exceptions: [],
          },
        ],

        'react/jsx-no-script-url': [
          'error',
          [
            {
              name: 'Link',
              props: ['to'],
            },
          ],
        ],
        'react/jsx-no-useless-fragment': 'error',

        'react/function-component-definition': [
          'error',
          {
            namedComponents: ['function-declaration', 'function-expression'],
            unnamedComponents: 'function-expression',
          },
        ],

        'react/jsx-no-constructed-context-values': 'error',
        'react/no-unstable-nested-components': 'error',
        'react/no-namespace': 'error',
        'react/prefer-exact-props': 'error',
        'react/no-arrow-function-lifecycle': 'error',
        'react/no-invalid-html-attribute': 'error',
        'react/no-unused-class-component-methods': 'error',

        // JSX-a11y plugin rules (36 rules)

        'jsx-a11y/alt-text': [
          'error',
          {
            elements: ['img', 'object', 'area', 'input[type="image"]'],
            img: [],
            object: [],
            area: [],
            'input[type="image"]': [],
          },
        ],
        'jsx-a11y/anchor-has-content': [
          'error',
          {
            components: [],
          },
        ],
        'jsx-a11y/anchor-is-valid': [
          'error',
          {
            components: ['Link'],
            specialLink: ['to'],
            aspects: ['noHref', 'invalidHref', 'preferButton'],
          },
        ],
        'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
        'jsx-a11y/aria-props': 'error',
        'jsx-a11y/aria-proptypes': 'error',
        'jsx-a11y/aria-role': [
          'error',
          {
            ignoreNonDOM: false,
          },
        ],
        'jsx-a11y/aria-unsupported-elements': 'error',
        'jsx-a11y/autocomplete-valid': [
          'off',
          {
            inputComponents: [],
          },
        ],
        'jsx-a11y/click-events-have-key-events': 'error',
        'jsx-a11y/control-has-associated-label': [
          'error',
          {
            labelAttributes: ['label'],
            controlComponents: [],
            ignoreElements: [
              'audio',
              'canvas',
              'embed',
              'input',
              'textarea',
              'tr',
              'video',
            ],
            ignoreRoles: [
              'grid',
              'listbox',
              'menu',
              'menubar',
              'radiogroup',
              'row',
              'tablist',
              'toolbar',
              'tree',
              'treegrid',
            ],
            depth: 5,
          },
        ],
        'jsx-a11y/heading-has-content': [
          'error',
          {
            components: [''],
          },
        ],
        'jsx-a11y/html-has-lang': 'error',
        'jsx-a11y/iframe-has-title': 'error',
        'jsx-a11y/img-redundant-alt': 'error',
        'jsx-a11y/interactive-supports-focus': 'error',
        'jsx-a11y/label-has-associated-control': [
          'error',
          {
            labelComponents: [],
            labelAttributes: [],
            controlComponents: [],
            assert: 'both',
            depth: 25,
          },
        ],
        'jsx-a11y/lang': 'error',
        'jsx-a11y/media-has-caption': [
          'error',
          {
            audio: [],
            video: [],
            track: [],
          },
        ],
        'jsx-a11y/mouse-events-have-key-events': 'error',
        'jsx-a11y/no-access-key': 'error',
        'jsx-a11y/no-autofocus': [
          'error',
          {
            ignoreNonDOM: true,
          },
        ],
        'jsx-a11y/no-distracting-elements': [
          'error',
          {
            elements: ['marquee', 'blink'],
          },
        ],
        'jsx-a11y/no-interactive-element-to-noninteractive-role': [
          'error',
          {
            tr: ['none', 'presentation'],
          },
        ],
        'jsx-a11y/no-noninteractive-element-interactions': [
          'error',
          {
            handlers: [
              'onClick',
              'onMouseDown',
              'onMouseUp',
              'onKeyPress',
              'onKeyDown',
              'onKeyUp',
            ],
          },
        ],
        'jsx-a11y/no-noninteractive-element-to-interactive-role': [
          'error',
          {
            ul: [
              'listbox',
              'menu',
              'menubar',
              'radiogroup',
              'tablist',
              'tree',
              'treegrid',
            ],
            ol: [
              'listbox',
              'menu',
              'menubar',
              'radiogroup',
              'tablist',
              'tree',
              'treegrid',
            ],
            li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
            table: ['grid'],
            td: ['gridcell'],
          },
        ],
        'jsx-a11y/no-noninteractive-tabindex': [
          'error',
          {
            tags: [],
            roles: ['tabpanel'],
          },
        ],

        'jsx-a11y/no-redundant-roles': 'error',
        'jsx-a11y/no-static-element-interactions': [
          'error',
          {
            handlers: [
              'onClick',
              'onMouseDown',
              'onMouseUp',
              'onKeyPress',
              'onKeyDown',
              'onKeyUp',
            ],
          },
        ],
        'jsx-a11y/role-has-required-aria-props': 'error',
        'jsx-a11y/role-supports-aria-props': 'error',
        'jsx-a11y/scope': 'error',
        'jsx-a11y/tabindex-no-positive': 'error',
        'jsx-a11y/label-has-for': [
          'off',
          {
            components: [],
            required: {
              every: ['nesting', 'id'],
            },
            allowChildren: false,
          },
        ],

        // React-hooks plugin rules (2 rules)

        // === End of plugin rules from Airbnb ===

        // === Custom rules ===

        '@typescript-eslint/ban-ts-ignore': 0,
        '@typescript-eslint/ban-ts-comment': 0, // disabled temporarily
        '@typescript-eslint/ban-types': 0, // disabled temporarily
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'enum',
            format: ['PascalCase'],
          },
          {
            selector: 'enumMember',
            format: ['PascalCase'],
          },
        ],
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-use-before-define': 1, // disabled temporarily
        '@typescript-eslint/no-non-null-assertion': 0, // disabled temporarily
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0, // re-enable up for discussion
        '@typescript-eslint/no-unused-vars': 'warn', // downgrade to Warning severity for Jest v30 upgrade
        camelcase: 0,

        'import/no-cycle': 0, // re-enable up for discussion, might require some major refactors
        'import/extensions': [
          'error',
          {
            '.ts': 'always',
            '.tsx': 'always',
            '.json': 'always',
          },
        ],
        'import/no-named-as-default-member': 0,
        'import/prefer-default-export': 0,
        indent: 'off',
        'jsx-a11y/anchor-is-valid': 2,
        'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
        'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion

        'no-prototype-builtins': 0,

        'prefer-destructuring': ['error', { object: true, array: false }],
        'react/destructuring-assignment': 0, // re-enable up for discussion
        'react/forbid-prop-types': 0,
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
        'react/jsx-fragments': 1,
        'react/jsx-no-bind': 0,
        'react/jsx-props-no-spreading': 0, // re-enable up for discussion
        'react/no-array-index-key': 0,
        'react/no-string-refs': 0,
        'react/no-unescaped-entities': 0,
        'react/no-unused-prop-types': 0,
        'react/prop-types': 0,
        'react/require-default-props': 0,
        'react/sort-comp': 0, // TODO: re-enable in separate PR
        'react/static-property-placement': 0, // re-enable up for discussion
        'prettier/prettier': 'error',
        'file-progress/activate': 1,
        // delete me later: temporary rules to help with migration
        'jsx-no-useless-fragment': 0,
        'react/function-component-definition': [
          0,
          {
            namedComponents: 'arrow-function',
          },
        ],

        'react/no-unstable-nested-components': 0,
        'react/jsx-no-useless-fragment': 0,
        'react/no-unknown-property': 0,

        'react/default-props-match-prop-types': 0,
        'no-unsafe-optional-chaining': 0,
        'react/state-in-constructor': 0,
        'import/no-import-module-exports': 0,
        'no-promise-executor-return': 0,

        'react/no-unused-class-component-methods': 0,
        'import/no-relative-packages': 0,

        'react/react-in-jsx-scope': 0,
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "ImportDeclaration[source.value='react'] :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier)",
            message:
              'Default React import is not required due to automatic JSX runtime in React 16.4',
          },
          {
            // this disallows wildcard imports from modules (but allows them for local files with `./` or `src/`)
            selector:
              'ImportNamespaceSpecifier[parent.source.value!=/^(\\.|src)/]',
            message: 'Wildcard imports are not allowed',
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: Object.values(restrictedImportsRules).filter(Boolean),
            patterns: ['antd/*'],
          },
        ],
      },
      settings: {
        'import/resolver': {
          typescript: {},
        },
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: ['packages/**'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              restrictedImportsRules['no-moment'],
              restrictedImportsRules['no-lodash-memoize'],
              restrictedImportsRules['no-superset-theme'],
            ],
            patterns: [],
          },
        ],
      },
    },
    {
      files: ['plugins/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              restrictedImportsRules['no-moment'],
              restrictedImportsRules['no-lodash-memoize'],
            ],
            patterns: [],
          },
        ],
      },
    },
    {
      files: ['src/components/**', 'src/theme/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: Object.values(restrictedImportsRules).filter(
              r => r.name !== 'antd',
            ),
            patterns: [],
          },
        ],
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
        '**/test/**/*',
        '**/tests/**/*',
        'spec/**/*',
        '**/fixtures/**/*',
        '**/__mocks__/**/*',
        '**/spec/**/*',
      ],
      excludedFiles: 'cypress-base/cypress/**/*',
      plugins: ['jest', 'jest-dom', 'no-only-tests', 'testing-library'],
      env: {
        'jest/globals': true,
      },
      settings: {
        jest: {
          version: 'detect',
        },
      },
      extends: [
        'plugin:jest/recommended',
        'plugin:jest-dom/recommended',
        'plugin:testing-library/react',
      ],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: true,
          },
        ],
        'jest/consistent-test-it': 'error',
        'no-only-tests/no-only-tests': 'error',
        'prefer-promise-reject-errors': 0,
        'max-classes-per-file': 0,
        // temporary rules to help with migration - please re-enable!
        'testing-library/await-async-queries': 0,
        'testing-library/await-async-utils': 0,
        'testing-library/no-await-sync-events': 0,
        'testing-library/no-render-in-lifecycle': 0,
        'testing-library/no-unnecessary-act': 0,
        'testing-library/no-wait-for-multiple-assertions': 0,
        'testing-library/prefer-screen-queries': 0,
        'testing-library/await-async-events': 0,
        'testing-library/no-node-access': 0,
        'testing-library/no-wait-for-side-effects': 0,
        'testing-library/prefer-presence-queries': 0,
        'testing-library/render-result-naming-convention': 0,
        'testing-library/no-container': 0,
        'testing-library/prefer-find-by': 0,
        'testing-library/no-manual-cleanup': 0,
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "ImportDeclaration[source.value='react'] :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier)",
            message:
              'Default React import is not required due to automatic JSX runtime in React 16.4',
          },
        ],
        'no-restricted-imports': 0,
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
        '**/test/**/*',
        '**/tests/**/*',
        'spec/**/*',
        '**/fixtures/**/*',
        '**/__mocks__/**/*',
        '**/spec/**/*',
        'cypress-base/cypress/**/*',
        'Stories.tsx',
        'packages/superset-ui-core/src/theme/index.tsx',
      ],
      rules: {
        'theme-colors/no-literal-colors': 0,
        'icons/no-fa-icons-usage': 0,
        'i18n-strings/no-template-vars': 0,
        'no-restricted-imports': 0,
        'react/no-void-elements': 0,
      },
    },
    {
      // Override specifically for packages stories and overview files
      // This must come LAST to override other rules
      files: [
        'packages/**/*.stories.*',
        'packages/**/*.overview.*',
        'packages/**/fixtures.*',
      ],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      // Allow @playwright/test imports in Playwright test files
      files: ['playwright/**/*.ts', 'playwright/**/*.js'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: true,
          },
        ],
      },
    },
  ],
  // eslint-disable-next-line no-dupe-keys
  rules: {
    'theme-colors/no-literal-colors': 'error',
    'icons/no-fa-icons-usage': 'error',
    'i18n-strings/no-template-vars': ['error', true],
    camelcase: [
      'error',
      {
        allow: ['^UNSAFE_'],
        properties: 'never',
      },
    ],

    curly: 'off',

    'import/extensions': [
      'error',
      {
        '.js': 'always',
        '.jsx': 'always',
        '.ts': 'always',
        '.tsx': 'always',
        '.json': 'always',
      },
    ],
    'import/no-cycle': 0, // re-enable up for discussion, might require some major refactors
    'import/prefer-default-export': 0,
    indent: 'off',
    'jsx-a11y/anchor-is-valid': 1,
    'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
    'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion
    'lodash/import-scope': [2, 'member'],

    'no-prototype-builtins': 0,

    'prefer-object-spread': 1,
    'prefer-destructuring': ['error', { object: true, array: false }],
    'react/destructuring-assignment': 0, // re-enable up for discussion
    'react/forbid-component-props': 1,
    'react/forbid-prop-types': 0,
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-fragments': 1,
    'react/jsx-no-bind': 0,
    'react/jsx-props-no-spreading': 0, // re-enable up for discussion
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/prop-types': 0,
    'react/require-default-props': 0,
    'react/sort-comp': 0, // TODO: re-enable in separate PR
    'react/static-property-placement': 0, // disabled temporarily
    'react-prefer-function-component/react-prefer-function-component': 1,
    'prettier/prettier': 'error',
    // disabling some things that come with the eslint 7->8 upgrade. Will address these in a separate PR
    'react/no-unknown-property': 0,
    'react/no-void-elements': 0,
    'react/function-component-definition': [
      0,
      {
        namedComponents: 'arrow-function',
      },
    ],
    'react/no-unstable-nested-components': 0,
    'react/jsx-no-useless-fragment': 0,

    'no-import-assign': 0,
    'import/no-relative-packages': 0,

    'no-promise-executor-return': 0,
    'react/no-unused-class-component-methods': 0,
    'react/react-in-jsx-scope': 0,
    'no-restricted-imports': [
      'error',
      {
        paths: Object.values(restrictedImportsRules).filter(Boolean),
        patterns: ['antd/*'],
      },
    ],
  },
  ignorePatterns,
};
