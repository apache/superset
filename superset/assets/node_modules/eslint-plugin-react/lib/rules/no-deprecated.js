/**
 * @fileoverview Prevent usage of deprecated methods
 * @author Yannick Croissant
 * @author Scott Feeney
 * @author Sergei Startsev
 */
'use strict';

const has = require('has');

const Components = require('../util/Components');
const astUtil = require('../util/ast');
const docsUrl = require('../util/docsUrl');
const pragmaUtil = require('../util/pragma');
const versionUtil = require('../util/version');

// ------------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------------

const MODULES = {
  react: ['React'],
  'react-addons-perf': ['ReactPerf', 'Perf']
};

const DEPRECATED_MESSAGE = '{{oldMethod}} is deprecated since React {{version}}{{newMethod}}{{refs}}';

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Prevent usage of deprecated methods',
      category: 'Best Practices',
      recommended: true,
      url: docsUrl('no-deprecated')
    },
    schema: []
  },

  create: Components.detect((context, components, utils) => {
    const sourceCode = context.getSourceCode();
    const pragma = pragmaUtil.getFromContext(context);

    function getDeprecated() {
      const deprecated = {};
      // 0.12.0
      deprecated[`${pragma}.renderComponent`] = ['0.12.0', `${pragma}.render`];
      deprecated[`${pragma}.renderComponentToString`] = ['0.12.0', `${pragma}.renderToString`];
      deprecated[`${pragma}.renderComponentToStaticMarkup`] = ['0.12.0', `${pragma}.renderToStaticMarkup`];
      deprecated[`${pragma}.isValidComponent`] = ['0.12.0', `${pragma}.isValidElement`];
      deprecated[`${pragma}.PropTypes.component`] = ['0.12.0', `${pragma}.PropTypes.element`];
      deprecated[`${pragma}.PropTypes.renderable`] = ['0.12.0', `${pragma}.PropTypes.node`];
      deprecated[`${pragma}.isValidClass`] = ['0.12.0'];
      deprecated['this.transferPropsTo'] = ['0.12.0', 'spread operator ({...})'];
      // 0.13.0
      deprecated[`${pragma}.addons.classSet`] = ['0.13.0', 'the npm module classnames'];
      deprecated[`${pragma}.addons.cloneWithProps`] = ['0.13.0', `${pragma}.cloneElement`];
      // 0.14.0
      deprecated[`${pragma}.render`] = ['0.14.0', 'ReactDOM.render'];
      deprecated[`${pragma}.unmountComponentAtNode`] = ['0.14.0', 'ReactDOM.unmountComponentAtNode'];
      deprecated[`${pragma}.findDOMNode`] = ['0.14.0', 'ReactDOM.findDOMNode'];
      deprecated[`${pragma}.renderToString`] = ['0.14.0', 'ReactDOMServer.renderToString'];
      deprecated[`${pragma}.renderToStaticMarkup`] = ['0.14.0', 'ReactDOMServer.renderToStaticMarkup'];
      // 15.0.0
      deprecated[`${pragma}.addons.LinkedStateMixin`] = ['15.0.0'];
      deprecated['ReactPerf.printDOM'] = ['15.0.0', 'ReactPerf.printOperations'];
      deprecated['Perf.printDOM'] = ['15.0.0', 'Perf.printOperations'];
      deprecated['ReactPerf.getMeasurementsSummaryMap'] = ['15.0.0', 'ReactPerf.getWasted'];
      deprecated['Perf.getMeasurementsSummaryMap'] = ['15.0.0', 'Perf.getWasted'];
      // 15.5.0
      deprecated[`${pragma}.createClass`] = ['15.5.0', 'the npm module create-react-class'];
      deprecated[`${pragma}.addons.TestUtils`] = ['15.5.0', 'ReactDOM.TestUtils'];
      deprecated[`${pragma}.PropTypes`] = ['15.5.0', 'the npm module prop-types'];
      // 15.6.0
      deprecated[`${pragma}.DOM`] = ['15.6.0', 'the npm module react-dom-factories'];
      // 16.3.0
      deprecated.componentWillMount = [
        '16.3.0',
        'UNSAFE_componentWillMount',
        'https://reactjs.org/docs/react-component.html#unsafe_componentwillmount'
      ];
      deprecated.componentWillReceiveProps = [
        '16.3.0',
        'UNSAFE_componentWillReceiveProps',
        'https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops'
      ];
      deprecated.componentWillUpdate = [
        '16.3.0',
        'UNSAFE_componentWillUpdate',
        'https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate'
      ];
      return deprecated;
    }

    function isDeprecated(method) {
      const deprecated = getDeprecated();

      return (
        deprecated &&
        deprecated[method] &&
        deprecated[method][0] &&
        versionUtil.testReactVersion(context, deprecated[method][0])
      );
    }

    function checkDeprecation(node, methodName, methodNode) {
      if (!isDeprecated(methodName)) {
        return;
      }
      const deprecated = getDeprecated();
      const version = deprecated[methodName][0];
      const newMethod = deprecated[methodName][1];
      const refs = deprecated[methodName][2];
      context.report({
        node: methodNode || node,
        message: DEPRECATED_MESSAGE,
        data: {
          oldMethod: methodName,
          version,
          newMethod: newMethod ? `, use ${newMethod} instead` : '',
          refs: refs ? `, see ${refs}` : ''
        }
      });
    }

    function getReactModuleName(node) {
      let moduleName = false;
      if (!node.init) {
        return moduleName;
      }
      for (const module in MODULES) {
        if (!has(MODULES, module)) {
          continue;
        }
        moduleName = MODULES[module].find(name => name === node.init.name);
        if (moduleName) {
          break;
        }
      }
      return moduleName;
    }

    /**
     * Returns life cycle methods if available
     * @param {ASTNode} node The AST node being checked.
     * @returns {Array} The array of methods.
     */
    function getLifeCycleMethods(node) {
      const properties = astUtil.getComponentProperties(node);
      return properties.map(property => ({
        name: astUtil.getPropertyName(property),
        node: astUtil.getPropertyNameNode(property)
      }));
    }

    /**
     * Checks life cycle methods
     * @param {ASTNode} node The AST node being checked.
     */
    function checkLifeCycleMethods(node) {
      if (utils.isES5Component(node) || utils.isES6Component(node)) {
        const methods = getLifeCycleMethods(node);
        methods.forEach(method => checkDeprecation(node, method.name, method.node));
      }
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {

      MemberExpression: function(node) {
        checkDeprecation(node, sourceCode.getText(node));
      },

      ImportDeclaration: function(node) {
        const isReactImport = typeof MODULES[node.source.value] !== 'undefined';
        if (!isReactImport) {
          return;
        }
        node.specifiers.forEach(specifier => {
          if (!specifier.imported) {
            return;
          }
          checkDeprecation(node, `${MODULES[node.source.value][0]}.${specifier.imported.name}`);
        });
      },

      VariableDeclarator: function(node) {
        const reactModuleName = getReactModuleName(node);
        const isRequire = node.init && node.init.callee && node.init.callee.name === 'require';
        const isReactRequire = node.init
          && node.init.arguments
          && node.init.arguments.length
          && typeof MODULES[node.init.arguments[0].value] !== 'undefined';
        const isDestructuring = node.id && node.id.type === 'ObjectPattern';

        if (
          !(isDestructuring && reactModuleName) &&
          !(isDestructuring && isRequire && isReactRequire)
        ) {
          return;
        }
        node.id.properties.forEach(property => {
          checkDeprecation(node, `${reactModuleName || pragma}.${property.key.name}`);
        });
      },

      ClassDeclaration: checkLifeCycleMethods,
      ClassExpression: checkLifeCycleMethods,
      ObjectExpression: checkLifeCycleMethods
    };
  })
};
