import React from 'react';
import ReactDOM from 'react-dom';

function getFiber(element) {
  const container = global.document.createElement('div');
  let inst = null;
  class Tester extends React.Component {
    render() {
      inst = this;
      return element;
    }
  }
  ReactDOM.render(React.createElement(Tester), container);
  return inst._reactInternalFiber.child;
}

module.exports = function detectFiberTags() {
  const supportsMode = typeof React.StrictMode !== 'undefined';
  const supportsContext = typeof React.createContext !== 'undefined';
  const supportsForwardRef = typeof React.forwardRef !== 'undefined';

  function Fn() {
    return null;
  }
  // eslint-disable-next-line react/prefer-stateless-function
  class Cls extends React.Component {
    render() {
      return null;
    }
  }
  let Ctx = null;
  let FwdRef = null;
  if (supportsContext) {
    Ctx = React.createContext();
  }
  if (supportsForwardRef) {
    // React will warn if we don't have both arguments.
    // eslint-disable-next-line no-unused-vars
    FwdRef = React.forwardRef((props, ref) => null);
  }

  return {
    HostRoot: getFiber('test').return.return.tag, // Go two levels above to find the root
    ClassComponent: getFiber(React.createElement(Cls)).tag,
    Fragment: getFiber([['nested']]).tag,
    FunctionalComponent: getFiber(React.createElement(Fn)).tag,
    HostPortal: getFiber(ReactDOM.createPortal(null, global.document.createElement('div'))).tag,
    HostComponent: getFiber(React.createElement('span')).tag,
    HostText: getFiber('text').tag,
    Mode: supportsMode
      ? getFiber(React.createElement(React.StrictMode)).tag
      : -1,
    ContextConsumer: supportsContext
      ? getFiber(React.createElement(Ctx.Consumer, null, () => null)).tag
      : -1,
    ContextProvider: supportsContext
      ? getFiber(React.createElement(Ctx.Provider, { value: null })).tag
      : -1,
    ForwardRef: supportsForwardRef
      ? getFiber(React.createElement(FwdRef)).tag
      : -1,
  };
};
