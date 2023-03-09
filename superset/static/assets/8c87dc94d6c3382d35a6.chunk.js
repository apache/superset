/*! For license information please see 8c87dc94d6c3382d35a6.chunk.js.LICENSE.txt */
(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[452],{82689:(e,t,n)=>{var i=n(29932),r=n(97786),o=n(67206),a=n(69199),s=n(71131),l=n(7518),d=n(85022),c=n(6557),u=n(1469);e.exports=function(e,t,n){t=t.length?i(t,(function(e){return u(e)?function(t){return r(t,1===e.length?e[0]:e)}:e})):[c];var h=-1;t=i(t,l(o));var p=a(e,(function(e,n,r){return{criteria:i(t,(function(t){return t(e)})),index:++h,value:e}}));return s(p,(function(e,t){return d(e,t,n)}))}},71131:e=>{e.exports=function(e,t){var n=e.length;for(e.sort(t);n--;)e[n]=e[n].value;return e}},26393:(e,t,n)=>{var i=n(33448);e.exports=function(e,t){if(e!==t){var n=void 0!==e,r=null===e,o=e==e,a=i(e),s=void 0!==t,l=null===t,d=t==t,c=i(t);if(!l&&!c&&!a&&e>t||a&&s&&d&&!l&&!c||r&&s&&d||!n&&d||!o)return 1;if(!r&&!a&&!c&&e<t||c&&n&&o&&!r&&!a||l&&n&&o||!s&&o||!d)return-1}return 0}},85022:(e,t,n)=>{var i=n(26393);e.exports=function(e,t,n){for(var r=-1,o=e.criteria,a=t.criteria,s=o.length,l=n.length;++r<s;){var d=i(o[r],a[r]);if(d)return r>=l?d:d*("desc"==n[r]?-1:1)}return e.index-t.index}},10752:(e,t,n)=>{var i=n(21078),r=n(35161);e.exports=function(e,t){return i(r(e,t),1/0)}},89734:(e,t,n)=>{var i=n(21078),r=n(82689),o=n(5976),a=n(16612),s=o((function(e,t){if(null==e)return[];var n=t.length;return n>1&&a(e,t[0],t[1])?t=[]:n>2&&a(t[0],t[1],t[2])&&(t=[t[0]]),r(e,i(t,1),[])}));e.exports=s},44908:(e,t,n)=>{var i=n(45652);e.exports=function(e){return e&&e.length?i(e):[]}},9238:(e,t,n)=>{"use strict";n.d(t,{DragLayer:()=>te,DragSource:()=>U,DropTarget:()=>K});var i=n(28195);function r(e){return r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},r(e)}function o(e){return"function"==typeof e}function a(){}function s(e){if(!function(e){return"object"===r(e)&&null!==e}(e))return!1;if(null===Object.getPrototypeOf(e))return!0;for(var t=e;null!==Object.getPrototypeOf(t);)t=Object.getPrototypeOf(t);return Object.getPrototypeOf(e)===t}function l(e){var t=e.current;return null==t?null:t.decoratedRef?t.decoratedRef.current:t}function d(e){return(t=e)&&t.prototype&&"function"==typeof t.prototype.render||function(e){var t;return"Symbol(react.forward_ref)"===(null==e||null===(t=e.$$typeof)||void 0===t?void 0:t.toString())}(e);var t}var c=n(67294),u=n(15047),h=n(8679),p=n.n(h),m=n(82514);function g(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function f(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function v(e,t,n){return t&&f(e.prototype,t),n&&f(e,n),e}var b=function(){var e=function(){function e(t){g(this,e),this.isDisposed=!1,this.action=o(t)?t:a}return v(e,[{key:"dispose",value:function(){this.isDisposed||(this.action(),this.isDisposed=!0)}}],[{key:"isDisposable",value:function(e){return Boolean(e&&o(e.dispose))}},{key:"_fixup",value:function(t){return e.isDisposable(t)?t:e.empty}},{key:"create",value:function(t){return new e(t)}}]),e}();return e.empty={dispose:a},e}(),y=function(){function e(){g(this,e),this.isDisposed=!1;for(var t=arguments.length,n=new Array(t),i=0;i<t;i++)n[i]=arguments[i];this.disposables=n}return v(e,[{key:"add",value:function(e){this.isDisposed?e.dispose():this.disposables.push(e)}},{key:"remove",value:function(e){var t=!1;if(!this.isDisposed){var n=this.disposables.indexOf(e);-1!==n&&(t=!0,this.disposables.splice(n,1),e.dispose())}return t}},{key:"clear",value:function(){if(!this.isDisposed){for(var e=this.disposables.length,t=new Array(e),n=0;n<e;n++)t[n]=this.disposables[n];this.disposables=[];for(var i=0;i<e;i++)t[i].dispose()}}},{key:"dispose",value:function(){if(!this.isDisposed){this.isDisposed=!0;for(var e=this.disposables.length,t=new Array(e),n=0;n<e;n++)t[n]=this.disposables[n];this.disposables=[];for(var i=0;i<e;i++)t[i].dispose()}}}]),e}(),C=function(){function e(){g(this,e),this.isDisposed=!1}return v(e,[{key:"getDisposable",value:function(){return this.current}},{key:"setDisposable",value:function(e){var t=this.isDisposed;if(!t){var n=this.current;this.current=e,n&&n.dispose()}t&&e&&e.dispose()}},{key:"dispose",value:function(){if(!this.isDisposed){this.isDisposed=!0;var e=this.current;this.current=void 0,e&&e.dispose()}}}]),e}();function x(e){return x="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},x(e)}function S(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,i=new Array(t);n<t;n++)i[n]=e[n];return i}function Z(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function w(e,t){return w=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e},w(e,t)}function R(e,t){return!t||"object"!==x(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function k(e){return k=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)},k(e)}function T(e){var t=e.DecoratedComponent,n=e.createHandler,r=e.createMonitor,o=e.createConnector,a=e.registerHandler,s=e.containerDisplayName,l=e.getType,h=e.collect,g=e.options.arePropsEqual,f=void 0===g?u.w:g,v=t,x=t.displayName||t.name||"Component",T=function(){var e=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&w(e,t)}(D,e);var t,s,p,g,T=(p=D,g=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Date.prototype.toString.call(Reflect.construct(Date,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=k(p);if(g){var n=k(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return R(this,e)});function D(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,D),(t=T.call(this,e)).decoratedRef=c.createRef(),t.handleChange=function(){var e=t.getCurrentState();(0,u.w)(e,t.state)||t.setState(e)},t.disposable=new C,t.receiveProps(e),t.dispose(),t}return t=D,(s=[{key:"getHandlerId",value:function(){return this.handlerId}},{key:"getDecoratedComponentInstance",value:function(){return(0,i.k)(this.decoratedRef.current,"In order to access an instance of the decorated component, it must either be a class component or use React.forwardRef()"),this.decoratedRef.current}},{key:"shouldComponentUpdate",value:function(e,t){return!f(e,this.props)||!(0,u.w)(t,this.state)}},{key:"componentDidMount",value:function(){this.disposable=new C,this.currentType=void 0,this.receiveProps(this.props),this.handleChange()}},{key:"componentDidUpdate",value:function(e){f(this.props,e)||(this.receiveProps(this.props),this.handleChange())}},{key:"componentWillUnmount",value:function(){this.dispose()}},{key:"receiveProps",value:function(e){this.handler&&(this.handler.receiveProps(e),this.receiveType(l(e)))}},{key:"receiveType",value:function(e){if(this.handlerMonitor&&this.manager&&this.handlerConnector&&e!==this.currentType){this.currentType=e;var t=(o=a(e,this.handler,this.manager),s=2,function(e){if(Array.isArray(e))return e}(o)||function(e,t){if("undefined"!=typeof Symbol&&Symbol.iterator in Object(e)){var n=[],i=!0,r=!1,o=void 0;try{for(var a,s=e[Symbol.iterator]();!(i=(a=s.next()).done)&&(n.push(a.value),!t||n.length!==t);i=!0);}catch(e){r=!0,o=e}finally{try{i||null==s.return||s.return()}finally{if(r)throw o}}return n}}(o,s)||function(e,t){if(e){if("string"==typeof e)return S(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?S(e,t):void 0}}(o,s)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),n=t[0],i=t[1];this.handlerId=n,this.handlerMonitor.receiveHandlerId(n),this.handlerConnector.receiveHandlerId(n);var r=this.manager.getMonitor().subscribeToStateChange(this.handleChange,{handlerIds:[n]});this.disposable.setDisposable(new y(new b(r),new b(i)))}var o,s}},{key:"dispose",value:function(){this.disposable.dispose(),this.handlerConnector&&this.handlerConnector.receiveHandlerId(null)}},{key:"getCurrentState",value:function(){return this.handlerConnector?h(this.handlerConnector.hooks,this.handlerMonitor,this.props):{}}},{key:"render",value:function(){var e=this;return c.createElement(m.L.Consumer,null,(function(t){var n=t.dragDropManager;return e.receiveDragDropManager(n),"undefined"!=typeof requestAnimationFrame&&requestAnimationFrame((function(){var t;return null===(t=e.handlerConnector)||void 0===t?void 0:t.reconnect()})),c.createElement(v,Object.assign({},e.props,e.getCurrentState(),{ref:d(v)?e.decoratedRef:null}))}))}},{key:"receiveDragDropManager",value:function(e){void 0===this.manager&&((0,i.k)(void 0!==e,"Could not find the drag and drop manager in the context of %s. Make sure to render a DndProvider component in your top-level component. Read more: http://react-dnd.github.io/react-dnd/docs/troubleshooting#could-not-find-the-drag-and-drop-manager-in-the-context",x,x),void 0!==e&&(this.manager=e,this.handlerMonitor=r(e),this.handlerConnector=o(e.getBackend()),this.handler=n(this.handlerMonitor,this.decoratedRef)))}}])&&Z(t.prototype,s),D}(c.Component);return e.DecoratedComponent=t,e.displayName="".concat(s,"(").concat(x,")"),e}();return p()(T,t)}var D=n(33273),I=n(60938),_=n(8556);function $(e){return $="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},$(e)}function F(e,t){return"string"==typeof e||"symbol"===$(e)||!!t&&Array.isArray(e)&&e.every((function(e){return F(e,!1)}))}function M(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}var E=["canDrag","beginDrag","isDragging","endDrag"],O=["beginDrag"],z=function(){function e(t,n,i){var r=this;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.props=null,this.beginDrag=function(){if(r.props)return r.spec.beginDrag(r.props,r.monitor,r.ref.current)},this.spec=t,this.monitor=n,this.ref=i}var t,n;return t=e,(n=[{key:"receiveProps",value:function(e){this.props=e}},{key:"canDrag",value:function(){return!!this.props&&(!this.spec.canDrag||this.spec.canDrag(this.props,this.monitor))}},{key:"isDragging",value:function(e,t){return!!this.props&&(this.spec.isDragging?this.spec.isDragging(this.props,this.monitor):t===e.getSourceId())}},{key:"endDrag",value:function(){this.props&&this.spec.endDrag&&this.spec.endDrag(this.props,this.monitor,l(this.ref))}}])&&M(t.prototype,n),e}();function P(e){return Object.keys(e).forEach((function(t){(0,i.k)(E.indexOf(t)>-1,'Expected the drag source specification to only have some of the following keys: %s. Instead received a specification with an unexpected "%s" key. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source',E.join(", "),t),(0,i.k)("function"==typeof e[t],"Expected %s in the drag source specification to be a function. Instead received a specification with %s: %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source",t,t,e[t])})),O.forEach((function(t){(0,i.k)("function"==typeof e[t],"Expected %s in the drag source specification to be a function. Instead received a specification with %s: %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source",t,t,e[t])})),function(t,n){return new z(e,t,n)}}function U(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},o=e;"function"!=typeof e&&((0,i.k)(F(e),'Expected "type" provided as the first argument to DragSource to be a string, or a function that returns a string given the current props. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source',e),o=function(){return e}),(0,i.k)(s(t),'Expected "spec" provided as the second argument to DragSource to be a plain object. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source',t);var a=P(t);return(0,i.k)("function"==typeof n,'Expected "collect" provided as the third argument to DragSource to be a function that returns a plain object of props to inject. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source',n),(0,i.k)(s(r),'Expected "options" provided as the fourth argument to DragSource to be a plain object when specified. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source',n),function(e){return T({containerDisplayName:"DragSource",createHandler:a,registerHandler:D.w,createConnector:function(e){return new _.x(e)},createMonitor:function(e){return new I.p(e)},DecoratedComponent:e,getType:o,collect:n,options:r})}}var N=n(89026),q=n(56941);function A(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}var L=["canDrop","hover","drop"],j=function(){function e(t,n,i){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.props=null,this.spec=t,this.monitor=n,this.ref=i}var t,n;return t=e,(n=[{key:"receiveProps",value:function(e){this.props=e}},{key:"receiveMonitor",value:function(e){this.monitor=e}},{key:"canDrop",value:function(){return!this.spec.canDrop||this.spec.canDrop(this.props,this.monitor)}},{key:"hover",value:function(){this.spec.hover&&this.props&&this.spec.hover(this.props,this.monitor,l(this.ref))}},{key:"drop",value:function(){if(this.spec.drop)return this.spec.drop(this.props,this.monitor,this.ref.current)}}])&&A(t.prototype,n),e}();function V(e){return Object.keys(e).forEach((function(t){(0,i.k)(L.indexOf(t)>-1,'Expected the drop target specification to only have some of the following keys: %s. Instead received a specification with an unexpected "%s" key. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target',L.join(", "),t),(0,i.k)("function"==typeof e[t],"Expected %s in the drop target specification to be a function. Instead received a specification with %s: %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target",t,t,e[t])})),function(t,n){return new j(e,t,n)}}function K(e,t,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},o=e;"function"!=typeof e&&((0,i.k)(F(e,!0),'Expected "type" provided as the first argument to DropTarget to be a string, an array of strings, or a function that returns either given the current props. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target',e),o=function(){return e}),(0,i.k)(s(t),'Expected "spec" provided as the second argument to DropTarget to be a plain object. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target',t);var a=V(t);return(0,i.k)("function"==typeof n,'Expected "collect" provided as the third argument to DropTarget to be a function that returns a plain object of props to inject. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target',n),(0,i.k)(s(r),'Expected "options" provided as the fourth argument to DropTarget to be a plain object when specified. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target',n),function(e){return T({containerDisplayName:"DropTarget",createHandler:a,registerHandler:D.n,createMonitor:function(e){return new q.H(e)},createConnector:function(e){return new N.Y(e)},DecoratedComponent:e,getType:o,collect:n,options:r})}}function B(e){return B="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},B(e)}function H(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function W(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function Y(e,t,n){return t&&W(e.prototype,t),n&&W(e,n),e}function J(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&G(e,t)}function G(e,t){return G=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e},G(e,t)}function Q(e){var t=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Date.prototype.toString.call(Reflect.construct(Date,[],(function(){}))),!0}catch(e){return!1}}();return function(){var n,i=ee(e);if(t){var r=ee(this).constructor;n=Reflect.construct(i,arguments,r)}else n=i.apply(this,arguments);return X(this,n)}}function X(e,t){return!t||"object"!==B(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function ee(e){return ee=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)},ee(e)}function te(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return(0,i.k)("function"==typeof e,'Expected "collect" provided as the first argument to DragLayer to be a function that collects props to inject into the component. ',"Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-layer",e),(0,i.k)(s(t),'Expected "options" provided as the second argument to DragLayer to be a plain object when specified. Instead, received %s. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-layer',t),function(n){var r=n,o=t.arePropsEqual,a=void 0===o?u.w:o,s=r.displayName||r.name||"Component",l=function(){var t=function(t){J(o,t);var n=Q(o);function o(){var e;return H(this,o),(e=n.apply(this,arguments)).isCurrentlyMounted=!1,e.ref=c.createRef(),e.handleChange=function(){if(e.isCurrentlyMounted){var t=e.getCurrentState();(0,u.w)(t,e.state)||e.setState(t)}},e}return Y(o,[{key:"getDecoratedComponentInstance",value:function(){return(0,i.k)(this.ref.current,"In order to access an instance of the decorated component, it must either be a class component or use React.forwardRef()"),this.ref.current}},{key:"shouldComponentUpdate",value:function(e,t){return!a(e,this.props)||!(0,u.w)(t,this.state)}},{key:"componentDidMount",value:function(){this.isCurrentlyMounted=!0,this.handleChange()}},{key:"componentWillUnmount",value:function(){this.isCurrentlyMounted=!1,this.unsubscribeFromOffsetChange&&(this.unsubscribeFromOffsetChange(),this.unsubscribeFromOffsetChange=void 0),this.unsubscribeFromStateChange&&(this.unsubscribeFromStateChange(),this.unsubscribeFromStateChange=void 0)}},{key:"render",value:function(){var e=this;return c.createElement(m.L.Consumer,null,(function(t){var n=t.dragDropManager;return void 0===n?null:(e.receiveDragDropManager(n),e.isCurrentlyMounted?c.createElement(r,Object.assign({},e.props,e.state,{ref:d(r)?e.ref:null})):null)}))}},{key:"receiveDragDropManager",value:function(e){if(void 0===this.manager){this.manager=e,(0,i.k)("object"===B(e),"Could not find the drag and drop manager in the context of %s. Make sure to render a DndProvider component in your top-level component. Read more: http://react-dnd.github.io/react-dnd/docs/troubleshooting#could-not-find-the-drag-and-drop-manager-in-the-context",s,s);var t=this.manager.getMonitor();this.unsubscribeFromOffsetChange=t.subscribeToOffsetChange(this.handleChange),this.unsubscribeFromStateChange=t.subscribeToStateChange(this.handleChange)}}},{key:"getCurrentState",value:function(){if(!this.manager)return{};var t=this.manager.getMonitor();return e(t,this.props)}}]),o}(c.Component);return t.displayName="DragLayer(".concat(s,")"),t.DecoratedComponent=n,t}();return p()(l,n)}}},84785:(e,t,n)=>{"use strict";n.d(t,{DragLayer:()=>r.DragLayer,DragSource:()=>r.DragSource,DropTarget:()=>r.DropTarget});var i=n(31388);n.o(i,"DragLayer")&&n.d(t,{DragLayer:function(){return i.DragLayer}}),n.o(i,"DragSource")&&n.d(t,{DragSource:function(){return i.DragSource}}),n.o(i,"DropTarget")&&n.d(t,{DropTarget:function(){return i.DropTarget}});var r=n(9238)},54238:()=>{},48058:()=>{},31388:(e,t,n)=>{"use strict";var i=n(75253);n.o(i,"DragLayer")&&n.d(t,{DragLayer:function(){return i.DragLayer}}),n.o(i,"DragSource")&&n.d(t,{DragSource:function(){return i.DragSource}}),n.o(i,"DropTarget")&&n.d(t,{DropTarget:function(){return i.DropTarget}});var r=n(48058);n.o(r,"DragLayer")&&n.d(t,{DragLayer:function(){return r.DragLayer}}),n.o(r,"DragSource")&&n.d(t,{DragSource:function(){return r.DragSource}}),n.o(r,"DropTarget")&&n.d(t,{DropTarget:function(){return r.DropTarget}});var o=n(72105);n.o(o,"DragLayer")&&n.d(t,{DragLayer:function(){return o.DragLayer}}),n.o(o,"DragSource")&&n.d(t,{DragSource:function(){return o.DragSource}}),n.o(o,"DropTarget")&&n.d(t,{DropTarget:function(){return o.DropTarget}});var a=n(54238);n.o(a,"DragLayer")&&n.d(t,{DragLayer:function(){return a.DragLayer}}),n.o(a,"DragSource")&&n.d(t,{DragSource:function(){return a.DragSource}}),n.o(a,"DropTarget")&&n.d(t,{DropTarget:function(){return a.DropTarget}})},75253:()=>{},72105:()=>{},24903:(e,t,n)=>{"use strict";t.cj=void 0;var i=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),r=n(67294),o=l(r),a=l(n(45697)),s=n(76597);function l(e){return e&&e.__esModule?e:{default:e}}var d=function(e){function t(e){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t);var n=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}(this,(t.__proto__||Object.getPrototypeOf(t)).call(this,e));return n.state={searchTerm:n.props.value||""},n.updateSearch=n.updateSearch.bind(n),n.filter=n.filter.bind(n),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}(t,e),i(t,[{key:"componentWillReceiveProps",value:function(e){if(void 0!==e.value&&e.value!==this.props.value){var t={target:{value:e.value}};this.updateSearch(t)}}},{key:"render",value:function(){var e=this.props,t=e.className,n=(e.onChange,e.caseSensitive,e.sortResults,e.throttle,e.filterKeys,e.value,e.fuzzy,e.inputClassName),i=function(e,t){var n={};for(var i in e)t.indexOf(i)>=0||Object.prototype.hasOwnProperty.call(e,i)&&(n[i]=e[i]);return n}(e,["className","onChange","caseSensitive","sortResults","throttle","filterKeys","value","fuzzy","inputClassName"]);return i.type=i.type||"search",i.value=this.state.searchTerm,i.onChange=this.updateSearch,i.className=n,i.placeholder=i.placeholder||"Search",o.default.createElement("div",{className:t},o.default.createElement("input",i))}},{key:"updateSearch",value:function(e){var t=this,n=e.target.value;this.setState({searchTerm:n},(function(){t._throttleTimeout&&clearTimeout(t._throttleTimeout),t._throttleTimeout=setTimeout((function(){return t.props.onChange(n)}),t.props.throttle)}))}},{key:"filter",value:function(e){var t=this.props,n=t.filterKeys,i=t.caseSensitive,r=t.fuzzy,o=t.sortResults;return(0,s.createFilter)(this.state.searchTerm,e||n,{caseSensitive:i,fuzzy:r,sortResults:o})}}]),t}(r.Component);d.defaultProps={className:"",onChange:function(){},caseSensitive:!1,fuzzy:!1,throttle:200},d.propTypes={className:a.default.string,inputClassName:a.default.string,onChange:a.default.func,caseSensitive:a.default.bool,sortResults:a.default.bool,fuzzy:a.default.bool,throttle:a.default.number,filterKeys:a.default.oneOf([a.default.string,a.default.arrayOf(a.default.string)]),value:a.default.string},t.cj=s.createFilter},76597:(e,t,n)=>{"use strict";Object.defineProperty(t,"__esModule",{value:!0}),t.getValuesForKey=a,t.searchStrings=s,t.createFilter=function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return function(i){if(""===e)return!0;n.caseSensitive||(e=e.toLowerCase());var r=e.split(" ");return t?("string"==typeof t&&(t=[t]),r.every((function(e){var r=void 0;if(-1!==e.indexOf(":")){var o=e.split(":")[0];e=e.split(":")[1],r=t.filter((function(e){return e.toLowerCase().indexOf(o)>-1}))}else r=t;return r.some((function(t){return s(a(t,i),e,n)}))}))):r.every((function(e){return s([i],e,n)}))}};var i,r=(i=n(69021))&&i.__esModule?i:{default:i};function o(e){return e.reduce((function(e,t){return e.concat(Array.isArray(t)?o(t):t)}),[])}function a(e,t){var n=e.split("."),i=[t];return n.forEach((function(e){var t=[];i.forEach((function(n){if(n)if(n instanceof Array){var i=parseInt(e,10);if(!isNaN(i))return t.push(n[i]);n.forEach((function(n){t.push(n[e])}))}else n&&"function"==typeof n.get?t.push(n.get(e)):t.push(n[e])})),i=t})),(i=o(i=i.map((function(e){return e&&e.push&&e.toArray?e.toArray():e})))).filter((function(e){return"string"==typeof e||"number"==typeof e}))}function s(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},i=n.caseSensitive,o=n.fuzzy,a=n.sortResults,s=n.exactMatch;e=e.map((function(e){return e.toString()}));try{if(o){"function"==typeof e.toJS&&(e=e.toJS());var l=new r.default(e.map((function(e){return{id:e}})),{keys:["id"],id:"id",caseSensitive:i,shouldSort:a});return l.search(t).length}return e.some((function(e){try{return i||(e=e.toLowerCase()),s&&(t=new RegExp("^"+t+"$","i")),!(!e||-1===e.search(t))}catch(e){return!1}}))}catch(e){return!1}}},69021:function(e){e.exports=function(e){var t={};function n(i){if(t[i])return t[i].exports;var r=t[i]={i,l:!1,exports:{}};return e[i].call(r.exports,r,r.exports,n),r.l=!0,r.exports}return n.m=e,n.c=t,n.d=function(e,t,i){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:i})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var r in e)n.d(i,r,function(t){return e[t]}.bind(null,r));return i},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=0)}([function(e,t,n){function i(e){return(i="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function r(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}var o=n(1),a=n(7),s=a.get,l=(a.deepValue,a.isArray),d=function(){function e(t,n){var i=n.location,r=void 0===i?0:i,o=n.distance,a=void 0===o?100:o,l=n.threshold,d=void 0===l?.6:l,c=n.maxPatternLength,u=void 0===c?32:c,h=n.caseSensitive,p=void 0!==h&&h,m=n.tokenSeparator,g=void 0===m?/ +/g:m,f=n.findAllMatches,v=void 0!==f&&f,b=n.minMatchCharLength,y=void 0===b?1:b,C=n.id,x=void 0===C?null:C,S=n.keys,Z=void 0===S?[]:S,w=n.shouldSort,R=void 0===w||w,k=n.getFn,T=void 0===k?s:k,D=n.sortFn,I=void 0===D?function(e,t){return e.score-t.score}:D,_=n.tokenize,$=void 0!==_&&_,F=n.matchAllTokens,M=void 0!==F&&F,E=n.includeMatches,O=void 0!==E&&E,z=n.includeScore,P=void 0!==z&&z,U=n.verbose,N=void 0!==U&&U;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.options={location:r,distance:a,threshold:d,maxPatternLength:u,isCaseSensitive:p,tokenSeparator:g,findAllMatches:v,minMatchCharLength:y,id:x,keys:Z,includeMatches:O,includeScore:P,shouldSort:R,getFn:T,sortFn:I,verbose:N,tokenize:$,matchAllTokens:M},this.setCollection(t),this._processKeys(Z)}var t,n;return t=e,(n=[{key:"setCollection",value:function(e){return this.list=e,e}},{key:"_processKeys",value:function(e){if(this._keyWeights={},this._keyNames=[],e.length&&"string"==typeof e[0])for(var t=0,n=e.length;t<n;t+=1){var i=e[t];this._keyWeights[i]=1,this._keyNames.push(i)}else{for(var r=null,o=null,a=0,s=0,l=e.length;s<l;s+=1){var d=e[s];if(!d.hasOwnProperty("name"))throw new Error('Missing "name" property in key object');var c=d.name;if(this._keyNames.push(c),!d.hasOwnProperty("weight"))throw new Error('Missing "weight" property in key object');var u=d.weight;if(u<0||u>1)throw new Error('"weight" property in key must bein the range of [0, 1)');o=null==o?u:Math.max(o,u),r=null==r?u:Math.min(r,u),this._keyWeights[c]=u,a+=u}if(a>1)throw new Error("Total of weights cannot exceed 1")}}},{key:"search",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{limit:!1};this._log('---------\nSearch pattern: "'.concat(e,'"'));var n=this._prepareSearchers(e),i=n.tokenSearchers,r=n.fullSearcher,o=this._search(i,r);return this._computeScore(o),this.options.shouldSort&&this._sort(o),t.limit&&"number"==typeof t.limit&&(o=o.slice(0,t.limit)),this._format(o)}},{key:"_prepareSearchers",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=[];if(this.options.tokenize)for(var n=e.split(this.options.tokenSeparator),i=0,r=n.length;i<r;i+=1)t.push(new o(n[i],this.options));return{tokenSearchers:t,fullSearcher:new o(e,this.options)}}},{key:"_search",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[],t=arguments.length>1?arguments[1]:void 0,n=this.list,i={},r=[];if("string"==typeof n[0]){for(var o=0,a=n.length;o<a;o+=1)this._analyze({key:"",value:n[o],record:o,index:o},{resultMap:i,results:r,tokenSearchers:e,fullSearcher:t});return r}for(var s=0,l=n.length;s<l;s+=1)for(var d=n[s],c=0,u=this._keyNames.length;c<u;c+=1){var h=this._keyNames[c];this._analyze({key:h,value:this.options.getFn(d,h),record:d,index:s},{resultMap:i,results:r,tokenSearchers:e,fullSearcher:t})}return r}},{key:"_analyze",value:function(e,t){var n=this,i=e.key,r=e.arrayIndex,o=void 0===r?-1:r,a=e.value,s=e.record,d=e.index,c=t.tokenSearchers,u=void 0===c?[]:c,h=t.fullSearcher,p=t.resultMap,m=void 0===p?{}:p,g=t.results,f=void 0===g?[]:g;!function e(t,r,o,a){if(null!=r)if("string"==typeof r){var s=!1,d=-1,c=0;n._log("\nKey: ".concat(""===i?"--":i));var p=h.search(r);if(n._log('Full text: "'.concat(r,'", score: ').concat(p.score)),n.options.tokenize){for(var g=r.split(n.options.tokenSeparator),v=g.length,b=[],y=0,C=u.length;y<C;y+=1){var x=u[y];n._log('\nPattern: "'.concat(x.pattern,'"'));for(var S=!1,Z=0;Z<v;Z+=1){var w=g[Z],R=x.search(w),k={};R.isMatch?(k[w]=R.score,s=!0,S=!0,b.push(R.score)):(k[w]=1,n.options.matchAllTokens||b.push(1)),n._log('Token: "'.concat(w,'", score: ').concat(k[w]))}S&&(c+=1)}d=b[0];for(var T=b.length,D=1;D<T;D+=1)d+=b[D];d/=T,n._log("Token score average:",d)}var I=p.score;d>-1&&(I=(I+d)/2),n._log("Score average:",I);var _=!n.options.tokenize||!n.options.matchAllTokens||c>=u.length;if(n._log("\nCheck Matches: ".concat(_)),(s||p.isMatch)&&_){var $={key:i,arrayIndex:t,value:r,score:I};n.options.includeMatches&&($.matchedIndices=p.matchedIndices);var F=m[a];F?F.output.push($):(m[a]={item:o,output:[$]},f.push(m[a]))}}else if(l(r))for(var M=0,E=r.length;M<E;M+=1)e(M,r[M],o,a)}(o,a,s,d)}},{key:"_computeScore",value:function(e){this._log("\n\nComputing score:\n");for(var t=this._keyWeights,n=!!Object.keys(t).length,i=0,r=e.length;i<r;i+=1){for(var o=e[i],a=o.output,s=a.length,l=1,d=0;d<s;d+=1){var c=a[d],u=c.key,h=n?t[u]:1,p=0===c.score&&t&&t[u]>0?Number.EPSILON:c.score;l*=Math.pow(p,h)}o.score=l,this._log(o)}}},{key:"_sort",value:function(e){this._log("\n\nSorting...."),e.sort(this.options.sortFn)}},{key:"_format",value:function(e){var t=[];if(this.options.verbose){var n=[];this._log("\n\nOutput:\n\n",JSON.stringify(e,(function(e,t){if("object"===i(t)&&null!==t){if(-1!==n.indexOf(t))return;n.push(t)}return t}),2)),n=null}var r=[];this.options.includeMatches&&r.push((function(e,t){var n=e.output;t.matches=[];for(var i=0,r=n.length;i<r;i+=1){var o=n[i];if(0!==o.matchedIndices.length){var a={indices:o.matchedIndices,value:o.value};o.key&&(a.key=o.key),o.hasOwnProperty("arrayIndex")&&o.arrayIndex>-1&&(a.arrayIndex=o.arrayIndex),t.matches.push(a)}}})),this.options.includeScore&&r.push((function(e,t){t.score=e.score}));for(var o=0,a=e.length;o<a;o+=1){var s=e[o];if(this.options.id&&(s.item=this.options.getFn(s.item,this.options.id)[0]),r.length){for(var l={item:s.item},d=0,c=r.length;d<c;d+=1)r[d](s,l);t.push(l)}else t.push(s.item)}return t}},{key:"_log",value:function(){var e;this.options.verbose&&(e=console).log.apply(e,arguments)}}])&&r(t.prototype,n),e}();e.exports=d},function(e,t,n){function i(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}var r=n(2),o=n(3),a=n(6),s=function(){function e(t,n){var i=n.location,r=void 0===i?0:i,o=n.distance,s=void 0===o?100:o,l=n.threshold,d=void 0===l?.6:l,c=n.maxPatternLength,u=void 0===c?32:c,h=n.isCaseSensitive,p=void 0!==h&&h,m=n.tokenSeparator,g=void 0===m?/ +/g:m,f=n.findAllMatches,v=void 0!==f&&f,b=n.minMatchCharLength,y=void 0===b?1:b,C=n.includeMatches,x=void 0!==C&&C;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.options={location:r,distance:s,threshold:d,maxPatternLength:u,isCaseSensitive:p,tokenSeparator:g,findAllMatches:v,includeMatches:x,minMatchCharLength:y},this.pattern=p?t:t.toLowerCase(),this.pattern.length<=u&&(this.patternAlphabet=a(this.pattern))}var t,n;return t=e,(n=[{key:"search",value:function(e){var t=this.options,n=t.isCaseSensitive,i=t.includeMatches;if(n||(e=e.toLowerCase()),this.pattern===e){var a={isMatch:!0,score:0};return i&&(a.matchedIndices=[[0,e.length-1]]),a}var s=this.options,l=s.maxPatternLength,d=s.tokenSeparator;if(this.pattern.length>l)return r(e,this.pattern,d);var c=this.options,u=c.location,h=c.distance,p=c.threshold,m=c.findAllMatches,g=c.minMatchCharLength;return o(e,this.pattern,this.patternAlphabet,{location:u,distance:h,threshold:p,findAllMatches:m,minMatchCharLength:g,includeMatches:i})}}])&&i(t.prototype,n),e}();e.exports=s},function(e,t){var n=/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g;e.exports=function(e,t){var i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:/ +/g,r=new RegExp(t.replace(n,"\\$&").replace(i,"|")),o=e.match(r),a=!!o,s=[];if(a)for(var l=0,d=o.length;l<d;l+=1){var c=o[l];s.push([e.indexOf(c),c.length-1])}return{score:a?.5:1,isMatch:a,matchedIndices:s}}},function(e,t,n){var i=n(4),r=n(5);e.exports=function(e,t,n,o){for(var a=o.location,s=void 0===a?0:a,l=o.distance,d=void 0===l?100:l,c=o.threshold,u=void 0===c?.6:c,h=o.findAllMatches,p=void 0!==h&&h,m=o.minMatchCharLength,g=void 0===m?1:m,f=o.includeMatches,v=void 0!==f&&f,b=s,y=e.length,C=u,x=e.indexOf(t,b),S=t.length,Z=[],w=0;w<y;w+=1)Z[w]=0;if(-1!==x){var R=i(t,{errors:0,currentLocation:x,expectedLocation:b,distance:d});if(C=Math.min(R,C),-1!==(x=e.lastIndexOf(t,b+S))){var k=i(t,{errors:0,currentLocation:x,expectedLocation:b,distance:d});C=Math.min(k,C)}}x=-1;for(var T=[],D=1,I=S+y,_=1<<(S<=31?S-1:30),$=0;$<S;$+=1){for(var F=0,M=I;F<M;)i(t,{errors:$,currentLocation:b+M,expectedLocation:b,distance:d})<=C?F=M:I=M,M=Math.floor((I-F)/2+F);I=M;var E=Math.max(1,b-M+1),O=p?y:Math.min(b+M,y)+S,z=Array(O+2);z[O+1]=(1<<$)-1;for(var P=O;P>=E;P-=1){var U=P-1,N=n[e.charAt(U)];if(N&&(Z[U]=1),z[P]=(z[P+1]<<1|1)&N,0!==$&&(z[P]|=(T[P+1]|T[P])<<1|1|T[P+1]),z[P]&_&&(D=i(t,{errors:$,currentLocation:U,expectedLocation:b,distance:d}))<=C){if(C=D,(x=U)<=b)break;E=Math.max(1,2*b-x)}}if(i(t,{errors:$+1,currentLocation:b,expectedLocation:b,distance:d})>C)break;T=z}var q={isMatch:x>=0,score:0===D?.001:D};return v&&(q.matchedIndices=r(Z,g)),q}},function(e,t){e.exports=function(e,t){var n=t.errors,i=void 0===n?0:n,r=t.currentLocation,o=void 0===r?0:r,a=t.expectedLocation,s=void 0===a?0:a,l=t.distance,d=void 0===l?100:l,c=i/e.length,u=Math.abs(s-o);return d?c+u/d:u?1:c}},function(e,t){e.exports=function(){for(var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[],t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,n=[],i=-1,r=-1,o=0,a=e.length;o<a;o+=1){var s=e[o];s&&-1===i?i=o:s||-1===i||((r=o-1)-i+1>=t&&n.push([i,r]),i=-1)}return e[o-1]&&o-i>=t&&n.push([i,o-1]),n}},function(e,t){e.exports=function(e){for(var t={},n=e.length,i=0;i<n;i+=1)t[e.charAt(i)]=0;for(var r=0;r<n;r+=1)t[e.charAt(r)]|=1<<n-r-1;return t}},function(e,t){var n=function(e){return Array.isArray?Array.isArray(e):"[object Array]"===Object.prototype.toString.call(e)},i=function(e){return null==e?"":function(e){if("string"==typeof e)return e;var t=e+"";return"0"==t&&1/e==-1/0?"-0":t}(e)},r=function(e){return"string"==typeof e},o=function(e){return"number"==typeof e};e.exports={get:function(e,t){var a=[];return function e(t,s){if(s){var l=s.indexOf("."),d=s,c=null;-1!==l&&(d=s.slice(0,l),c=s.slice(l+1));var u=t[d];if(null!=u)if(c||!r(u)&&!o(u))if(n(u))for(var h=0,p=u.length;h<p;h+=1)e(u[h],c);else c&&e(u,c);else a.push(i(u))}else a.push(t)}(e,t),a},isArray:n,isString:r,isNum:o,toString:i}}])},82607:(e,t,n)=>{"use strict";n.d(t,{Z:()=>l});var i=n(5872),r=n.n(i),o=(n(67294),n(51995)),a=n(62529),s=n(11965);const l=(0,o.iK)((e=>{let{textColor:t,color:n,text:i,...o}=e;return(0,s.tZ)(a.Z,r()({text:i,color:i?n:void 0},o))}))`
  & > sup {
    padding: 0 ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    background: ${e=>{let{theme:t,color:n}=e;return n||t.colors.primary.base}};
    color: ${e=>{let{theme:t,textColor:n}=e;return n||t.colors.grayscale.light5}};
  }
`},38270:(e,t,n)=>{"use strict";n.d(t,{Z:()=>g});var i=n(5872),r=n.n(i),o=n(67294),a=n(73727),s=n(94184),l=n.n(s),d=n(51995),c=n(55867),u=n(11965),h=n(58593),p=n(79789);const m=(0,d.iK)(p.Z)`
  vertical-align: middle;
`;function g(e){let{canEdit:t=!1,editing:n=!1,extraClasses:i,multiLine:s=!1,noPermitTooltip:d,onSaveTitle:p,showTooltip:g=!0,style:f,title:v="",defaultTitle:b="",placeholder:y="",certifiedBy:C,certificationDetails:x,url:S,...Z}=e;const[w,R]=(0,o.useState)(n),[k,T]=(0,o.useState)(v),[D,I]=(0,o.useState)(v),[_,$]=(0,o.useState)(null),F=(0,o.useRef)();function M(){if(!t||w)return;const e=F.current?F.current.getBoundingClientRect():null;R(!0),$(e)}function E(){const e=k.trim();t&&(R(!1),e.length?(D!==e&&I(e),v!==e&&p(e)):T(D))}function O(e){" "===e.key&&e.stopPropagation(),"Enter"===e.key&&(e.preventDefault(),E())}function z(e){t&&T(e.target.value)}function P(e){"Enter"===e.key&&(e.preventDefault(),E())}let U;(0,o.useEffect)((()=>{v!==k&&(I(k),T(v))}),[v]),(0,o.useEffect)((()=>{if(w&&(F.current.focus(),F.current.setSelectionRange)){const{length:e}=F.current.value;F.current.setSelectionRange(e,e),F.current.scrollLeft=F.current.scrollWidth,F.current.scrollTop=F.current.scrollHeight}}),[w]),U=k,w||k||(U=b||v);const N=w&&_?{height:`${_.height}px`}:void 0;let q=s&&w?(0,u.tZ)("textarea",{ref:F,value:U,className:v?void 0:"text-muted",onKeyDown:O,onChange:z,onBlur:E,onClick:M,onKeyPress:P,placeholder:y,style:N}):(0,u.tZ)("input",{ref:F,type:w?"text":"button",value:U,className:v?void 0:"text-muted",onKeyDown:O,onChange:z,onBlur:E,onClick:M,onKeyPress:P,placeholder:y});return g&&!w&&(q=(0,u.tZ)(h.u,{id:"title-tooltip",title:t?(0,c.t)("Click to edit"):d||(0,c.t)("You don't have the rights to alter this title.")},q)),t||(q=S?(0,u.tZ)(a.rU,{to:S,css:e=>u.iv`
          color: ${e.colors.grayscale.dark1};
          text-decoration: none;
          :hover {
            text-decoration: underline;
          }
        `},U):(0,u.tZ)("span",null,U)),(0,u.tZ)("span",r()({className:l()("editable-title",i,t&&"editable-title--editable",w&&"editable-title--editing"),style:f},Z),C&&(0,u.tZ)(o.Fragment,null,(0,u.tZ)(m,{certifiedBy:C,details:x,size:"xl"})," "),q)}},85931:(e,t,n)=>{"use strict";n.d(t,{m:()=>l});var i=n(5872),r=n.n(i),o=(n(67294),n(73727)),a=n(23525),s=n(11965);const l=e=>{let{to:t,component:n,replace:i,innerRef:l,children:d,...c}=e;return"string"==typeof t&&(0,a.TO)(t)?(0,s.tZ)("a",r()({href:(0,a.en)(t)},c),d):(0,s.tZ)(o.rU,r()({to:t,component:n,replace:i,innerRef:l},c),d)}},70955:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>wh});var i=n(14890),r=n(28216),o=n(78580),a=n.n(o),s=n(67294),l=n(45697),d=n.n(l),c=n(55867),u=n(93185),h=n(14278),p=n(38703),m=n(20292),g=n(81255);function f(e){return Object.values(e).reduce(((e,t)=>(t&&t.type===g.dW&&t.meta&&t.meta.chartId&&e.push(t.meta.chartId),e)),[])}var v=n(94184),b=n.n(v),y=n(51995),C=n(11965),x=n(25130),S=n(57902),Z=n(49484),w=n(71262),R=n(68969),k=n(23279),T=n.n(k),D=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")},I=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),_=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)Object.prototype.hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},$=function(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t},F=void 0;F="undefined"!=typeof window?window:"undefined"!=typeof self?self:n.g;var M=null,E=null,O=F.clearTimeout,z=F.setTimeout,P=F.cancelAnimationFrame||F.mozCancelAnimationFrame||F.webkitCancelAnimationFrame,U=F.requestAnimationFrame||F.mozRequestAnimationFrame||F.webkitRequestAnimationFrame;null==P||null==U?(M=O,E=function(e){return z(e,20)}):(M=function(e){var t=function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var n=[],i=!0,r=!1,o=void 0;try{for(var a,s=e[Symbol.iterator]();!(i=(a=s.next()).done)&&(n.push(a.value),!t||n.length!==t);i=!0);}catch(e){r=!0,o=e}finally{try{!i&&s.return&&s.return()}finally{if(r)throw o}}return n}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}(e,2),n=t[0],i=t[1];P(n),O(i)},E=function(e){var t=U((function(){O(n),e()})),n=z((function(){P(t),e()}),20);return[t,n]});var N=function(e){function t(){var e,n,i;D(this,t);for(var r=arguments.length,o=Array(r),a=0;a<r;a++)o[a]=arguments[a];return n=i=$(this,(e=t.__proto__||Object.getPrototypeOf(t)).call.apply(e,[this].concat(o))),i.state={height:i.props.defaultHeight||0,width:i.props.defaultWidth||0},i._onResize=function(){var e=i.props,t=e.disableHeight,n=e.disableWidth,r=e.onResize;if(i._parentNode){var o=i._parentNode.offsetHeight||0,a=i._parentNode.offsetWidth||0,s=window.getComputedStyle(i._parentNode)||{},l=parseInt(s.paddingLeft,10)||0,d=parseInt(s.paddingRight,10)||0,c=parseInt(s.paddingTop,10)||0,u=parseInt(s.paddingBottom,10)||0,h=o-c-u,p=a-l-d;(!t&&i.state.height!==h||!n&&i.state.width!==p)&&(i.setState({height:o-c-u,width:a-l-d}),r({height:o,width:a}))}},i._setRef=function(e){i._autoSizer=e},$(i,n)}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}(t,e),I(t,[{key:"componentDidMount",value:function(){var e=this.props.nonce;this._autoSizer&&this._autoSizer.parentNode&&this._autoSizer.parentNode.ownerDocument&&this._autoSizer.parentNode.ownerDocument.defaultView&&this._autoSizer.parentNode instanceof this._autoSizer.parentNode.ownerDocument.defaultView.HTMLElement&&(this._parentNode=this._autoSizer.parentNode,this._detectElementResize=function(e){var t=void 0,n=void 0,i=void 0,r=void 0,o=void 0,a=void 0,s=void 0,l="undefined"!=typeof document&&document.attachEvent;if(!l){a=function(e){var t=e.__resizeTriggers__,n=t.firstElementChild,i=t.lastElementChild,r=n.firstElementChild;i.scrollLeft=i.scrollWidth,i.scrollTop=i.scrollHeight,r.style.width=n.offsetWidth+1+"px",r.style.height=n.offsetHeight+1+"px",n.scrollLeft=n.scrollWidth,n.scrollTop=n.scrollHeight},o=function(e){return e.offsetWidth!==e.__resizeLast__.width||e.offsetHeight!==e.__resizeLast__.height},s=function(e){if(!(e.target.className&&"function"==typeof e.target.className.indexOf&&e.target.className.indexOf("contract-trigger")<0&&e.target.className.indexOf("expand-trigger")<0)){var t=this;a(this),this.__resizeRAF__&&M(this.__resizeRAF__),this.__resizeRAF__=E((function(){o(t)&&(t.__resizeLast__.width=t.offsetWidth,t.__resizeLast__.height=t.offsetHeight,t.__resizeListeners__.forEach((function(n){n.call(t,e)})))}))}};var d=!1,c="";i="animationstart";var u="Webkit Moz O ms".split(" "),h="webkitAnimationStart animationstart oAnimationStart MSAnimationStart".split(" "),p=document.createElement("fakeelement");if(void 0!==p.style.animationName&&(d=!0),!1===d)for(var m=0;m<u.length;m++)if(void 0!==p.style[u[m]+"AnimationName"]){c="-"+u[m].toLowerCase()+"-",i=h[m],d=!0;break}t="@"+c+"keyframes "+(n="resizeanim")+" { from { opacity: 0; } to { opacity: 0; } } ",r=c+"animation: 1ms "+n+"; "}return{addResizeListener:function(o,d){if(l)o.attachEvent("onresize",d);else{if(!o.__resizeTriggers__){var c=o.ownerDocument,u=F.getComputedStyle(o);u&&"static"===u.position&&(o.style.position="relative"),function(n){if(!n.getElementById("detectElementResize")){var i=(t||"")+".resize-triggers { "+(r||"")+'visibility: hidden; opacity: 0; } .resize-triggers, .resize-triggers > div, .contract-trigger:before { content: " "; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; z-index: -1; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }',o=n.head||n.getElementsByTagName("head")[0],a=n.createElement("style");a.id="detectElementResize",a.type="text/css",null!=e&&a.setAttribute("nonce",e),a.styleSheet?a.styleSheet.cssText=i:a.appendChild(n.createTextNode(i)),o.appendChild(a)}}(c),o.__resizeLast__={},o.__resizeListeners__=[],(o.__resizeTriggers__=c.createElement("div")).className="resize-triggers";var h=c.createElement("div");h.className="expand-trigger",h.appendChild(c.createElement("div"));var p=c.createElement("div");p.className="contract-trigger",o.__resizeTriggers__.appendChild(h),o.__resizeTriggers__.appendChild(p),o.appendChild(o.__resizeTriggers__),a(o),o.addEventListener("scroll",s,!0),i&&(o.__resizeTriggers__.__animationListener__=function(e){e.animationName===n&&a(o)},o.__resizeTriggers__.addEventListener(i,o.__resizeTriggers__.__animationListener__))}o.__resizeListeners__.push(d)}},removeResizeListener:function(e,t){if(l)e.detachEvent("onresize",t);else if(e.__resizeListeners__.splice(e.__resizeListeners__.indexOf(t),1),!e.__resizeListeners__.length){e.removeEventListener("scroll",s,!0),e.__resizeTriggers__.__animationListener__&&(e.__resizeTriggers__.removeEventListener(i,e.__resizeTriggers__.__animationListener__),e.__resizeTriggers__.__animationListener__=null);try{e.__resizeTriggers__=!e.removeChild(e.__resizeTriggers__)}catch(e){}}}}}(e),this._detectElementResize.addResizeListener(this._parentNode,this._onResize),this._onResize())}},{key:"componentWillUnmount",value:function(){this._detectElementResize&&this._parentNode&&this._detectElementResize.removeResizeListener(this._parentNode,this._onResize)}},{key:"render",value:function(){var e=this.props,t=e.children,n=e.className,i=e.disableHeight,r=e.disableWidth,o=e.style,a=this.state,l=a.height,d=a.width,c={overflow:"visible"},u={},h=!1;return i||(0===l&&(h=!0),c.height=0,u.height=l),r||(0===d&&(h=!0),c.width=0,u.width=d),(0,s.createElement)("div",{className:n,ref:this._setRef,style:_({},c,o)},!h&&t(u))}}]),t}(s.PureComponent);N.defaultProps={onResize:function(){},disableHeight:!1,disableWidth:!1,style:{}};const q=N;var A=n(74061),L=n(24903),j=n(9875),V=n(4715),K=n(35932),B=n(70163),H=n(80621),W=n(2275),Y=n(5872),J=n.n(Y),G=n(4144),Q=n(58593),X=n(85931);const ee=e=>{let{children:t,...n}=e;const[i,r]=(0,s.useState)(!1),o=(0,s.useRef)(null);(0,s.useEffect)((()=>{r(!!o.current&&o.current.scrollWidth>o.current.clientWidth)}),[t]);const a=(0,C.tZ)("div",J()({},n,{ref:o,css:C.iv`
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
      `}),t);return i?(0,C.tZ)(Q.u,{title:t},a):a},te=e=>{let{label:t,value:n}=e;return(0,C.tZ)("div",{css:e=>C.iv`
      font-size: ${e.typography.sizes.s}px;
      display: flex;
      justify-content: space-between;

      &:not(:last-child) {
        margin-bottom: ${e.gridUnit}px;
      }
    `},(0,C.tZ)("span",{css:e=>C.iv`
        margin-right: ${4*e.gridUnit}px;
        color: ${e.colors.grayscale.base};
      `},t),(0,C.tZ)("span",{css:C.iv`
        min-width: 0;
      `},(0,C.tZ)(ee,null,n)))},ne=e=>{let{showThumbnails:t,placeholderRef:n}=e;return(0,C.tZ)("div",{ref:n,css:e=>C.iv`
      /* Display styles */
      border: 1px solid ${e.colors.primary.dark1};
      border-radius: ${e.gridUnit}px;
      color: ${e.colors.primary.dark1};
      font-size: ${e.typography.sizes.xs}px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      padding: ${e.gridUnit/2}px ${2*e.gridUnit}px;
      margin-left: ${4*e.gridUnit}px;
      pointer-events: none;

      /* Position styles */
      visibility: hidden;
      position: ${t?"absolute":"unset"};
      top: ${t?"72px":"unset"};
      left: ${t?"84px":"unset"};
    `},(0,c.t)("Added"))},ie=e=>{let{placeholder:t}=e;return(0,C.tZ)("div",{css:e=>C.iv`
      /* Display styles */
      border: 1px solid ${e.colors.primary.dark1};
      border-radius: ${e.gridUnit}px;
      color: ${e.colors.primary.dark1};
      font-size: ${e.typography.sizes.xs}px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      padding: ${e.gridUnit/2}px ${2*e.gridUnit}px;
      margin-left: ${4*e.gridUnit}px;
      pointer-events: none;

      /* Position styles */
      display: ${t?"unset":"none"};
      position: absolute;
      top: ${t?`${t.offsetTop}px`:"unset"};
      left: ${t?t.offsetLeft-2+"px":"unset"};
    `},(0,c.t)("Added"))},re=e=>{let{datasourceUrl:t,datasourceName:n="-",innerRef:i,isSelected:r=!1,lastModified:o,sliceName:a,style:l={},thumbnailUrl:d,visType:p}=e;const m=(0,u.c)(u.T.THUMBNAILS),[g,f]=(0,s.useState)(),{mountedPluginMetadata:v}=(0,h.gp)(),b=(0,s.useMemo)((()=>v[p].name),[v,p]);return(0,C.tZ)("div",{ref:i,style:l},(0,C.tZ)("div",{css:e=>C.iv`
          border: 1px solid ${e.colors.grayscale.light2};
          border-radius: ${e.gridUnit}px;
          background: ${e.colors.grayscale.light5};
          padding: ${4*e.gridUnit}px;
          margin: 0 ${3*e.gridUnit}px
            ${3*e.gridUnit}px
            ${3*e.gridUnit}px;
          position: relative;
          cursor: ${r?"not-allowed":"move"};
          white-space: nowrap;
          overflow: hidden;
          line-height: 1.3;
          color: ${e.colors.grayscale.dark1}

          &:hover {
            background: ${e.colors.grayscale.light4};
          }

          opacity: ${r?.4:"unset"};
        `},(0,C.tZ)("div",{css:C.iv`
            display: flex;
          `},m?(0,C.tZ)("div",{css:C.iv`
                width: 146px;
                height: 82px;
                flex-shrink: 0;
                margin-right: 16px;
              `},(0,C.tZ)(G.Z,{src:d||"",fallback:"/static/assets/images/chart-card-fallback.svg",position:"top"}),r&&m?(0,C.tZ)(ne,{placeholderRef:f,showThumbnails:m}):null):null,(0,C.tZ)("div",{css:C.iv`
              flex-grow: 1;
              min-width: 0;
            `},(0,C.tZ)("div",{css:e=>C.iv`
                margin-bottom: ${2*e.gridUnit}px;
                font-weight: ${e.typography.weights.bold};
                display: flex;
                justify-content: space-between;
                align-items: center;
              `},(0,C.tZ)(ee,null,a),r&&!m?(0,C.tZ)(ne,{placeholderRef:f}):null),(0,C.tZ)("div",{css:C.iv`
                display: flex;
                flex-direction: column;
              `},(0,C.tZ)(te,{label:(0,c.t)("Viz type"),value:b}),(0,C.tZ)(te,{label:(0,c.t)("Dataset"),value:t?(0,C.tZ)(X.m,{to:t},n):n}),(0,C.tZ)(te,{label:(0,c.t)("Modified"),value:o}))))),(0,C.tZ)(ie,{placeholder:g}))};var oe=n(84785);const ae={position:"fixed",pointerEvents:"none",top:0,left:0,zIndex:101,width:344},se={dragItem:d().shape({index:d().number.isRequired}),slices:d().arrayOf(W.Rw),isDragging:d().bool.isRequired,currentOffset:d().shape({x:d().number.isRequired,y:d().number.isRequired})};function le(e){let{dragItem:t,slices:n,isDragging:i,currentOffset:r}=e;if(!(i&&r&&t&&n))return null;const o=n[t.index];return o&&t.parentType===g.F0&&t.type===g.dW?(0,C.tZ)(re,{style:{...ae,transform:`translate(${r.x}px, ${r.y}px)`},sliceName:o.slice_name,lastModified:o.changed_on_humanized,visType:o.viz_type,datasourceUrl:o.datasource_url,datasourceName:o.datasource_name}):null}le.propTypes=se,le.defaultProps={currentOffset:null,dragItem:null,slices:null};const de=(0,oe.DragLayer)((e=>({dragItem:e.getItem(),currentOffset:e.getSourceClientOffset(),isDragging:e.isDragging()})))(le);var ce,ue=n(23493),he=n.n(ue);const pe=H.Mu+1,me=H.Mu+3,ge=H.Mu+4,fe=H.Mu+5,ve={[g.U0]:{[g.yR]:H.Mu,[g.BG]:H.Mu},[g.BG]:{[g.dW]:pe,[g.t]:pe,[g.xh]:pe,[g.BA]:pe,[g.hE]:pe,[g.Nc]:pe,[g.Os]:pe,[g.yR]:pe},[g.Os]:{[g.dW]:ge,[g.t]:ge,[g.xh]:ge,[g.BA]:ge},[g.yR]:{[g.gn]:me},[g.gn]:{[g.dW]:fe,[g.t]:fe,[g.xh]:fe,[g.BA]:me,[g.hE]:fe,[g.Nc]:fe,[g.Os]:me,[g.yR]:me},[g.BA]:{[g.dW]:fe,[g.Nc]:fe,[g.xh]:fe,[g.Os]:me,[g.hE]:me,[g.yR]:me},[g.dW]:{},[g.t]:{},[g.hE]:{},[g.Nc]:{},[g.xh]:{}};function be(e){const{parentType:t,childType:n,parentDepth:i}=e;if(!t||!n||"number"!=typeof i)return!1;const r=(ve[t]||{})[n];return"number"==typeof r&&i<=r}const ye="DROP_TOP",Ce="DROP_RIGHT",xe="DROP_BOTTOM",Se="DROP_LEFT";let Ze,we={};function Re(e,t){const{depth:n,parentComponent:i,component:r,orientation:o,isDraggingOverShallow:a}=t.props,s=e.getItem();if(!s||s.id===r.id)return null;const l=be({parentType:r.type,parentDepth:n,childType:s.type}),d=i&&i.type,c=be({parentType:d,parentDepth:n+(d===g.gn||d===g.yR?0:-1),childType:s.type});if(!l&&!c)return null;const u=(r.children||[]).length>0,h="row"===o?"vertical":"horizontal",p="row"===o?"horizontal":"vertical";if(a&&l&&!c)return"vertical"===h?u?Ce:Se:u?xe:ye;const m=t.ref.getBoundingClientRect(),f=e.getClientOffset()||we[r.id];if(!f||!m)return null;we[r.id]=f;const v=Math.abs(f.y-m.top),b=Math.abs(f.y-m.bottom),y=Math.abs(f.x-m.left),C=Math.abs(f.x-m.right);if(!a&&[v,b,y,C].every((e=>e>20)))return null;if(c&&!l){if("vertical"===p){const e=m.left+(m.right-m.left)/2;return f.x<e?Se:Ce}const e=m.top+(m.bottom-m.top)/2;return f.y<e?ye:xe}if(c&&l){if("vertical"===p){if(y<20)return Se;if(C<20)return Ce}else{if(v<20)return ye;if(b<20)return xe}return"vertical"===h?u?Ce:Se:u?xe:ye}return null}const ke=he()((function(e,t,n){var i,r,o;if(!n.mounted)return;const a=Re(t,n);!function(e){const t="SCROLL_TOP"===e&&!Ze&&0!==document.documentElement.scrollTop,n=Ze&&("SCROLL_TOP"!==e||0===document.documentElement.scrollTop);t?Ze=setInterval((()=>{if(0===document.documentElement.scrollTop)return clearInterval(Ze),void(Ze=null);let e=document.documentElement.scrollTop-120;e<0&&(e=0),window.scroll({top:e,behavior:"smooth"})}),50):n&&(clearInterval(Ze),Ze=null)}((null==n||null==(i=n.props)||null==(r=i.component)?void 0:r.type)===g.U0?"SCROLL_TOP":null),a?(null==n||null==(o=n.props)||o.onHover(),n.setState((()=>({dropIndicator:a})))):n.setState((()=>({dropIndicator:null})))}),100);const Te="DRAG_DROPPABLE",De=[Te,{canDrag:e=>!e.disableDragDrop,beginDrag(e){const{component:t,index:n,parentComponent:i={}}=e;return{type:t.type,id:t.id,meta:t.meta,index:n,parentId:i.id,parentType:i.type}}},function(e,t){return{dragSourceRef:e.dragSource(),dragPreviewRef:e.dragPreview(),isDragging:t.isDragging()}}],Ie=[Te,{canDrop:e=>!e.disableDragDrop,hover(e,t,n){n&&n.mounted&&ke(e,t,n)},drop(e,t,n){const i=t.getDropResult();if((!i||!i.destination)&&n.mounted)return function(e,t,n){if(!n.mounted)return;n.setState((()=>({dropIndicator:null})));const i=Re(t,n);if(!i)return;const{parentComponent:r,component:o,index:a,onDrop:s,orientation:l}=n.props,d=t.getItem(),c="row"===l&&(i===ye||i===xe)||"column"===l&&(i===Se||i===Ce)?"sibling":"child",u={source:{id:d.parentId,type:d.parentType,index:d.index},dragging:{id:d.id,type:d.type,meta:d.meta}};if("child"===c)u.destination={id:o.id,type:o.type,index:o.children.length};else{let e=r&&d.parentId===r.id&&d.index<a?a-1:a;i!==xe&&i!==Ce||(e+=1),u.destination={id:r.id,type:r.type,index:e}}return s(u),we={},u}(0,t,n)}},function(e,t){return{droppableRef:e.dropTarget(),isDraggingOver:t.isOver(),isDraggingOverShallow:t.isOver({shallow:!0})}}],_e={children:d().func,className:d().string,component:W.cP,parentComponent:W.cP,depth:d().number.isRequired,disableDragDrop:d().bool,orientation:d().oneOf(["row","column"]),index:d().number.isRequired,style:d().object,onDrop:d().func,onHover:d().func,editMode:d().bool,useEmptyDragPreview:d().bool,isDragging:d().bool,isDraggingOver:d().bool,isDraggingOverShallow:d().bool,droppableRef:d().func,dragSourceRef:d().func,dragPreviewRef:d().func},$e={className:null,style:null,parentComponent:null,disableDragDrop:!1,children(){},onDrop(){},onHover(){},orientation:"row",useEmptyDragPreview:!1,isDragging:!1,isDraggingOver:!1,isDraggingOverShallow:!1,droppableRef(){},dragSourceRef(){},dragPreviewRef(){}},Fe=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    position: relative;

    &.dragdroppable--dragging {
      opacity: 0.2;
    }

    &.dragdroppable-row {
      width: 100%;
    }

    &.dragdroppable-column .resizable-container span div {
      z-index: 10;
    }

    & {
      .drop-indicator {
        display: block;
        background-color: ${t.colors.primary.base};
        position: absolute;
        z-index: 10;
      }

      .drop-indicator--top {
        top: 0;
        left: 0;
        height: ${t.gridUnit}px;
        width: 100%;
        min-width: ${4*t.gridUnit}px;
      }

      .drop-indicator--bottom {
        top: 100%;
        left: 0;
        height: ${t.gridUnit}px;
        width: 100%;
        min-width: ${4*t.gridUnit}px;
      }

      .drop-indicator--right {
        top: 0;
        left: 100%;
        height: 100%;
        width: ${t.gridUnit}px;
        min-height: ${4*t.gridUnit}px;
      }

      .drop-indicator--left {
        top: 0;
        left: 0;
        height: 100%;
        width: ${t.gridUnit}px;
        min-height: ${4*t.gridUnit}px;
      }
    }
  `}};
`;class Me extends s.PureComponent{constructor(e){super(e),this.state={dropIndicator:null},this.setRef=this.setRef.bind(this)}componentDidMount(){this.mounted=!0}componentWillUnmount(){this.mounted=!1}setRef(e){var t,n;this.ref=e,this.props.useEmptyDragPreview?this.props.dragPreviewRef((ce||((ce=new Image).src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="),ce),{captureDraggingState:!0}):this.props.dragPreviewRef(e),null==(t=(n=this.props).droppableRef)||t.call(n,e)}render(){const{children:e,className:t,orientation:n,dragSourceRef:i,disableDragDrop:r,isDragging:o,isDraggingOver:a,style:s,editMode:l}=this.props,{dropIndicator:d}=this.state,c=a&&d&&!r?{className:b()("drop-indicator",d===ye&&"drop-indicator--top",d===xe&&"drop-indicator--bottom",d===Se&&"drop-indicator--left",d===Ce&&"drop-indicator--right")}:null,u=l?{dragSourceRef:i,dropIndicatorProps:c}:{};return(0,C.tZ)(Fe,{style:s,ref:this.setRef,className:b()("dragdroppable","row"===n&&"dragdroppable-row","column"===n&&"dragdroppable-column",o&&"dragdroppable--dragging",t)},e(u))}}Me.propTypes=_e,Me.defaultProps=$e;const Ee=(0,oe.DragSource)(...De)((0,oe.DropTarget)(...Ie)(Me)),Oe={fetchAllSlices:d().func.isRequired,isLoading:d().bool.isRequired,slices:d().objectOf(W.Rw).isRequired,lastUpdated:d().number.isRequired,errorMessage:d().string,userId:d().string.isRequired,selectedSliceIds:d().arrayOf(d().number),editMode:d().bool,dashboardId:d().number},ze=["slice_name","viz_type","datasource_name"],Pe={slice_name:(0,c.t)("name"),viz_type:(0,c.t)("viz type"),datasource_name:(0,c.t)("dataset"),changed_on:(0,c.t)("recent")},Ue=y.iK.div`
  display: flex;
  flex-direction: row;
  padding: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
  padding-top: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
`,Ne=(0,y.iK)(V.Ph)`
  margin-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  min-width: 150px;
`,qe=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: flex;
    justify-content: flex-end;
    padding-right: ${2*t.gridUnit}px;
  `}}
`,Ae=(0,y.iK)(K.Z)`
  ${e=>{let{theme:t}=e;return C.iv`
    height: auto;
    & > .anticon + span {
      margin-left: 0;
    }
    & > [role='img']:first-of-type {
      margin-right: ${t.gridUnit}px;
      padding-bottom: 1px;
      line-height: 0;
    }
  `}}
`,Le=y.iK.div`
  flex-grow: 1;
  min-height: 0;
`;class je extends s.Component{static sortByComparator(e){const t="changed_on"===e?-1:1;return(n,i)=>n[e]<i[e]?-1*t:n[e]>i[e]?1*t:0}constructor(e){super(e),this.handleChange=T()((e=>{this.searchUpdated(e);const{userId:t}=this.props;this.slicesRequest=this.props.fetchFilteredSlices(t,e)}),300),this.state={filteredSlices:[],searchTerm:"",sortBy:"changed_on",selectedSliceIdsSet:new Set(e.selectedSliceIds)},this.rowRenderer=this.rowRenderer.bind(this),this.searchUpdated=this.searchUpdated.bind(this),this.handleKeyPress=this.handleKeyPress.bind(this),this.handleSelect=this.handleSelect.bind(this)}componentDidMount(){this.slicesRequest=this.props.fetchAllSlices(this.props.userId)}UNSAFE_componentWillReceiveProps(e){const t={};e.lastUpdated!==this.props.lastUpdated&&(t.filteredSlices=Object.values(e.slices).filter((0,L.cj)(this.state.searchTerm,ze)).sort(je.sortByComparator(this.state.sortBy))),e.selectedSliceIds!==this.props.selectedSliceIds&&(t.selectedSliceIdsSet=new Set(e.selectedSliceIds)),Object.keys(t).length&&this.setState(t)}componentWillUnmount(){this.slicesRequest&&this.slicesRequest.abort&&this.slicesRequest.abort()}getFilteredSortedSlices(e,t){return Object.values(this.props.slices).filter((0,L.cj)(e,ze)).sort(je.sortByComparator(t))}handleKeyPress(e){"Enter"===e.key&&(e.preventDefault(),this.searchUpdated(e.target.value))}searchUpdated(e){this.setState((t=>({searchTerm:e,filteredSlices:this.getFilteredSortedSlices(e,t.sortBy)})))}handleSelect(e){this.setState((t=>({sortBy:e,filteredSlices:this.getFilteredSortedSlices(t.searchTerm,e)})));const{userId:t}=this.props;this.slicesRequest=this.props.fetchSortedSlices(t,e)}rowRenderer(e){let{key:t,index:n,style:i}=e;const{filteredSlices:r,selectedSliceIdsSet:o}=this.state,a=r[n],s=o.has(a.slice_id),l=g.dW,d=H.Jd,c={chartId:a.slice_id,sliceName:a.slice_name};return(0,C.tZ)(Ee,{key:t,component:{type:l,id:d,meta:c},parentComponent:{id:H.D0,type:g.F0},index:n,depth:0,disableDragDrop:s,editMode:this.props.editMode,useEmptyDragPreview:!0,style:{}},(e=>{let{dragSourceRef:t}=e;return(0,C.tZ)(re,{innerRef:t,style:i,sliceName:a.slice_name,lastModified:a.changed_on_humanized,visType:a.viz_type,datasourceUrl:a.datasource_url,datasourceName:a.datasource_name,thumbnailUrl:a.thumbnail_url,isSelected:s})}))}render(){return(0,C.tZ)("div",{css:C.iv`
          height: 100%;
          display: flex;
          flex-direction: column;
        `},(0,C.tZ)(qe,null,(0,C.tZ)(Ae,{buttonStyle:"link",buttonSize:"xsmall",onClick:()=>window.open(`/chart/add?dashboard_id=${this.props.dashboardId}`,"_blank","noopener noreferrer")},(0,C.tZ)(B.Z.PlusSmall,null),(0,c.t)("Create new chart"))),(0,C.tZ)(Ue,null,(0,C.tZ)(j.II,{placeholder:(0,c.t)("Filter your charts"),className:"search-input",onChange:e=>this.handleChange(e.target.value),onKeyPress:this.handleKeyPress}),(0,C.tZ)(Ne,{id:"slice-adder-sortby",value:this.state.sortBy,onChange:this.handleSelect,options:Object.entries(Pe).map((e=>{let[t,n]=e;return{label:(0,c.t)("Sort by %s",n),value:t}})),placeholder:(0,c.t)("Sort by")})),this.props.isLoading&&(0,C.tZ)(p.Z,null),!this.props.isLoading&&this.state.filteredSlices.length>0&&(0,C.tZ)(Le,null,(0,C.tZ)(q,null,(e=>{let{height:t,width:n}=e;return(0,C.tZ)(A.t7,{width:n,height:t,itemCount:this.state.filteredSlices.length,itemSize:128,searchTerm:this.state.searchTerm,sortBy:this.state.sortBy,selectedSliceIds:this.props.selectedSliceIds},this.rowRenderer)}))),this.props.errorMessage&&(0,C.tZ)("div",{css:C.iv`
              padding: 16px;
            `},this.props.errorMessage),(0,C.tZ)(de,{slices:this.state.filteredSlices}))}}je.propTypes=Oe,je.defaultProps={selectedSliceIds:[],editMode:!1,errorMessage:""};const Ve=je,Ke=(0,r.$j)((function(e,t){let{sliceEntities:n,dashboardInfo:i,dashboardState:r}=e;return{height:t.height,userId:i.userId,dashboardId:i.id,selectedSliceIds:r.sliceIds,slices:n.slices,isLoading:n.isLoading,errorMessage:n.errorMessage,lastUpdated:n.lastUpdated,editMode:r.editMode}}),(function(e){return(0,i.DE)({fetchAllSlices:R.To,fetchSortedSlices:R.Fv,fetchFilteredSlices:R.uC},e)}))(Ve),Be=e=>{let{registryKeys:t,registry:n}=e;return()=>t.map((e=>n[e]))},He=e=>{let{registryKeys:t,registry:n}=e;return e=>{t=t.filter((t=>t!==e)),delete n[e]}},We=e=>{let{registry:t}=e;return e=>t[e]},Ye=function(e){void 0===e&&(e=[]);const t={registry:{},registryKeys:[]},n=(e=>{let{registryKeys:t,registry:n}=e;return(e,i)=>{t.push(e),n[e]={key:e,metadata:i.metadata,Component:s.lazy(i.loadComponent)}}})(t);return e.forEach((e=>{let{key:t,item:i}=e;n(t,i)})),{set:n,get:We(t),delete:He(t),getAll:Be(t)}}([]),Je={id:d().string.isRequired,type:d().string.isRequired,label:d().string.isRequired,className:d().string},Ge=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    padding: ${4*t.gridUnit}px;
    background: ${t.colors.grayscale.light5};
    cursor: move;

    &:not(.static):hover {
      background: ${t.colors.grayscale.light4};
    }
  `}}
`,Qe=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    position: relative;
    background: ${t.colors.grayscale.light4};
    width: ${10*t.gridUnit}px;
    height: ${10*t.gridUnit}px;
    margin-right: ${4*t.gridUnit}px;
    border: 1px solid ${t.colors.grayscale.light5};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${t.colors.text.label};
    font-size: ${t.typography.sizes.xxl}px;

    &.fa-window-restore {
      font-size: ${t.typography.sizes.l}px;
    }

    &.fa-area-chart {
      font-size: ${t.typography.sizes.xl}px;
    }

    &.divider-placeholder:after {
      content: '';
      height: 2px;
      width: 100%;
      background-color: ${t.colors.grayscale.light2};
    }
  `}}
`;class Xe extends s.PureComponent{render(){const{label:e,id:t,type:n,className:i,meta:r}=this.props;return(0,C.tZ)(Ee,{component:{type:n,id:t,meta:r},parentComponent:{id:H.D0,type:g.F0},index:0,depth:0,editMode:!0},(t=>{let{dragSourceRef:n}=t;return(0,C.tZ)(Ge,{ref:n},(0,C.tZ)(Qe,{className:b()("new-component-placeholder",i)}),e)}))}}function et(){return(0,C.tZ)(Xe,{id:H.Nb,type:g.BA,label:(0,c.t)("Column"),className:"fa fa-long-arrow-down"})}function tt(){return(0,C.tZ)(Xe,{id:H.ES,type:g.hE,label:(0,c.t)("Divider"),className:"divider-placeholder"})}function nt(){return(0,C.tZ)(Xe,{id:H.Z1,type:g.Nc,label:(0,c.t)("Header"),className:"fa fa-header"})}function it(){return(0,C.tZ)(Xe,{id:H.vD,type:g.Os,label:(0,c.t)("Row"),className:"fa fa-long-arrow-right"})}function rt(){return(0,C.tZ)(Xe,{id:H.NN,type:g.yR,label:(0,c.t)("Tabs"),className:"fa fa-window-restore"})}function ot(){return(0,C.tZ)(Xe,{id:H.C3,type:g.xh,label:(0,c.t)("Text"),className:"fa fa-font"})}Xe.propTypes=Je,Xe.defaultProps={className:null};const at=e=>{let{componentKey:t,metadata:n}=e;return(0,C.tZ)(Xe,{id:H.gR,type:g.t,label:n.name,meta:{metadata:n,componentKey:t},className:`fa fa-${n.iconName}`})},st=e=>{let{topOffset:t=0}=e;return(0,C.tZ)("div",{css:C.iv`
      position: sticky;
      right: 0;
      top: ${t}px;
      height: calc(100vh - ${t}px);
      width: ${374}px;
    `},(0,C.tZ)("div",{css:e=>C.iv`
        position: absolute;
        height: 100%;
        width: ${374}px;
        box-shadow: -4px 0 4px 0 ${(0,Z.rgba)(e.colors.grayscale.dark2,.1)};
        background-color: ${e.colors.grayscale.light5};
      `},(0,C.tZ)(w.ZP,{id:"tabs",css:e=>C.iv`
          line-height: inherit;
          margin-top: ${2*e.gridUnit}px;
          height: 100%;

          & .ant-tabs-content-holder {
            height: 100%;
            & .ant-tabs-content {
              height: 100%;
            }
          }
        `},(0,C.tZ)(w.ZP.TabPane,{key:1,tab:(0,c.t)("Charts"),css:C.iv`
            height: 100%;
          `},(0,C.tZ)(Ke,null)),(0,C.tZ)(w.ZP.TabPane,{key:2,tab:(0,c.t)("Layout elements")},(0,C.tZ)(rt,null),(0,C.tZ)(it,null),(0,C.tZ)(et,null),(0,C.tZ)(nt,null),(0,C.tZ)(ot,null),(0,C.tZ)(tt,null),Ye.getAll().map((e=>{let{key:t,metadata:n}=e;return(0,C.tZ)(at,{metadata:n,componentKey:t})}))))))};var lt=n(74599),dt=n(30381),ct=n.n(dt),ut=n(75049),ht=n(78161),pt=n(91877),mt=n(3741),gt=n(12617),ft=n(9679),vt=n(31069),bt=n(83862),yt=n(27600),Ct=n(10222),xt=n(68492),St=n(23525);const Zt=e=>{const{copyMenuItemTitle:t,emailMenuItemTitle:n,emailSubject:i,emailBody:o,addDangerToast:a,addSuccessToast:s,dashboardId:l,dashboardComponentId:d,...u}=e,{dataMask:h,activeTabs:p}=(0,r.v9)((e=>({dataMask:e.dataMask,activeTabs:e.dashboardState.activeTabs})));async function m(){return(0,St.Nm)({dashboardId:l,dataMask:h,activeTabs:p,anchor:d})}return(0,C.tZ)(bt.v,{selectable:!1},(0,C.tZ)(bt.v.Item,J()({key:"copy-url"},u),(0,C.tZ)("div",{onClick:async function(){try{await(0,Ct.Z)(m),s((0,c.t)("Copied to clipboard!"))}catch(e){xt.Z.error(e),a((0,c.t)("Sorry, something went wrong. Try again later."))}},role:"button",tabIndex:0},t)),(0,C.tZ)(bt.v.Item,J()({key:"share-by-email"},u),(0,C.tZ)("div",{onClick:async function(){try{const e=encodeURIComponent(`${o}${await m()}`),t=encodeURIComponent(i);window.location.href=`mailto:?Subject=${t}%20&Body=${e}`}catch(e){xt.Z.error(e),a((0,c.t)("Sorry, something went wrong. Try again later."))}},role:"button",tabIndex:0},n)))};var wt=n(1304),Rt=n(94670);const kt=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    .css-editor-header {\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      margin-bottom: ${2*t.gridUnit}px;\n\n      h5 {\n        margin-top: ${t.gridUnit}px;\n      }\n    }\n    .css-editor {\n      border: 1px solid ${t.colors.grayscale.light1};\n    }\n  `}}
`,Tt={initialCss:d().string,triggerNode:d().node.isRequired,onChange:d().func,templates:d().array};class Dt extends s.PureComponent{constructor(e){super(e),this.state={css:e.initialCss},this.changeCss=this.changeCss.bind(this),this.changeCssTemplate=this.changeCssTemplate.bind(this)}componentDidMount(){Rt.ry.preload()}changeCss(e){this.setState({css:e},(()=>{this.props.onChange(e)}))}changeCssTemplate(e){let{key:t}=e;this.changeCss(t)}renderTemplateSelector(){if(this.props.templates){const e=(0,C.tZ)(bt.v,{onClick:this.changeCssTemplate},this.props.templates.map((e=>(0,C.tZ)(bt.v.Item,{key:e.css},e.label))));return(0,C.tZ)(V.Gj,{overlay:e,placement:"bottomRight"},(0,C.tZ)(K.Z,null,(0,c.t)("Load a CSS template")))}return null}render(){return(0,C.tZ)(wt.Z,{triggerNode:this.props.triggerNode,modalTitle:(0,c.t)("CSS"),modalBody:(0,C.tZ)(kt,null,(0,C.tZ)("div",{className:"css-editor-header"},(0,C.tZ)("h5",null,(0,c.t)("Live CSS editor")),this.renderTemplateSelector()),(0,C.tZ)(Rt.ry,{className:"css-editor",minLines:12,maxLines:30,onChange:this.changeCss,height:"200px",width:"100%",editorProps:{$blockScrolling:!0},enableLiveAutocompletion:!0,value:this.state.css||""}))})}}Dt.propTypes=Tt,Dt.defaultProps={initialCss:"",onChange:()=>{}};const It=Dt;var _t=n(81315),$t=n(29487),Ft=n(49238),Mt=n(85633);const Et=(0,y.iK)(wt.Z)`
  .ant-modal-body {
    overflow: visible;
  }
`,Ot=y.iK.div`
  margin-top: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
`;class zt extends s.PureComponent{constructor(e){super(e),this.modalRef=void 0,this.modalRef=s.createRef(),this.state={refreshFrequency:e.refreshFrequency},this.handleFrequencyChange=this.handleFrequencyChange.bind(this),this.onSave=this.onSave.bind(this),this.onCancel=this.onCancel.bind(this)}onSave(){var e,t;this.props.onChange(this.state.refreshFrequency,this.props.editMode),null==(e=this.modalRef)||null==(t=e.current)||t.close(),this.props.addSuccessToast((0,c.t)("Refresh interval saved"))}onCancel(){var e,t;this.setState({refreshFrequency:this.props.refreshFrequency}),null==(e=this.modalRef)||null==(t=e.current)||t.close()}handleFrequencyChange(e){const{refreshIntervalOptions:t}=this.props;this.setState({refreshFrequency:e||t[0][0]})}render(){const{refreshLimit:e=0,refreshWarning:t,editMode:n,refreshIntervalOptions:i}=this.props,{refreshFrequency:r=0}=this.state,o=!!r&&!!t&&r<e;return(0,C.tZ)(Et,{ref:this.modalRef,triggerNode:this.props.triggerNode,modalTitle:(0,c.t)("Refresh interval"),modalBody:(0,C.tZ)("div",null,(0,C.tZ)(Ft.lX,null,(0,c.t)("Refresh frequency")),(0,C.tZ)(_t.Z,{ariaLabel:(0,c.t)("Refresh interval"),options:i.map((e=>({value:e[0],label:(0,c.t)(e[1])}))),value:r,onChange:this.handleFrequencyChange,sortComparator:(0,Mt.mj)("value")}),o&&(0,C.tZ)(Ot,null,(0,C.tZ)($t.Z,{type:"warning",message:(0,C.tZ)(s.Fragment,null,(0,C.tZ)("div",null,t),(0,C.tZ)("br",null),(0,C.tZ)("strong",null,(0,c.t)("Are you sure you want to proceed?")))}))),modalFooter:(0,C.tZ)(s.Fragment,null,(0,C.tZ)(K.Z,{buttonStyle:"primary",buttonSize:"small",onClick:this.onSave},n?(0,c.t)("Save"):(0,c.t)("Save for this session")),(0,C.tZ)(K.Z,{onClick:this.onCancel,buttonSize:"small"},(0,c.t)("Cancel")))})}}zt.defaultProps={refreshLimit:0,refreshWarning:null};const Pt=zt;var Ut=n(87183),Nt=n(87253);const qt={saveType:H.TN,colorNamespace:void 0,colorScheme:void 0,shouldPersistRefreshFrequency:!1};class At extends s.PureComponent{constructor(e){super(e),this.modal=void 0,this.onSave=void 0,this.state={saveType:e.saveType,newDashName:e.dashboardTitle+(0,c.t)("[copy]"),duplicateSlices:!1},this.handleSaveTypeChange=this.handleSaveTypeChange.bind(this),this.handleNameChange=this.handleNameChange.bind(this),this.saveDashboard=this.saveDashboard.bind(this),this.toggleDuplicateSlices=this.toggleDuplicateSlices.bind(this),this.onSave=this.props.onSave.bind(this),this.modal=s.createRef()}toggleDuplicateSlices(){this.setState((e=>({duplicateSlices:!e.duplicateSlices})))}handleSaveTypeChange(e){this.setState({saveType:e.target.value})}handleNameChange(e){this.setState({newDashName:e,saveType:H.kS})}saveDashboard(){var e;const{saveType:t,newDashName:n}=this.state,{dashboardTitle:i,dashboardInfo:r,layout:o,customCss:a,dashboardId:s,refreshFrequency:l,shouldPersistRefreshFrequency:d,lastModifiedTime:u}=this.props,h=d?l:null==(e=r.metadata)?void 0:e.refresh_frequency,p={certified_by:r.certified_by,certification_details:r.certification_details,css:a,dashboard_title:t===H.kS?n:i,duplicate_slices:this.state.duplicateSlices,last_modified_time:u,owners:r.owners,roles:r.roles,metadata:{...null==r?void 0:r.metadata,positions:o,refresh_frequency:h}};var m,g;t!==H.kS||n?(this.onSave(p,s,t).then((e=>{t===H.kS&&e&&e.json&&e.json.id&&(window.location.href=`/superset/dashboard/${e.json.id}/`)})),null==(m=this.modal)||null==(g=m.current)||null==g.close||g.close()):this.props.addDangerToast((0,c.t)("You must pick a name for the new dashboard"))}render(){return(0,C.tZ)(wt.Z,{ref:this.modal,triggerNode:this.props.triggerNode,modalTitle:(0,c.t)("Save dashboard"),modalBody:(0,C.tZ)("div",null,(0,C.tZ)(Ut.Y,{value:H.TN,onChange:this.handleSaveTypeChange,checked:this.state.saveType===H.TN,disabled:!this.props.canOverwrite},(0,c.t)("Overwrite Dashboard [%s]",this.props.dashboardTitle)),(0,C.tZ)("hr",null),(0,C.tZ)(Ut.Y,{value:H.kS,onChange:this.handleSaveTypeChange,checked:this.state.saveType===H.kS},(0,c.t)("Save as:")),(0,C.tZ)(j.II,{type:"text",placeholder:(0,c.t)("[dashboard name]"),value:this.state.newDashName,onFocus:e=>this.handleNameChange(e.target.value),onChange:e=>this.handleNameChange(e.target.value)}),(0,C.tZ)("div",{className:"m-l-25 m-t-5"},(0,C.tZ)(Nt.ZP,{checked:this.state.duplicateSlices,onChange:()=>this.toggleDuplicateSlices()}),(0,C.tZ)("span",{className:"m-l-5"},(0,c.t)("also copy (duplicate) charts")))),modalFooter:(0,C.tZ)("div",null,(0,C.tZ)(K.Z,{buttonStyle:"primary",onClick:this.saveDashboard},(0,c.t)("Save")))})}}At.defaultProps=qt;const Lt=At;var jt=n(97634),Vt=n(14505),Kt=n(87999),Bt=n(56727),Ht=n(11370);function Wt(e){let{pathname:t,filters:n={},hash:i="",standalone:r}=e;const o=new URLSearchParams;o.set(yt.KD.preselectFilters.name,JSON.stringify((0,Ht.Z)(n))),r&&o.set(yt.KD.standalone.name,r.toString());const a=(0,St.eY)(yt.KD.nativeFiltersKey);a&&o.set(yt.KD.nativeFiltersKey.name,a);const s=i?`#${i}`:"";return`${t}?${o.toString()}${s}`}var Yt=n(43399);const Jt={addSuccessToast:d().func.isRequired,addDangerToast:d().func.isRequired,dashboardInfo:d().object.isRequired,dashboardId:d().number,dashboardTitle:d().string,dataMask:d().object.isRequired,customCss:d().string,colorNamespace:d().string,colorScheme:d().string,onChange:d().func.isRequired,updateCss:d().func.isRequired,forceRefreshAllCharts:d().func.isRequired,refreshFrequency:d().number,shouldPersistRefreshFrequency:d().bool.isRequired,setRefreshFrequency:d().func.isRequired,startPeriodicRender:d().func.isRequired,editMode:d().bool.isRequired,userCanEdit:d().bool,userCanShare:d().bool,userCanSave:d().bool,userCanCurate:d().bool.isRequired,isLoading:d().bool.isRequired,layout:d().object.isRequired,expandedSlices:d().object,onSave:d().func.isRequired,showPropertiesModal:d().func.isRequired,manageEmbedded:d().func.isRequired,logEvent:d().func,refreshLimit:d().number,refreshWarning:d().string,lastModifiedTime:d().number.isRequired},Gt="refresh-dashboard",Qt="edit-properties",Xt="download-as-image",en="toggle-fullscreen",tn="manage-embedded";class nn extends s.PureComponent{static discardChanges(){window.location.reload()}constructor(e){super(e),this.state={css:e.customCss,cssTemplates:[],showReportSubMenu:null},this.changeCss=this.changeCss.bind(this),this.changeRefreshInterval=this.changeRefreshInterval.bind(this),this.handleMenuClick=this.handleMenuClick.bind(this),this.setShowReportSubMenu=this.setShowReportSubMenu.bind(this)}UNSAFE_componentWillMount(){vt.Z.get({endpoint:"/csstemplateasyncmodelview/api/read"}).then((e=>{let{json:t}=e;const n=t.result.map((e=>({value:e.template_name,css:e.css,label:e.template_name})));this.setState({cssTemplates:n})})).catch((()=>{this.props.addDangerToast((0,c.t)("An error occurred while fetching available CSS templates"))}))}UNSAFE_componentWillReceiveProps(e){this.props.customCss!==e.customCss&&this.setState({css:e.customCss},(()=>{(0,Vt.Z)(e.customCss)}))}setShowReportSubMenu(e){this.setState({showReportSubMenu:e})}changeCss(e){this.props.onChange(),this.props.updateCss(e)}changeRefreshInterval(e,t){this.props.setRefreshFrequency(e,t),this.props.startPeriodicRender(1e3*e)}handleMenuClick(e){let{key:t,domEvent:n}=e;switch(t){case Gt:this.props.forceRefreshAllCharts(),this.props.addSuccessToast((0,c.t)("Refreshing charts"));break;case Qt:this.props.showPropertiesModal();break;case Xt:{var i,r;const e=document.querySelector(".ant-dropdown:not(.ant-dropdown-hidden)");e.style.visibility="hidden",(0,Bt.Z)(".dashboard",this.props.dashboardTitle,!0)(n).then((()=>{e.style.visibility="visible"})),null==(i=(r=this.props).logEvent)||i.call(r,mt.n2);break}case en:{const e=Wt({pathname:window.location.pathname,filters:(0,Yt.De)(),hash:window.location.hash,standalone:!(0,St.eY)(yt.KD.standalone)});window.location.replace(e);break}case tn:this.props.manageEmbedded()}}render(){var e,t;const{dashboardTitle:n,dashboardId:i,dashboardInfo:r,refreshFrequency:o,shouldPersistRefreshFrequency:a,editMode:l,customCss:d,colorNamespace:u,colorScheme:h,layout:p,expandedSlices:m,onSave:g,userCanEdit:f,userCanShare:v,userCanSave:b,userCanCurate:y,isLoading:x,refreshLimit:S,refreshWarning:Z,lastModifiedTime:w,addSuccessToast:R,addDangerToast:k,setIsDropdownVisible:T,isDropdownVisible:D,...I}=this.props,_=`${(0,c.t)("Superset dashboard")} ${n}`,$=(0,c.t)("Check out this dashboard: "),F=Wt({pathname:window.location.pathname,filters:(0,Yt.De)(),hash:window.location.hash}),M=null==(e=r.common)||null==(t=e.conf)?void 0:t.DASHBOARD_AUTO_REFRESH_INTERVALS;return(0,C.tZ)(bt.v,J()({selectable:!1},I),!l&&(0,C.tZ)(bt.v.Item,{key:Gt,disabled:x,onClick:this.handleMenuClick},(0,c.t)("Refresh dashboard")),!l&&(0,C.tZ)(bt.v.Item,{key:en,onClick:this.handleMenuClick},(0,St.eY)(yt.KD.standalone)?(0,c.t)("Exit fullscreen"):(0,c.t)("Enter fullscreen")),l&&(0,C.tZ)(bt.v.Item,{key:Qt,onClick:this.handleMenuClick},(0,c.t)("Edit properties")),l&&(0,C.tZ)(bt.v.Item,{key:"edit-css"},(0,C.tZ)(It,{triggerNode:(0,C.tZ)("span",null,(0,c.t)("Edit CSS")),initialCss:this.state.css,templates:this.state.cssTemplates,onChange:this.changeCss})),(0,C.tZ)(bt.v.Divider,null),b&&(0,C.tZ)(bt.v.Item,{key:"save-modal"},(0,C.tZ)(Lt,{addSuccessToast:this.props.addSuccessToast,addDangerToast:this.props.addDangerToast,dashboardId:i,dashboardTitle:n,dashboardInfo:r,saveType:H.kS,layout:p,expandedSlices:m,refreshFrequency:o,shouldPersistRefreshFrequency:a,lastModifiedTime:w,customCss:d,colorNamespace:u,colorScheme:h,onSave:g,triggerNode:(0,C.tZ)("span",null,(0,c.t)("Save as")),canOverwrite:f})),!l&&(0,C.tZ)(bt.v.Item,{key:Xt,onClick:this.handleMenuClick},(0,c.t)("Download as image")),v&&(0,C.tZ)(bt.v.SubMenu,{key:"share-dashboard",disabled:x,title:(0,c.t)("Share")},(0,C.tZ)(Zt,{url:F,copyMenuItemTitle:(0,c.t)("Copy permalink to clipboard"),emailMenuItemTitle:(0,c.t)("Share permalink by email"),emailSubject:_,emailBody:$,addSuccessToast:R,addDangerToast:k,dashboardId:i})),!l&&y&&(0,C.tZ)(bt.v.Item,{key:tn,onClick:this.handleMenuClick},(0,c.t)("Embed dashboard")),(0,C.tZ)(bt.v.Divider,null),l?null:this.state.showReportSubMenu?(0,C.tZ)(s.Fragment,null,(0,C.tZ)(bt.v.SubMenu,{title:(0,c.t)("Manage email report")},(0,C.tZ)(jt.Z,{dashboardId:r.id,setShowReportSubMenu:this.setShowReportSubMenu,showReportSubMenu:this.state.showReportSubMenu,setIsDropdownVisible:T,isDropdownVisible:D,useTextMenu:!0})),(0,C.tZ)(bt.v.Divider,null)):(0,C.tZ)(bt.v,null,(0,C.tZ)(jt.Z,{dashboardId:r.id,setShowReportSubMenu:this.setShowReportSubMenu,setIsDropdownVisible:T,isDropdownVisible:D,useTextMenu:!0})),l&&(0,C.tZ)(bt.v.Item,{key:"set-filter-mapping"},(0,C.tZ)(Kt.Z,{className:"m-r-5",triggerNode:(0,c.t)("Set filter mapping")})),(0,C.tZ)(bt.v.Item,{key:"autorefresh-modal"},(0,C.tZ)(Pt,{addSuccessToast:this.props.addSuccessToast,refreshFrequency:o,refreshLimit:S,refreshWarning:Z,onChange:this.changeRefreshInterval,editMode:l,refreshIntervalOptions:M,triggerNode:(0,C.tZ)("span",null,(0,c.t)("Set auto-refresh interval"))})))}}nn.propTypes=Jt,nn.defaultProps={colorNamespace:void 0,colorScheme:void 0,refreshLimit:0,refreshWarning:null};const rn=nn;var on=n(37921);const an={dashboardId:d().number,isPublished:d().bool.isRequired,savePublished:d().func.isRequired,canEdit:d().bool,canSave:d().bool},sn=(0,c.t)("This dashboard is not published, it will not show up in the list of dashboards. Click here to publish this dashboard."),ln=(0,c.t)("This dashboard is not published which means it will not show up in the list of dashboards. Favorite it to see it there or access it by using the URL directly."),dn=(0,c.t)("This dashboard is published. Click to make it a draft.");class cn extends s.Component{componentDidMount(){this.togglePublished=this.togglePublished.bind(this)}togglePublished(){this.props.savePublished(this.props.dashboardId,!this.props.isPublished)}render(){return this.props.isPublished?this.props.canEdit&&this.props.canSave?(0,C.tZ)(Q.u,{id:"published-dashboard-tooltip",placement:"bottom",title:dn},(0,C.tZ)(on.Z,{onClick:()=>{this.togglePublished()}},(0,c.t)("Published"))):null:this.props.canEdit&&this.props.canSave?(0,C.tZ)(Q.u,{id:"unpublished-dashboard-tooltip",placement:"bottom",title:sn},(0,C.tZ)(on.Z,{onClick:()=>{this.togglePublished()}},(0,c.t)("Draft"))):(0,C.tZ)(Q.u,{id:"unpublished-dashboard-tooltip",placement:"bottom",title:ln},(0,C.tZ)(on.Z,null,(0,c.t)("Draft")))}}cn.propTypes=an;const un={onUndo:d().func.isRequired,onRedo:d().func.isRequired};class hn extends s.PureComponent{constructor(e){super(e),this.handleKeydown=this.handleKeydown.bind(this)}componentDidMount(){document.addEventListener("keydown",this.handleKeydown)}componentWillUnmount(){document.removeEventListener("keydown",this.handleKeydown)}handleKeydown(e){if(e.ctrlKey||e.metaKey){const t="z"===e.key||90===e.keyCode,n="y"===e.key||89===e.keyCode,i=document&&document.querySelector(".dashboard-markdown--editing"),r=document&&document.querySelector(".editable-title--editing");i||r||!t&&!n||(e.preventDefault(),(t?this.props.onUndo:this.props.onRedo)())}}render(){return null}}hn.propTypes=un;const pn=hn;var mn=n(20818);const gn=e=>{e&&clearInterval(e)};var fn=n(52564),vn=n(22102),bn=n(9882),yn=n(74069),Cn=n(14114);const xn=(0,ut.I)(),Sn=e=>e.split(/(?:\s|,)+/).filter((e=>e)),Zn=y.iK.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`,wn=e=>{var t;let{dashboardId:n,onHide:i}=e;const{addInfoToast:r,addDangerToast:o}=(0,Cn.e1)(),[a,l]=(0,s.useState)(!0),[d,u]=(0,s.useState)(!1),[h,m]=(0,s.useState)(null),[g,f]=(0,s.useState)(""),v=`/api/v1/dashboard/${n}/embedded`,b=!h||Sn(g).join()!==h.allowed_domains.join(),y=(0,s.useCallback)((()=>{u(!0),(0,vn.Z)({method:"POST",endpoint:v})({allowed_domains:Sn(g)}).then((e=>{let{result:t}=e;m(t),f(t.allowed_domains.join(", ")),r((0,c.t)("Changes saved."))}),(e=>{console.error(e),o((0,c.t)((0,c.t)("Sorry, something went wrong. The changes could not be saved.")))})).finally((()=>{u(!1)}))}),[v,g]),x=(0,s.useCallback)((()=>{yn.Z.confirm({title:(0,c.t)("Disable embedding?"),content:(0,c.t)("This will remove your current embed configuration."),okType:"danger",onOk:()=>{u(!0),(0,vn.Z)({method:"DELETE",endpoint:v})({}).then((()=>{m(null),f(""),r((0,c.t)("Embedding deactivated.")),i()}),(e=>{console.error(e),o((0,c.t)("Sorry, something went wrong. Embedding could not be deactivated."))})).finally((()=>{u(!1)}))}})}),[v]);if((0,s.useEffect)((()=>{l(!1),(0,vn.Z)({method:"GET",endpoint:v})({}).catch((e=>{if(404===e.status)return{result:null};throw e})).then((e=>{let{result:t}=e;l(!0),m(t),f(t?t.allowed_domains.join(", "):"")}))}),[n]),!a)return(0,C.tZ)(p.Z,null);const S=xn.get("embedded.documentation.configuration_details"),Z=xn.get("embedded.documentation.description"),w=null!=(t=xn.get("embedded.documentation.url"))?t:"https://www.npmjs.com/package/@superset-ui/embedded-sdk";return(0,C.tZ)(s.Fragment,null,h?S?(0,C.tZ)(S,{embeddedId:h.uuid}):(0,C.tZ)("p",null,(0,c.t)("This dashboard is ready to embed. In your application, pass the following id to the SDK:"),(0,C.tZ)("br",null),(0,C.tZ)("code",null,h.uuid)):(0,C.tZ)("p",null,(0,c.t)("Configure this dashboard to embed it into an external web application.")),(0,C.tZ)("p",null,(0,c.t)("For further instructions, consult the")," ",(0,C.tZ)("a",{href:w,target:"_blank",rel:"noreferrer"},Z?Z():(0,c.t)("Superset Embedded SDK documentation."))),(0,C.tZ)("h3",null,(0,c.t)("Settings")),(0,C.tZ)(Ft.xJ,null,(0,C.tZ)("label",{htmlFor:"allowed-domains"},(0,c.t)("Allowed Domains (comma separated)")," ",(0,C.tZ)(bn.V,{tooltip:(0,c.t)("A list of domain names that can embed this dashboard. Leaving this field empty will allow embedding from any domain.")})),(0,C.tZ)(j.II,{name:"allowed-domains",value:g,placeholder:"superset.example.com",onChange:e=>f(e.target.value)})),(0,C.tZ)(Zn,null,h?(0,C.tZ)(s.Fragment,null,(0,C.tZ)(K.Z,{onClick:x,buttonStyle:"secondary",loading:d},(0,c.t)("Deactivate")),(0,C.tZ)(K.Z,{onClick:y,buttonStyle:"primary",disabled:!b,loading:d},(0,c.t)("Save changes"))):(0,C.tZ)(K.Z,{onClick:y,buttonStyle:"primary",loading:d},(0,c.t)("Enable embedding"))))},Rn=e=>{const{show:t,onHide:n}=e;return(0,C.tZ)(yn.Z,{show:t,onHide:n,title:(0,c.t)("Embed"),hideFooter:!0},(0,C.tZ)(wn,e))},kn=(0,n(67913).Z)((()=>n.e(783).then(n.bind(n,13070)))),Tn=()=>{const e=(0,r.v9)((e=>{let{dashboardState:t}=e;return t.overwriteConfirmMetadata}));return(0,C.tZ)(s.Fragment,null,e&&(0,C.tZ)(kn,{overwriteConfirmMetadata:e}))},Dn=(0,ut._)(),In={addSuccessToast:d().func.isRequired,addDangerToast:d().func.isRequired,addWarningToast:d().func.isRequired,user:d().object,dashboardInfo:d().object.isRequired,dashboardTitle:d().string,dataMask:d().object.isRequired,charts:d().objectOf(W.$6).isRequired,layout:d().object.isRequired,expandedSlices:d().object,customCss:d().string,colorNamespace:d().string,colorScheme:d().string,setColorScheme:d().func.isRequired,setUnsavedChanges:d().func.isRequired,isStarred:d().bool.isRequired,isPublished:d().bool.isRequired,isLoading:d().bool.isRequired,onSave:d().func.isRequired,onChange:d().func.isRequired,fetchFaveStar:d().func.isRequired,fetchCharts:d().func.isRequired,saveFaveStar:d().func.isRequired,savePublished:d().func.isRequired,updateDashboardTitle:d().func.isRequired,editMode:d().bool.isRequired,setEditMode:d().func.isRequired,showBuilderPane:d().func.isRequired,updateCss:d().func.isRequired,logEvent:d().func.isRequired,hasUnsavedChanges:d().bool.isRequired,maxUndoHistoryExceeded:d().bool.isRequired,lastModifiedTime:d().number.isRequired,onRefresh:d().func.isRequired,onUndo:d().func.isRequired,onRedo:d().func.isRequired,undoLength:d().number.isRequired,redoLength:d().number.isRequired,setMaxUndoHistoryExceeded:d().func.isRequired,maxUndoHistoryToast:d().func.isRequired,refreshFrequency:d().number,shouldPersistRefreshFrequency:d().bool.isRequired,setRefreshFrequency:d().func.isRequired,dashboardInfoChanged:d().func.isRequired,dashboardTitleChanged:d().func.isRequired},_n=e=>C.iv`
  border-bottom: 1px solid ${e.colors.grayscale.light2};
`,$n=e=>C.iv`
  color: ${e.colors.primary.dark2};
`,Fn=e=>C.iv`
  display: flex;
  align-items: center;

  .action-schedule-report {
    margin-left: ${2*e.gridUnit}px;
  }

  .undoRedo {
    display: flex;
    margin-right: ${2*e.gridUnit}px;
  }
`,Mn=(0,y.iK)(V.C0)`
  padding: 0;
  &:hover {
    background: transparent;
  }
`,En=e=>C.iv`
  color: ${e.colors.grayscale.light1};
  &:hover {
    color: ${e.colors.grayscale.base};
  }
`,On=e=>C.iv`
  color: ${e.colors.grayscale.base};
`,zn=e=>C.iv`
  color: ${e.colors.grayscale.light2};
`,Pn=e=>C.iv`
  min-width: ${17*e.gridUnit}px;
  height: ${8*e.gridUnit}px;
`,Un=e=>C.iv`
  min-width: ${22*e.gridUnit}px;
  height: ${8*e.gridUnit}px;
`;class Nn extends s.PureComponent{static discardChanges(){const e=new URL(window.location.href);e.searchParams.delete("edit"),window.location.assign(e)}constructor(e){super(e),this.showEmbedModal=()=>{this.setState({showingEmbedModal:!0})},this.hideEmbedModal=()=>{this.setState({showingEmbedModal:!1})},this.state={didNotifyMaxUndoHistoryToast:!1,emphasizeUndo:!1,emphasizeRedo:!1,showingPropertiesModal:!1,isDropdownVisible:!1},this.handleChangeText=this.handleChangeText.bind(this),this.handleCtrlZ=this.handleCtrlZ.bind(this),this.handleCtrlY=this.handleCtrlY.bind(this),this.toggleEditMode=this.toggleEditMode.bind(this),this.forceRefresh=this.forceRefresh.bind(this),this.startPeriodicRender=this.startPeriodicRender.bind(this),this.overwriteDashboard=this.overwriteDashboard.bind(this),this.showPropertiesModal=this.showPropertiesModal.bind(this),this.hidePropertiesModal=this.hidePropertiesModal.bind(this),this.setIsDropdownVisible=this.setIsDropdownVisible.bind(this)}componentDidMount(){const{refreshFrequency:e}=this.props;this.startPeriodicRender(1e3*e)}componentDidUpdate(e){if(this.props.refreshFrequency!==e.refreshFrequency){const{refreshFrequency:e}=this.props;this.startPeriodicRender(1e3*e)}}UNSAFE_componentWillReceiveProps(e){H.Q9-e.undoLength<=0&&!this.state.didNotifyMaxUndoHistoryToast&&(this.setState((()=>({didNotifyMaxUndoHistoryToast:!0}))),this.props.maxUndoHistoryToast()),e.undoLength>H.Q9&&!this.props.maxUndoHistoryExceeded&&this.props.setMaxUndoHistoryExceeded()}componentWillUnmount(){gn(this.refreshTimer),this.props.setRefreshFrequency(0),clearTimeout(this.ctrlYTimeout),clearTimeout(this.ctrlZTimeout)}handleChangeText(e){const{updateDashboardTitle:t,onChange:n}=this.props;e&&this.props.dashboardTitle!==e&&(t(e),n())}setIsDropdownVisible(e){this.setState({isDropdownVisible:e})}handleCtrlY(){this.props.onRedo(),this.setState({emphasizeRedo:!0},(()=>{this.ctrlYTimeout&&clearTimeout(this.ctrlYTimeout),this.ctrlYTimeout=setTimeout((()=>{this.setState({emphasizeRedo:!1})}),100)}))}handleCtrlZ(){this.props.onUndo(),this.setState({emphasizeUndo:!0},(()=>{this.ctrlZTimeout&&clearTimeout(this.ctrlZTimeout),this.ctrlZTimeout=setTimeout((()=>{this.setState({emphasizeUndo:!1})}),100)}))}forceRefresh(){if(!this.props.isLoading){const e=Object.keys(this.props.charts);return this.props.logEvent(mt.H3,{force:!0,interval:0,chartCount:e.length}),this.props.onRefresh(e,!0,0,this.props.dashboardInfo.id)}return!1}startPeriodicRender(e){let t;if(e){var n,i;const{dashboardInfo:r}=this.props,o=(null==(n=r.common)||null==(i=n.conf)?void 0:i.DASHBOARD_AUTO_REFRESH_INTERVALS).find((t=>Number(t[0])===e/1e3));t=o?(0,c.t)(o[1]):ct().duration(e,"millisecond").humanize()}this.refreshTimer=function(e){let{interval:t=0,periodicRender:n,refreshTimer:i}=e;return gn(i),t>0?setInterval(n,t):0}({interval:e,periodicRender:()=>{const{fetchCharts:n,logEvent:i,charts:r,dashboardInfo:o}=this.props,{metadata:a}=o,s=a.timed_refresh_immune_slices||[],l=Object.values(r).filter((e=>-1===s.indexOf(e.id))).map((e=>e.id));return i(mt.S,{interval:e,chartCount:l.length}),this.props.addWarningToast((0,c.t)("This dashboard is currently auto refreshing; the next auto refresh will be in %s.",t)),"fetch"===o.common.conf.DASHBOARD_AUTO_REFRESH_MODE?n(l,!1,.2*e,o.id):n(l,!0,.2*e,o.id)},refreshTimer:this.refreshTimer})}toggleEditMode(){this.props.logEvent(mt.vH,{edit_mode:!this.props.editMode}),this.props.setEditMode(!this.props.editMode)}overwriteDashboard(){var e,t,n;const{dashboardTitle:i,layout:r,colorScheme:o,colorNamespace:a,customCss:s,dashboardInfo:l,refreshFrequency:d,shouldPersistRefreshFrequency:u,lastModifiedTime:h,slug:p}=this.props,m=u?d:null==(e=l.metadata)?void 0:e.refresh_frequency,g=(null==l||null==(t=l.metadata)?void 0:t.color_scheme)||o,f=(null==l||null==(n=l.metadata)?void 0:n.color_namespace)||a,v=Object.fromEntries((0,ht.ZP)().getColorMap()),b={certified_by:l.certified_by,certification_details:l.certification_details,css:s,dashboard_title:i,last_modified_time:h,owners:l.owners,roles:l.roles,slug:p,metadata:{...null==l?void 0:l.metadata,color_namespace:f,color_scheme:g,positions:r,refresh_frequency:m,shared_label_colors:v}},y=(0,ft.o)(r).length,C=l.common.conf.SUPERSET_DASHBOARD_POSITION_DATA_LIMIT||H.Bu;y>=C?this.props.addDangerToast((0,c.t)("Your dashboard is too large. Please reduce its size before saving it.")):(y>=.9*C&&this.props.addWarningToast("Your dashboard is near the size limit."),this.props.onSave(b,l.id,H.TN))}showPropertiesModal(){this.setState({showingPropertiesModal:!0})}hidePropertiesModal(){this.setState({showingPropertiesModal:!1})}render(){var e,t,n,i;const{dashboardTitle:r,layout:o,expandedSlices:a,customCss:s,colorNamespace:l,dataMask:d,setColorScheme:h,setUnsavedChanges:p,colorScheme:m,onUndo:g,onRedo:f,undoLength:v,redoLength:b,onChange:y,onSave:x,updateCss:S,editMode:Z,isPublished:w,user:R,dashboardInfo:k,hasUnsavedChanges:T,isLoading:D,refreshFrequency:I,shouldPersistRefreshFrequency:_,setRefreshFrequency:$,lastModifiedTime:F,logEvent:M}=this.props,E=k.dash_edit_perm&&!k.is_managed_externally,O=k.dash_share_perm,z=k.dash_save_perm,P=(0,pt.cr)(u.T.EMBEDDED_SUPERSET)&&(0,gt.R)("can_set_embedded","Dashboard",R.roles),U=null==(e=k.common)||null==(t=e.conf)?void 0:t.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT,N=null==(n=k.common)||null==(i=n.conf)?void 0:i.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE,q=Dn.get("dashboard.nav.right");return(0,C.tZ)("div",{css:_n,"data-test-id":k.id,className:"dashboard-header-container"},(0,C.tZ)(fn.u,{editableTitleProps:{title:r,canEdit:E&&Z,onSave:this.handleChangeText,placeholder:(0,c.t)("Add the name of the dashboard"),label:(0,c.t)("Dashboard title"),showTooltip:!1},certificatiedBadgeProps:{certifiedBy:k.certified_by,details:k.certification_details},faveStarProps:{itemId:k.id,fetchFaveStar:this.props.fetchFaveStar,saveFaveStar:this.props.saveFaveStar,isStarred:this.props.isStarred,showTooltip:!0},titlePanelAdditionalItems:[!Z&&(0,C.tZ)(cn,{dashboardId:k.id,isPublished:w,savePublished:this.props.savePublished,canEdit:E,canSave:z,visible:!Z})],rightPanelAdditionalItems:(0,C.tZ)("div",{className:"button-container"},z&&(0,C.tZ)("div",{className:"button-container"},Z&&(0,C.tZ)("div",{css:Fn},(0,C.tZ)("div",{className:"undoRedo"},(0,C.tZ)(Q.u,{id:"dashboard-undo-tooltip",title:(0,c.t)("Undo the action")},(0,C.tZ)(Mn,{type:"text",disabled:v<1},(0,C.tZ)(B.Z.Undo,{css:[En,this.state.emphasizeUndo&&On,v<1&&zn,"",""],onClick:v&&g,iconSize:"xl"}))),(0,C.tZ)(Q.u,{id:"dashboard-redo-tooltip",title:(0,c.t)("Redo the action")},(0,C.tZ)(Mn,{type:"text",disabled:b<1},(0,C.tZ)(B.Z.Redo,{css:[En,this.state.emphasizeRedo&&On,b<1&&zn,"",""],onClick:b&&f,iconSize:"xl"})))),(0,C.tZ)(K.Z,{css:Un,buttonSize:"small",onClick:this.constructor.discardChanges,buttonStyle:"default","aria-label":(0,c.t)("Discard")},(0,c.t)("Discard")),(0,C.tZ)(K.Z,{css:Pn,buttonSize:"small",disabled:!T,buttonStyle:"primary",onClick:this.overwriteDashboard,"aria-label":(0,c.t)("Save")},(0,c.t)("Save")))),Z?(0,C.tZ)(pn,{onUndo:this.handleCtrlZ,onRedo:this.handleCtrlY}):(0,C.tZ)("div",{css:Fn},q&&(0,C.tZ)(q,null),E&&(0,C.tZ)(K.Z,{buttonStyle:"secondary",onClick:this.toggleEditMode,className:"action-button",css:$n,"aria-label":(0,c.t)("Edit dashboard")},(0,c.t)("Edit dashboard")))),menuDropdownProps:{getPopupContainer:e=>e.closest(".header-with-actions"),visible:this.state.isDropdownVisible,onVisibleChange:this.setIsDropdownVisible},additionalActionsMenu:(0,C.tZ)(rn,{addSuccessToast:this.props.addSuccessToast,addDangerToast:this.props.addDangerToast,dashboardId:k.id,dashboardTitle:r,dashboardInfo:k,dataMask:d,layout:o,expandedSlices:a,customCss:s,colorNamespace:l,colorScheme:m,onSave:x,onChange:y,forceRefreshAllCharts:this.forceRefresh,startPeriodicRender:this.startPeriodicRender,refreshFrequency:I,shouldPersistRefreshFrequency:_,setRefreshFrequency:$,updateCss:S,editMode:Z,hasUnsavedChanges:T,userCanEdit:E,userCanShare:O,userCanSave:z,userCanCurate:P,isLoading:D,showPropertiesModal:this.showPropertiesModal,manageEmbedded:this.showEmbedModal,refreshLimit:U,refreshWarning:N,lastModifiedTime:F,isDropdownVisible:this.state.isDropdownVisible,setIsDropdownVisible:this.setIsDropdownVisible,logEvent:M}),showFaveStar:(null==R?void 0:R.userId)&&(null==k?void 0:k.id),showTitlePanelItems:!0}),this.state.showingPropertiesModal&&(0,C.tZ)(mn.Z,{dashboardId:k.id,dashboardInfo:k,dashboardTitle:r,show:this.state.showingPropertiesModal,onHide:this.hidePropertiesModal,colorScheme:this.props.colorScheme,onSubmit:e=>{const{dashboardInfoChanged:t,dashboardTitleChanged:n}=this.props;h(e.colorScheme),t({slug:e.slug,metadata:JSON.parse(e.jsonMetadata||"{}"),certified_by:e.certifiedBy,certification_details:e.certificationDetails,owners:e.owners,roles:e.roles}),p(!0),n(e.title)},onlyApply:!0}),(0,C.tZ)(Tn,null),P&&(0,C.tZ)(Rn,{show:this.state.showingEmbedModal,onHide:this.hideEmbedModal,dashboardId:k.id}),(0,C.tZ)(C.xB,{styles:C.iv`
            .ant-menu-vertical {
              border-right: none;
            }
          `}))}}Nn.propTypes=In,Nn.defaultProps={colorNamespace:void 0,colorScheme:void 0};const qn=Nn;function An(e){return Object.values(e).some((e=>e.chartUpdateStartTime>(e.chartUpdateEndTime||0)))}var Ln=n(41295),jn=n(9467),Vn=n(12885),Kn=n(72570),Bn=n(97381),Hn=n(61358);const Wn=(0,r.$j)((function(e){let{dashboardLayout:t,dashboardState:n,reports:i,dashboardInfo:r,charts:o,dataMask:a,user:s}=e;return{dashboardInfo:r,undoLength:t.past.length,redoLength:t.future.length,layout:t.present,dashboardTitle:((t.present[H.M2]||{}).meta||{}).text,expandedSlices:n.expandedSlices,refreshFrequency:n.refreshFrequency,shouldPersistRefreshFrequency:!!n.shouldPersistRefreshFrequency,customCss:n.css,colorNamespace:n.colorNamespace,colorScheme:n.colorScheme,charts:o,dataMask:a,user:s,isStarred:!!n.isStarred,isPublished:!!n.isPublished,isLoading:An(o),hasUnsavedChanges:!!n.hasUnsavedChanges,maxUndoHistoryExceeded:!!n.maxUndoHistoryExceeded,lastModifiedTime:Math.max(n.lastModifiedTime,r.last_modified_time),editMode:!!n.editMode,slug:r.slug,metadata:r.metadata,reports:i}}),(function(e){return(0,i.DE)({addSuccessToast:Kn.ws,addDangerToast:Kn.Gb,addWarningToast:Kn.Dz,onUndo:Vn.Ou,onRedo:Vn.az,setEditMode:jn.Mb,showBuilderPane:jn.O8,setColorScheme:jn.uW,setUnsavedChanges:jn.if,fetchFaveStar:jn.Lb,saveFaveStar:jn.TN,savePublished:jn.dr,fetchCharts:jn.Mn,updateDashboardTitle:Vn.A7,updateCss:jn.Sn,onChange:jn.z2,onSave:jn.M8,setMaxUndoHistoryExceeded:jn.uN,maxUndoHistoryToast:jn.Qt,logEvent:Bn.logEvent,setRefreshFrequency:jn.fE,onRefresh:jn.Yy,dashboardInfoChanged:Ln.a8,dashboardTitleChanged:Vn.Ww,updateDataMask:lt.eG,fetchUISpecificReport:Hn.Aw},e)}))(qn),Yn=y.iK.div`
  display: flex;
  align-items: center;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  &:hover {
    color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  }
`,Jn=y.iK.span`
  margin-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
`,Gn=e=>{let{icon:t,label:n,onClick:i}=e;return(0,C.tZ)(Yn,{tabIndex:0,role:"button",onClick:e=>{e.preventDefault(),i(e)}},t,n&&(0,C.tZ)(Jn,null,n))};var Qn=n(76697),Xn=n(13433),ei=n(98286);function ti(e){let{dashboardId:t,anchorLinkId:n,placement:i="right",emailContent:o="",emailSubject:a=""}=e;const[l,d]=(0,s.useState)(""),{addDangerToast:u}=(0,Cn.e1)(),{dataMask:h,activeTabs:p}=(0,r.v9)((e=>({dataMask:e.dataMask,activeTabs:e.dashboardState.activeTabs}))),m=`mailto:?Subject=${a}%20&Body=${o}${l||""}`;return(0,C.tZ)(Qn.ZP,{trigger:"click",placement:i,content:(0,C.tZ)("div",{id:"shorturl-popover",onClick:e=>{e.stopPropagation()}},(0,C.tZ)(Xn.Z,{text:l,copyNode:(0,C.tZ)("i",{className:"fa fa-clipboard",title:(0,c.t)("Copy to clipboard")})}),"  ",(0,C.tZ)("a",{href:m},(0,C.tZ)("i",{className:"fa fa-envelope"})))},(0,C.tZ)("span",{className:"short-link-trigger btn btn-default btn-sm",tabIndex:0,role:"button",onClick:e=>{e.stopPropagation(),(async()=>{try{const e=await(0,St.Nm)({dashboardId:t,dataMask:h,activeTabs:p,anchor:n});d(e)}catch(e){e&&u((await(0,ei.O$)(e)).error||(0,c.t)("Something went wrong."))}})()}},(0,C.tZ)("i",{className:"short-link-trigger fa fa-link"})," "))}var ni=n(56967);function ii(e){let{id:t,dashboardId:n,placement:i="right",scrollIntoView:r=!1,showShortLinkButton:o=!0}=e;const a=e=>{const t=document.getElementById(e);t&&t.scrollIntoView({block:"center",behavior:"smooth"})},l=(0,ni.Z)();return(0,s.useEffect)((()=>{l&&t===l&&a(t)}),[l,t]),(0,s.useEffect)((()=>{r&&a(t)}),[t,r]),(0,C.tZ)("span",{className:"anchor-link-container",id:t},o&&n&&(0,C.tZ)(ti,{anchorLinkId:t,dashboardId:n,emailSubject:(0,c.t)("Superset chart"),emailContent:(0,c.t)("Check out this chart in dashboard:"),placement:i}))}var ri,oi=n(81395),ai=n(52256),si=n(91914),li=n(18446),di=n.n(li),ci=n(16550),ui=n(12515),hi=n(32657),pi=n(99543),mi=n(40219),gi=n(29147),fi=n(38270),vi=n(73727),bi=n(11064),yi=n(16355),Ci=n(88694),xi=n(32873),Si=n(65013);!function(e){e[e.all=0]="all",e[e.specific=1]="specific"}(ri||(ri={}));const Zi=(e,t)=>{var n,i;let{type:r,meta:o}=e;return!(r!==g.gn&&r!==g.dW&&r!==g.U0||t&&"filter_box"===(null==(n=t[null==o?void 0:o.chartId])||null==(i=n.form_data)?void 0:i.viz_type))},wi=(e,t,n,i,r,o,s)=>{var l;let d=t;if(e&&t&&Zi(e,i)&&e.type!==g.U0&&null!=r&&null!=a()(r)&&a()(r).call(r,e.id)){var u;const n=s((e=>{var t,n,i,r,o,a,s,l,d,c;return null!=(t=null!=(n=null!=(i=null!=(r=null!=(o=null==e||null==(a=e.meta)?void 0:a.sliceNameOverride)?o:null==e||null==(s=e.meta)?void 0:s.sliceName)?r:null==e||null==(l=e.meta)?void 0:l.text)?i:null==e||null==(d=e.meta)?void 0:d.defaultText)?n:null==e||null==(c=e.id)||null==c.toString?void 0:c.toString())?t:""})(e),null==o||null==a()(o)?void 0:a()(o).call(o,null==(u=e.meta)?void 0:u.chartId),(0,c.t)("This chart might be incompatible with the filter (datasets don't match)")),i={key:e.id,title:n,children:[]};t.children.push(i),d=i}null==e||null==(l=e.children)||null==l.forEach||l.forEach((e=>{const t=null==n?void 0:n[e];t?wi(t,d,n,i,r,o,s):xt.Z.warn(`Unable to find item with id: ${e} in the dashboard layout. This may indicate you have invalid references in your dashboard and the references to id: ${e} should be removed.`)}))},Ri=(e,t,n,i)=>{n.forEach((n=>{var r,o;Ri(e,t,((e,t)=>{var n;return[...(null==(n=e[t])?void 0:n.children)||[],...Object.values(e).filter((n=>n.parents&&n.parents[n.parents.length-1]===t&&!Zi(e[n.parents[n.parents.length-1]]))).map((e=>{let{id:t}=e;return t}))]})(t,n),i),(null==(r=t[n])?void 0:r.type)!==g.dW||a()(i).call(i,null==(o=t[n])?void 0:o.meta.chartId)||e.push(n)}))},ki=function(e,t){return void 0===t&&(t=[]),{rootPath:[H._4],excluded:e?[e,...t]:t}},Ti=(e,t)=>!e||e.rootPath[0]===H._4&&!e.excluded.filter((e=>e!==t)).length,Di=(e,t,n)=>{let i=(0,C.tZ)("span",null,e);return t&&(i=(0,C.tZ)(s.Fragment,null,i," ",(0,C.tZ)(Q.u,{title:n},(0,C.tZ)(B.Z.Info,{iconSize:"m"})))),i},Ii=e=>{let{formScope:t,initialScope:n,forceUpdate:i,updateFormValues:o,chartId:l,initiallyExcludedCharts:d=[]}=e;const[u,h]=(0,s.useState)([H._4]),{treeData:p,layout:m}=function(e,t,n){void 0===t&&(t=[]),void 0===n&&(n=e=>e);const i=(0,r.v9)((e=>{let{dashboardLayout:{present:t}}=e;return t})),o=(0,r.v9)((e=>{let{charts:t}=e;return t})),a={children:[],key:H._4,type:g.U0,title:(0,c.t)("All panels")},l=(0,s.useMemo)((()=>Object.values(i).reduce(((t,n)=>{const{id:i,parents:r=[],type:o,meta:a}=n;return o===g.dW&&e!==(null==a?void 0:a.chartId)?[...new Set([...t,...r,i])]:t}),[])),[i,e]);return(0,s.useMemo)((()=>{wi(i[H._4],a,i,o,l,t,n)}),[i,a,o,t,n]),{treeData:[a],layout:i}}(l,d,Di),[f,v]=(0,s.useState)(!0),b=(0,s.useMemo)((()=>((e,t)=>{const n=[];return Ri(n,t,[...e.rootPath],[...e.excluded]),[...new Set(n)]})({...t||n},m)),[t,n,m]);return(0,C.tZ)(V.mp,{checkable:!0,selectable:!1,onExpand:e=>{h(e),v(!1)},expandedKeys:u,autoExpandParent:f,onCheck:e=>{i();const t=((e,t)=>{if(!e.length)return{rootPath:[],excluded:[]};const n=e.filter((e=>{var n;return(null==(n=t[e])?void 0:n.type)===g.dW})).map((e=>{var n;return[H._4,...(null==(n=t[e])?void 0:n.parents)||[]].filter((e=>Zi(t[e])))}));n.sort(((e,t)=>e.length-t.length));const i=n.map((e=>e[n[0].length-1])),r=[];return Object.entries(t).forEach((t=>{var n;let[o,s]=t;const l=s.parents||[];s.type===g.dW&&null!=(n=[H._4,...l])&&n.find((t=>((t,n)=>a()(i).call(i,t)&&!a()(e).call(e,n))(t,o)))&&r.push(s.meta.chartId)})),{rootPath:[...new Set(i)],excluded:r}})(e,m);void 0!==l&&(t.excluded=[...new Set([...t.excluded,l])]),o({scope:t})},checkedKeys:b,treeData:p})},_i=y.iK.div`
  display: flex;
  flex-direction: column;
  & > * {
    margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
  padding: 0px ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
`,$i=(0,y.iK)(V.qz.Item)`
  margin-bottom: 0;
`,Fi=e=>{let{pathToFormValue:t=[],formScopingType:n,formFilterScope:i,forceUpdate:r,filterScope:o,updateFormValues:a,chartId:l,initiallyExcludedCharts:d}=e;const[u]=(0,s.useState)(o||ki(l,d)),[h]=(0,s.useState)(Ti(u,l)?ri.all:ri.specific),[p,m]=(0,s.useState)(!!o),g=(0,s.useCallback)((e=>{a(e),m(!0)}),[a]),f=(0,s.useCallback)((()=>{if(o||p)return;const e=ki(l,d);a({scope:e,scoping:Ti(e,l)?ri.all:ri.specific})}),[l,o,p,d,a]);return(0,Si.d)(f),(0,C.tZ)(_i,null,(0,C.tZ)($i,{name:[...t,"scoping"],initialValue:h},(0,C.tZ)(Ut.Y.Group,{onChange:e=>{let{target:{value:t}}=e;if(t===ri.all){const e=ki(l);a({scope:e})}m(!0),r()}},(0,C.tZ)(Ut.Y,{value:ri.all},(0,c.t)("Apply to all panels")),(0,C.tZ)(Ut.Y,{value:ri.specific},(0,c.t)("Apply to specific panels")))),(0,C.tZ)(V.ZT.Text,{type:"secondary"},(null!=n?n:h)===ri.specific?(0,c.t)("Only selected panels will be affected by this filter"):(0,c.t)("All panels with this column will be affected by this filter")),(null!=n?n:h)===ri.specific&&(0,C.tZ)(Ii,{updateFormValues:g,initialScope:u,formScope:i,forceUpdate:r,chartId:l,initiallyExcludedCharts:d}),(0,C.tZ)($i,{name:[...t,"scope"],hidden:!0,initialValue:u}))};var Mi=n(10752),Ei=n.n(Mi),Oi=n(88889),zi=n(55786);const Pi="filters",Ui={filter_time:[Oi.Z.TEMPORAL],filter_timegrain:[Oi.Z.TEMPORAL],filter_timecolumn:[Oi.Z.TEMPORAL],filter_select:[Oi.Z.BOOLEAN,Oi.Z.STRING,Oi.Z.NUMERIC,Oi.Z.TEMPORAL],filter_range:[Oi.Z.NUMERIC]},Ni=function(e){void 0===e&&(e=!0);const[,t]=s.useState({});return s.useCallback((()=>{e&&t({})}),[e])},qi=(e,t,n)=>{const i=e.getFieldValue(Pi)||{};e.setFields([{name:Pi,value:{...i,[t]:{...i[t],...n}}}])},Ai=e=>({value:e.id,label:e.table_name}),Li=e=>{const t=(0,zi.Z)(null==e?void 0:e.column_types);return 0===t.length||a()(t).call(t,Oi.Z.TEMPORAL)},ji=(e,t)=>{var n;return!t.type_generic||!(e in Ui)||(null==(n=Ui[e])?void 0:a()(n).call(n,t.type_generic))},Vi=e=>{let{form:t,scope:n,chartId:i}=e;const r=Ni(),o=t.getFieldValue("scope"),a=t.getFieldValue("scoping");return(0,C.tZ)(Fi,{updateFormValues:e=>{((e,t)=>{e.setFieldsValue({...t})})(t,{...e})},filterScope:n,chartId:i,formFilterScope:o,forceUpdate:r,formScopingType:a})};var Ki=n(41609),Bi=n.n(Ki),Hi=n(89734),Wi=n.n(Hi),Yi=n(44908),Ji=n.n(Yi),Gi=n(68122);const Qi=function(e,t){return void 0===t&&(t=!1),function(n,i){void 0===i&&(i=!1);const r=i||t;if(!n&&e)return r?e:{"data-test":e};if(n&&!e)return r?n:{"data-test":n};if(!n&&!e)return console.warn('testWithId function has missed "prefix" and "id" params'),r?"":{"data-test":""};const o=`${e}__${n}`;return r?o:{"data-test":o}}};var Xi=n(10916);const er=[];function tr(){return(0,r.v9)((e=>{var t,n;return(null==(t=e.dashboardInfo)||null==(n=t.metadata)?void 0:n.native_filter_configuration)||er}))}function nr(){return(0,r.v9)((e=>{var t;return null==(t=e.dashboardLayout)?void 0:t.present}))}function ir(){const e=nr();return(0,s.useMemo)((()=>Object.values(e).some((e=>e.type===g.gn))),[e])}var rr=n(27034),or=n(22068);const ar="FILTER",sr=y.iK.div`
  ${e=>{let{isDragging:t,theme:n}=e;return`\n    opacity: ${t?.3:1};\n    cursor: ${t?"grabbing":"pointer"};\n    width: 100%;\n    display: flex;\n    padding:  ${n.gridUnit}px;\n  `}}
`,lr=(0,y.iK)(B.Z.Drag,{shouldForwardProp:e=>"isDragging"!==e})`
  ${e=>{let{isDragging:t,theme:n}=e;return`\n    font-size: ${n.typography.sizes.m}px;\n    margin-top: 15px;\n    cursor: ${t?"grabbing":"grab"};\n    padding-left: ${n.gridUnit}px;\n  `}}
`;var dr={name:"82a6rk",styles:"flex:1"};const cr=e=>{let{index:t,onRearrange:n,filterIds:i,children:r}=e;const o=(0,s.useRef)(null),[{isDragging:a},l]=(0,rr.c)({item:{filterIds:i,type:ar,index:t},collect:e=>({isDragging:e.isDragging()})}),[,d]=(0,or.L)({accept:ar,hover:(e,i)=>{var r;if(!o.current)return;const a=e.index,s=t;if(a===s)return;const l=null==(r=o.current)?void 0:r.getBoundingClientRect(),d=(l.bottom-l.top)/2,c=i.getClientOffset().y-l.top;a<s&&c<d||a>s&&c>d||(n(a,s),e.index=s)}});return l(d(o)),(0,C.tZ)(sr,{ref:o,isDragging:a},(0,C.tZ)(lr,{isDragging:a,alt:"Move icon",className:"dragIcon",viewBox:"4 4 16 16"}),(0,C.tZ)("div",{css:dr},r))},ur=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n      display: flex;\n      align-items: center;\n      padding: ${2*t.gridUnit}px;\n      width: 100%;\n      border-radius: ${t.borderRadius}px;\n      &.active {\n        color: ${t.colors.grayscale.dark1};\n        border-radius: ${t.borderRadius}px;\n        background-color: ${t.colors.secondary.light4};\n        span, .anticon {\n          color: ${t.colors.grayscale.dark1};\n        }\n      }\n      &:hover {\n        color: ${t.colors.primary.light1};\n        span, .anticon {\n          color: ${t.colors.primary.light1};\n        }\n      }\n      &.errored div, &.errored .warning {\n        color: ${t.colors.error.base};\n      }\n  `}}
`,hr=(0,y.iK)(B.Z.Trash)`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light3}};
`,pr=(0,y.iK)(B.Z.Warning)`
  color: ${e=>{let{theme:t}=e;return t.colors.error.base}};
  &.anticon {
    margin-left: auto;
  }
`,mr=y.iK.div`
  height: 100%;
  overflow-y: auto;
`;var gr={name:"7whenc",styles:"display:flex;width:100%"},fr={name:"1vr7vmn",styles:"align-items:center;display:flex"},vr={name:"1je5tt7",styles:"align-self:flex-end;margin-left:auto"},br={name:"an0ls6",styles:"align-self:flex-start;margin-left:auto"};const yr=(0,s.forwardRef)(((e,t)=>{let{getFilterTitle:n,onChange:i,onRemove:r,restoreFilter:o,onRearrange:s,currentFilterId:l,removedFilters:d,filters:u,erroredFilters:h=[]}=e;return(0,C.tZ)(mr,{ref:t},(()=>{const e=[];return u.forEach(((t,u)=>{e.push((0,C.tZ)(cr,{key:u,onRearrange:s,index:u,filterIds:[t]},(e=>{const t=!!d[e],s=a()(h).call(h,e),u=l===e,p=[];return s&&p.push("errored"),u&&p.push("active"),(0,C.tZ)(ur,{role:"tab",key:`filter-title-tab-${e}`,onClick:()=>i(e),className:p.join(" ")},(0,C.tZ)("div",{css:gr},(0,C.tZ)("div",{css:fr},t?(0,c.t)("(Removed)"):n(e)),!d[e]&&s&&(0,C.tZ)(pr,{className:"warning"}),t&&(0,C.tZ)("span",{css:vr,role:"button",tabIndex:0,onClick:t=>{t.preventDefault(),o(e)}},(0,c.t)("Undo?"))),(0,C.tZ)("div",{css:br},t?null:(0,C.tZ)(hr,{onClick:t=>{t.stopPropagation(),r(e)},alt:"RemoveFilter"})))})(t)))})),e})())})),Cr=yr,xr=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n  cursor: pointer;\n  margin: ${4*t.gridUnit}px;\n  color: ${t.colors.primary.base};\n  &:hover {\n    color: ${t.colors.primary.dark1};\n  }\n`}}
`,Sr=y.iK.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`,Zr=[{label:(0,c.t)("Filter"),type:Xi.BE.NATIVE_FILTER},{label:(0,c.t)("Divider"),type:Xi.BE.DIVIDER}],wr=e=>{let{getFilterTitle:t,onChange:n,onAdd:i,onRemove:r,onRearrange:o,restoreFilter:a,currentFilterId:l,filters:d,removedFilters:u,erroredFilters:h}=e;const p=(0,s.useRef)(null),m=(0,y.Fg)(),g=(0,C.tZ)(bt.$,{mode:"horizontal"},Zr.map((e=>(0,C.tZ)(bt.$.Item,{onClick:()=>{return t=e.type,i(t),void setTimeout((()=>{var e;const t=document.getElementById("native-filters-tabs");if(t){const e=t.getElementsByClassName("ant-tabs-nav-list")[0];e.scrollTop=e.scrollHeight}null==p||null==(e=p.current)||null==e.scroll||e.scroll({top:p.current.scrollHeight,behavior:"smooth"})}),0);var t}},e.label))));return(0,C.tZ)(Sr,null,(0,C.tZ)(V.Gj,{overlay:g,arrow:!0,placement:"topLeft",trigger:["hover"]},(0,C.tZ)(xr,null,(0,C.tZ)("div",{className:"fa fa-plus"})," ",(0,C.tZ)("span",null,(0,c.t)("Add filters and dividers")))),(0,C.tZ)("div",{css:(0,C.iv)({height:"100%",overflowY:"auto",marginLeft:3*m.gridUnit},"","")},(0,C.tZ)(Cr,{ref:p,filters:d,currentFilterId:l,removedFilters:u,getFilterTitle:t,erroredFilters:h,onChange:n,onRemove:r,onRearrange:o,restoreFilter:a})))},Rr=y.iK.div`
  display: flex;
  height: 100%;
`,kr=y.iK.div`
  flex-grow: 3;
  margin-left: ${e=>{let{theme:t}=e;return-1*t.gridUnit-1}};
`,Tr=y.iK.div`
  min-width: 270px;
  border-right: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
`,Dr=e=>{let{getFilterTitle:t,onChange:n,onRemove:i,onRearrange:r,restoreFilter:o,onAdd:a,erroredFilters:s,children:l,currentFilterId:d,filters:c,removedFilters:u}=e;return(0,C.tZ)(Rr,null,(0,C.tZ)(Tr,null,(0,C.tZ)(wr,{currentFilterId:d,filters:c,removedFilters:u,erroredFilters:s,getFilterTitle:t,onChange:n,onAdd:e=>a(e),onRearrange:r,onRemove:e=>i(e),restoreFilter:o})),(0,C.tZ)(kr,null,l))};var Ir=n(43700);const _r=y.iK.div`
  display: flex;
  flex-direction: row;
  background-color: ${e=>{let{level:t,theme:n}=e;return n.colors[t].light2}};
  border-radius: ${e=>{let{theme:t}=e;return t.borderRadius}}px;
  border: 1px solid ${e=>{let{level:t,theme:n}=e;return n.colors[t].base}};
  color: ${e=>{let{level:t,theme:n}=e;return n.colors[t].dark2}};
  padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  width: 100%;
`,$r=y.iK.div`
  display: flex;
  flex-direction: column;
  margin-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
`,Fr=y.iK.span`
  font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
`;function Mr(e){let{body:t,level:n="error",title:i}=e;const r=(0,y.Fg)().colors[n].base;return(0,C.tZ)(_r,{level:n,role:"alert"},"error"===n?(0,C.tZ)(B.Z.ErrorSolid,{iconColor:r}):(0,C.tZ)(B.Z.WarningSolid,{iconColor:r}),(0,C.tZ)($r,null,(0,C.tZ)(Fr,null,i),(0,C.tZ)("p",null,t)))}var Er=n(1090),Or=n(61890),zr=n(77997),Pr=n(65108),Ur=n(78676),Nr=n(1510);const qr=y.iK.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: ${e=>{let{theme:t}=e;return 10*t.gridUnit}}px;
  padding-top: ${e=>{let{theme:t}=e;return 2*t.gridUnit+2}}px;

  .checkbox {
    margin-bottom: ${e=>{let{theme:t,checked:n}=e;return n?t.gridUnit:0}}px;
  }

  & > div {
    margin-bottom: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }
`,Ar=y.iK.div`
  margin-left: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
`,Lr=e=>{const{checked:t,disabled:n,title:i,tooltip:r,children:o,onChange:a=(()=>{}),initialValue:l=!1}=e,[d,c]=(0,s.useState)(l);return(0,s.useEffect)((()=>{void 0!==t&&c(t)}),[t]),(0,C.tZ)(qr,{checked:d},(0,C.tZ)(V.r4,{className:"checkbox",checked:d,disabled:n,onChange:e=>{const n=e.target.checked;void 0===t&&c(n),a(n)}},(0,C.tZ)(s.Fragment,null,i," ",r&&(0,C.tZ)(bn.V,{placement:"top",tooltip:r}))),d&&(0,C.tZ)(Ar,null,o))};var jr=n(28615);const Vr=new Map,Kr=(0,Pr.g)(vt.Z.get,Vr,(e=>{let{endpoint:t}=e;return t||""}));function Br(e){var t;let{allowClear:n=!1,filterValues:i=(()=>!0),form:r,formField:o="column",filterId:l,datasetId:d,value:u,onChange:h,mode:p}=e;const[m,g]=(0,s.useState)(),{addDangerToast:f}=(0,Cn.e1)(),v=(0,s.useCallback)((()=>{r.setFields([{name:["filters",l,o],touched:!1,value:null}])}),[r,l,o]),b=(0,s.useMemo)((()=>(0,zi.Z)(m).filter(i).map((e=>e.column_name)).map((e=>({label:e,value:e})))),[m,i]),y=null==(t=r.getFieldValue("filters"))?void 0:t[l].filterType,x=(0,s.useMemo)((()=>null==m?void 0:m.find((e=>e.column_name===u))),[m,u]);return(0,s.useEffect)((()=>{x&&!ji(y,x)&&v()}),[x,y,v]),(0,jr.S)(d,(e=>{null!=e&&v(),null!=d&&Kr({endpoint:`/api/v1/dataset/${d}`}).then((e=>{let{json:{result:t}}=e;const n=Array.isArray(u)?u:[u];t.columns.some((e=>null==n?void 0:a()(n).call(n,e.column_name)))||v(),g(t.columns)}),(async e=>{const{error:t,message:n}=await(0,ei.O$)(e);let i=n||t||(0,c.t)("An error has occurred");"Forbidden"===n&&(i=(0,c.t)("You do not have permission to edit this dashboard")),f(i)}))})),(0,C.tZ)(V.Ph,{mode:p,value:"multiple"===p?u||[]:u,ariaLabel:(0,c.t)("Column select"),onChange:h,options:b,placeholder:(0,c.t)("Select a column"),notFoundContent:(0,c.t)("No compatible columns found"),showSearch:!0,allowClear:n})}var Hr=n(15926),Wr=n.n(Hr);const Yr=new Map,Jr=(0,Pr.g)(vt.Z.get,Yr,(e=>{let{endpoint:t}=e;return t||""})),Gr=e=>{let{onChange:t,value:n}=e;const i=(0,s.useCallback)((e=>{let{error:t,message:n}=e,i=n||t||(0,c.t)("An error has occurred");return"Forbidden"===n&&(i=(0,c.t)("You do not have permission to edit this dashboard")),i}),[]);return(0,C.tZ)(V.qb,{ariaLabel:(0,c.t)("Dataset"),value:n,options:async(e,t,n)=>{const r="table_name",o=Wr().encode({filters:[{col:r,opr:"ct",value:e}],page:t,page_size:n,order_column:r,order_direction:"asc"});return Jr({endpoint:`/api/v1/dataset/?q=${o}`}).then((e=>({data:e.json.result.map(Ai),totalCount:e.json.count}))).catch((async e=>{const t=i(await(0,ei.O$)(e));throw new Error(t)}))},onChange:t,notFoundContent:(0,c.t)("No compatible datasets found")})},Qr=e=>(0,s.useMemo)((()=>(0,C.tZ)(Gr,e)),[]);var Xr=n(88274);const eo=e=>{var t,n,i;let{hasDefaultValue:r,filterId:o,hasDataset:a,form:s,setDataMask:l,formData:d,enableNoResults:u}=e;const h=(s.getFieldValue("filters")||{})[o],m=null==h?void 0:h.defaultValueQueriesData,g=a&&null===m,f=null==h||null==(t=h.defaultDataMask)||null==(n=t.filterState)?void 0:n.value,v=r&&null==f;return g?(0,C.tZ)(p.Z,{position:"inline-centered"}):(0,C.tZ)(Xr.Z,{height:32,width:"filter_time"===(null==h?void 0:h.filterType)?350:250,appSection:yi.Tr.FILTER_CONFIG_MODAL,behaviors:[yi.cg.NATIVE_FILTER],formData:d,queriesData:a?null==h?void 0:h.defaultValueQueriesData:[{data:[{}]}],chartType:null==h?void 0:h.filterType,hooks:{setDataMask:l},enableNoResults:u,filterState:{...null==h||null==(i=h.defaultDataMask)?void 0:i.filterState,validateMessage:v&&(0,c.t)("Value is required"),validateStatus:v&&"error"}})};var to=n(37687);const no=(0,y.iK)(Ft.xJ)`
  margin-bottom: 0;
`;const io=y.iK.div`
  display: flex;
  flex-direction: column;
  height: 400px; // arbitrary
  text-align: center;
  justify-content: center;
  align-items: center;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`,ro=e=>{let{onClick:t}=e;return(0,C.tZ)(io,null,(0,C.tZ)("p",null,(0,c.t)("You have removed this filter.")),(0,C.tZ)("div",null,(0,C.tZ)(K.Z,{buttonStyle:"primary",onClick:t},(0,c.t)("Restore Filter"))))},oo=y.iK.div`
  display: flex;
  flex-direction: column;
`,ao=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    display: inline-flex;\n    flex-direction: row;\n    align-items: center;\n    cursor: pointer;\n    color: ${t.colors.primary.base};\n    &:hover {\n      color: ${t.colors.primary.dark1};\n    }\n  `}}
`,so=(0,y.iK)(B.Z.Trash)`
  ${e=>{let{theme:t}=e;return`\n    cursor: pointer;\n    margin-left: ${2*t.gridUnit}px;\n    color: ${t.colors.grayscale.base};\n    &:hover {\n      color: ${t.colors.grayscale.dark1};\n    }\n  `}}
`,lo=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    display: flex;\n    width: 220px;\n    flex-direction: row;\n    align-items: center;\n    margin-bottom: ${t.gridUnit}px;\n  `}}
`,co=y.iK.div`
  text-transform: uppercase;
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`,uo=e=>{let{availableFilters:t,selection:n,onChange:i,onDelete:r}=e,o=t.find((e=>e.value===n)),a=t;return o||(o={label:(0,c.t)("(deleted or invalid type)"),value:n},a=[o,...a]),(0,C.tZ)(lo,null,(0,C.tZ)(V.Ph,{ariaLabel:(0,c.t)("Limit type"),labelInValue:!0,options:a,onChange:e=>i(n,e.value),value:o}),(0,C.tZ)(so,{iconSize:"xl",onClick:()=>r(n)}))},ho=e=>{let{availableFilters:t=[],dependencies:n=[],onDependenciesChange:i}=e;const[r,o]=(0,s.useState)(n),l=e=>{o(e),i(e)},d=(e,t)=>{const n=r.findIndex((t=>t===e)),i=[...r];i[n]=t,l(i)},u=e=>{const t=[...r];t.splice(r.indexOf(e),1),l(t)};return 0===t.length?(0,C.tZ)("span",null,(0,c.t)("No available filters.")):(0,C.tZ)(s.Fragment,null,r.map((e=>(0,C.tZ)(uo,{key:e,selection:e,availableFilters:t.filter((t=>t.value===e||!a()(r).call(r,t.value))),onChange:d,onDelete:u}))),t.length>r.length&&(0,C.tZ)(ao,{onClick:()=>{const e=t.find((e=>!a()(r).call(r,e.value)));if(e){const t=[...r];t.push(e.value),l(t)}}},(0,C.tZ)(B.Z.PlusSmall,null),(0,c.t)("Add filter")))},po=e=>{let{availableFilters:t=[],dependencies:n=[],onDependenciesChange:i,getDependencySuggestion:r}=e;const o=t.length>0,a=n.length>0;return(0,C.tZ)(oo,null,(0,C.tZ)(Lr,{title:(0,c.t)("Values are dependent on other filters"),initialValue:a,onChange:e=>{const t=[];e&&!a&&o&&t.push(r()),i(t)},tooltip:(0,c.t)("Values selected in other filters will affect the filter options to only show relevant values")},a&&(0,C.tZ)(co,null,(0,c.t)("Values dependent on")),(0,C.tZ)(ho,{availableFilters:t,dependencies:n,onDependenciesChange:i,getDependencySuggestion:r})))},mo=(0,y.iK)(w.ZP.TabPane)`
  padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px 0px;
`,go=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    display: flex;\n    flex-direction: row-reverse;\n    justify-content: space-between;\n    padding: 0px ${4*t.gridUnit}px;\n  `}}
`,fo=y.iK.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0px ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
`,vo=["enableEmptyFilter","defaultToFirstItem","multiSelect","searchAllOptions","inverseSelection"],bo=(0,y.iK)(Ft.xJ)`
  width: 49%;
  margin-bottom: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  & .ant-form-item-control-input {
    min-height: ${e=>{let{theme:t}=e;return 10*t.gridUnit}}px;
  }
`,yo=(0,y.iK)(Ft.xJ)`
  margin-bottom: 0;
  padding-bottom: 0;
  min-width: 50%;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  & .ant-form-item-control-input {
    min-height: ${e=>{let{theme:t}=e;return 10*t.gridUnit}}px;
  }
`,Co=(0,y.iK)(Ft.xJ)`
  min-width: 50%;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  .ant-form-item {
    margin-bottom: 0;
  }

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  .ant-form-item-extra {
    display: none;
  }

  & .ant-form-item-control-input {
    height: auto;
  }
`,xo=y.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  text-transform: uppercase;
`,So=(0,y.iK)(Ft.xJ)`
  margin-bottom: 0;
`,Zo=y.iK.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`,wo=(0,y.iK)(B.Z.Refresh)`
  margin-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
`,Ro=(0,y.iK)(Ir.Z)`
  border-left: 0;
  border-top: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
  border-radius: 0;

  .ant-collapse-header {
    border-bottom: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    border-top: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    margin-top: -1px;
    border-radius: 0;
  }

  .ant-collapse-content {
    border: 0;
  }

  .ant-collapse-content-box {
    padding-top: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
  }

  &.ant-collapse > .ant-collapse-item {
    border: 0;
    border-radius: 0;
  }
`,ko=(0,y.iK)(w.ZP)`
  .ant-tabs-nav {
    position: sticky;
    top: 0;
    background: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    z-index: 1;
  }

  .ant-tabs-nav-list {
    padding: 0;
  }

  .ant-form-item-label {
    padding-bottom: 0;
  }
`,To=y.iK.span`
  color: ${e=>{let{theme:t}=e;return t.colors.error.base}};
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  margin-left: ${e=>{let{theme:t}=e;return t.gridUnit-1}}px;
  &:before {
    content: '*';
  }
`,Do=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    width: 49%;\n    font-size: ${t.typography.sizes.s}px;\n    color: ${t.colors.grayscale.light1};\n    margin:\n      ${2*-t.gridUnit}px\n      0px\n      ${4*t.gridUnit}px\n      ${4*t.gridUnit}px;\n  `}}
`,Io={configuration:{key:"configuration",name:(0,c.t)("Settings")},scoping:{key:"scoping",name:(0,c.t)("Scoping")}},_o={configuration:{key:"configuration",name:(0,c.t)("Filter Configuration")},settings:{key:"settings",name:(0,c.t)("Filter Settings")}},$o=["filter_select","filter_range"],Fo={[(0,c.t)("Select filter")]:(0,c.t)("Value"),[(0,c.t)("Range filter")]:(0,c.t)("Numerical range"),[(0,c.t)("Time filter")]:(0,c.t)("Time range"),[(0,c.t)("Time column")]:(0,c.t)("Time column"),[(0,c.t)("Time grain")]:(0,c.t)("Time grain"),[(0,c.t)("Group By")]:(0,c.t)("Group by")},Mo=new Map,Eo=(0,Pr.g)(vt.Z.get,Mo,(e=>{let{endpoint:t}=e;return t||""})),Oo=(e,t)=>{var n,i,o,l,d,h,m,g,f,v,b,y,x,S,Z,w,R,k,T,D,I,_,$,F;let{filterId:M,filterToEdit:E,removedFilters:O,form:z,getAvailableFilters:P,activeFilterPanelKeys:U,restoreFilter:N,handleActiveFilterPanelChange:q,setErroredFilters:A,validateDependencies:L,getDependencySuggestion:K,isActive:B}=e;const H=!!O[M],[W,Y]=(0,s.useState)(""),[G,X]=(0,s.useState)([]),[ee,te]=(0,s.useState)(Io.configuration.key),[ne,ie]=(0,s.useState)(null),re=Ni(B),[oe,ae]=(0,s.useState)(),se=(0,s.useMemo)((()=>({})),[]),le=z.getFieldValue("filters"),de=null==le?void 0:le[M],ce=de||ne||se,ue=(null==ce?void 0:ce.dependencies)||(null==E?void 0:E.cascadeParentIds),he=(0,bi.Z)().items,pe=Object.entries(he).filter((e=>{var t;let[,{value:n}]=e;return null==(t=n.behaviors)?void 0:a()(t).call(t,yi.cg.NATIVE_FILTER)})).map((e=>{let[t]=e;return t})),me=(0,r.v9)((e=>{let{datasources:t}=e;return t})),ge=(0,r.v9)((e=>{let{charts:t}=e;return t})),fe=(0,s.useMemo)((()=>Object.values(me).some((e=>Li(e)))),[me]),ve=(0,s.useMemo)((()=>{const e=Object.values(me).find((e=>{var t;return e.id===(null==ce||null==(t=ce.dataset)?void 0:t.value)}));return!e||Li(e)}),[null==ce||null==(n=ce.dataset)?void 0:n.value,me]),be=!(null==(i=he[null==ce?void 0:ce.filterType])||null==(o=i.value)||!o.datasourceCount),ye=null!=(l=null!=(d=null==ce||null==(h=ce.dataset)?void 0:h.value)?d:null==E||null==(m=E.targets[0])?void 0:m.datasetId)?l:((e,t)=>{var n;const i=new Map;let r="",o=0;return Object.values(t).forEach((e=>{const{form_data:t}=e;if(t){const{datasource:e}=t,n=(i.get(e)||0)+1;i.set(e,n),n>o&&(o=n,r=e)}})),null==(n=e[r])?void 0:n.id})(me,ge),{controlItems:Ce={},mainControlItems:xe={}}=ce?function(e){var t;let{datasetId:n,disabled:i,forceUpdate:r,form:o,filterId:a,filterType:l,filterToEdit:d,formFilter:u,removed:h}=e;const p=null!=(void 0===(m=(0,to.Z)().get(l))&&(m={}),t=null!=(g=null==(f=Ei()(m.controlPanelSections))?void 0:f.reduce(((e,t)=>{let{controlSetRows:n=[]}=t;return[...e,...Ei()(n)]}),[]))?g:[])?t:[];var m,g,f;const v={},b={};return p.filter((e=>"groupby"===(null==e?void 0:e.name))).forEach((e=>{var t,i,l,p,m,g,f,v,y;const x=null!=(t=null==d||null==(i=d.controlValues)?void 0:i[e.name])?t:null==e||null==(l=e.config)?void 0:l.default,S=null==d||null==(p=d.targets[0])||null==(m=p.column)?void 0:m.name,Z=(0,C.tZ)(s.Fragment,null,(0,C.tZ)(no,{name:["filters",a,"requiredFirst",e.name],hidden:!0,initialValue:(null==e||null==(g=e.config)?void 0:g.requiredFirst)&&(null==d?void 0:d.requiredFirst)}),(0,C.tZ)(bo,{name:["filters",a,"column"],initialValue:S,label:(0,C.tZ)(xo,null,(null==(f=e.config)?void 0:f.label)||(0,c.t)("Column")),rules:[{required:(null==(v=e.config)?void 0:v.required)&&!h,message:(0,c.t)("Column is required")}]},(0,C.tZ)(Br,{mode:(null==(y=e.config)?void 0:y.multiple)&&"multiple",form:o,filterId:a,datasetId:n,filterValues:e=>ji((null==u?void 0:u.filterType)||"",e),onChange:()=>{qi(o,a,{defaultDataMask:null}),r()}})));b[e.name]={element:Z,checked:x}})),p.filter((e=>{var t;return(null==e||null==(t=e.config)?void 0:t.renderTrigger)&&"sortAscending"!==e.name&&"enableSingleValue"!==e.name})).forEach((e=>{var t,n,l,h;const p=null!=(t=null==d||null==(n=d.controlValues)?void 0:n[e.name])?t:null==e||null==(l=e.config)?void 0:l.default,m=(0,C.tZ)(s.Fragment,null,(0,C.tZ)(no,{name:["filters",a,"requiredFirst",e.name],hidden:!0,initialValue:(null==e||null==(h=e.config)?void 0:h.requiredFirst)&&(null==d?void 0:d.requiredFirst)}),(0,C.tZ)(Q.u,{key:e.name,placement:"left",title:e.config.affectsDataMask&&i&&(0,c.t)('Populate "Default value" to enable this control')},(0,C.tZ)(yo,{key:e.name,name:["filters",a,"controlValues",e.name],initialValue:p,valuePropName:"checked",colon:!1},(0,C.tZ)(V.r4,{disabled:e.config.affectsDataMask&&i,onChange:t=>{let{target:{checked:n}}=t;e.config.requiredFirst&&qi(o,a,{requiredFirst:{...null==u?void 0:u.requiredFirst,[e.name]:n}}),e.config.resetConfig&&qi(o,a,{defaultDataMask:null}),r()}},e.config.label," ",e.config.description&&(0,C.tZ)(bn.V,{placement:"top",label:e.config.name,tooltip:e.config.description})))));v[e.name]={element:m,checked:p}})),{controlItems:v,mainControlItems:b}}({datasetId:ye,disabled:!1,forceUpdate:re,form:z,filterId:M,filterType:null==ce?void 0:ce.filterType,filterToEdit:E,formFilter:ce,removed:H}):{},Se=!!xe.groupby,Ze=!(null==(f=(null!=(g=he[null==ce?void 0:ce.filterType])?g:{}).value)||!f.enableNoResults),we=Se&&!!G.length,Re=!be||ye&&((null==ce?void 0:ce.column)||!Se),ke=a()($o).call($o,null==ce?void 0:ce.filterType),Te=a()(Yo).call(Yo,null==ce?void 0:ce.filterType),De=null==(v=null==ce?void 0:ce.isDataDirty)||v,Ie=e=>{qi(z,M,e),Y(""),re()};let _e={};ue&&ue.length>0&&le&&ue.forEach((e=>{var t,n;const i=null==(t=le[e])||null==(n=t.defaultDataMask)?void 0:n.extraFormData;_e=(0,Nr.on)(_e,i)}));const $e=JSON.stringify(_e),Fe=(0,s.useCallback)((function(e){var t,n;if(void 0===e&&(e=!1),!be||null==ce||null==(t=ce.dataset)||!t.value)return void re();const i=(0,Nr.zi)({datasetId:null==ce||null==(n=ce.dataset)?void 0:n.value,groupby:null==ce?void 0:ce.column,...ce});i.extra_form_data=_e,Ie({defaultValueQueriesData:null,isDataDirty:!1}),(0,ai.getChartDataRequest)({formData:i,force:e,requestParams:{dashboardId:0}}).then((e=>{let{response:t,json:n}=e;if((0,pt.cr)(u.T.GLOBAL_ASYNC_QUERIES)){const e="result"in n?n.result[0]:n;if(200===t.status)Ie({defaultValueQueriesData:[e]});else{if(202!==t.status)throw new Error(`Received unexpected response status (${t.status}) while fetching chart data`);(0,zr.YJ)(e).then((e=>{Ie({defaultValueQueriesData:e})})).catch((e=>{Y(e.message||e.error||(0,c.t)("Check configuration"))}))}}else Ie({defaultValueQueriesData:n.result})})).catch((e=>{e.json().then((t=>{(e=>{qi(z,M,{defaultValueQueriesData:null}),Y(e),re()})(t.message||e.statusText||(0,c.t)("Check configuration"))}))}))}),[M,re,z,ce,be,$e]);(0,s.useEffect)((()=>Fe()),[$e]);const Me=(0,Nr.zi)({datasetId:ye,groupby:Se?null==ce?void 0:ce.column:void 0,...ce});Me.extra_form_data=_e;const[Ee,Oe,ze,Pe]=((e,t)=>{var n,i;const r=!(null==e||null==(n=e.controlValues)||!n.enableEmptyFilter),o=!(null==e||null==(i=e.controlValues)||!i.defaultToFirstItem),[a,l]=(0,s.useState)(!1),[d,u]=(0,s.useState)(r),[h,p]=(0,s.useState)(""),m=function(e){void 0===e&&(e=!1);const t=r&&!o;u(t),l(!!t||e)};return(0,s.useEffect)((()=>{var t,n;m(!o&&!(null==e||null==(t=e.defaultDataMask)||null==(n=t.filterState)||!n.value))}),[o,r]),(0,s.useEffect)((()=>{var e,n;m(!o&&!(null==t||null==(e=t.defaultDataMask)||null==(n=e.filterState)||!n.value))}),[]),(0,s.useEffect)((()=>{let e="";o?e=(0,c.t)('Default value set automatically when "Select first filter value by default" is checked'):d?e=(0,c.t)('Default value must be set when "Filter value is required" is checked'):a&&(e=(0,c.t)('Default value must be set when "Filter has default value" is checked')),p(e)}),[a,d,o]),[a,d,h,m]})(ce,E),Ue=!ye||oe||(null==ce||null==(b=ce.dataset)?void 0:b.label),Ne=(0,s.useCallback)((()=>{z.setFields([{name:"changed",value:!0}])}),[z]),qe=(0,s.useCallback)((e=>{qi(z,M,e),Ne()}),[M,z,Ne]),Ae=!!(null!=ce&&ce.adhoc_filters||null!=ce&&ce.time_range||null!=E&&null!=(y=E.adhoc_filters)&&y.length||null!=E&&E.time_range),Le=void 0!==(null==ce||null==(x=ce.controlValues)?void 0:x.enableSingleValue)||void 0!==(null==E||null==(S=E.controlValues)?void 0:S.enableSingleValue);let je=null==E||null==(Z=E.controlValues)?void 0:Z.enableSingleValue;void 0!==(null==ce||null==(w=ce.controlValues)?void 0:w.enableSingleMaxValue)&&({enableSingleValue:je}=ce.controlValues);const Ve="boolean"==typeof(null==ce||null==(R=ce.controlValues)?void 0:R.sortAscending)||"boolean"==typeof(null==E||null==(k=E.controlValues)?void 0:k.sortAscending);let Ke=null==E||null==(T=E.controlValues)?void 0:T.sortAscending;"boolean"==typeof(null==ce||null==(D=ce.controlValues)?void 0:D.sortAscending)&&(Ke=ce.controlValues.sortAscending);const Be=!be||!De&&Re||!xe.groupby,He=e=>{var t;const n=null==(t=z.getFieldValue("filters"))?void 0:t[M].controlValues;qi(z,M,{controlValues:{...n,sortAscending:e}}),re()},We=e=>{var t;const n=null==(t=z.getFieldValue("filters"))?void 0:t[M].controlValues;qi(z,M,{controlValues:{...n,enableSingleValue:e}}),re()},Ye=()=>setTimeout((()=>z.validateFields([["filters",M,"adhoc_filters"],["filters",M,"time_range"]])),0),Je=(null==ce?void 0:ce.time_range)&&"No filter"!==ce.time_range,Ge=(null==ce||null==(I=ce.adhoc_filters)?void 0:I.length)>0,Qe=null==ce||null==(_=ce.controlValues)?void 0:_.defaultToFirstItem,Xe=(null==ce?void 0:ce.filterType)===(null==E?void 0:E.filterType)?null==E?void 0:E.defaultDataMask:null,et=()=>Je||Ge?Promise.resolve():Promise.reject(new Error((0,c.t)("Pre-filter is required"))),tt=P(M),nt=tt.length>0;(0,s.useEffect)((()=>{ye&&Eo({endpoint:`/api/v1/dataset/${ye}`}).then((e=>{var t,n,i;X(null==(t=e.json)||null==(n=t.result)?void 0:n.metrics);const r=null==(i=e.json)?void 0:i.result;r.type=r.datasource_type,r.filter_select=!0,ae(r)})).catch((e=>{(0,Kn.Gb)(e.message)}))}),[ye]),(0,s.useImperativeHandle)(t,(()=>({changeTab(e){te(e)}}))),((e,t)=>{var n;const i=Ni(),r=(e.getFieldValue("filters")||{})[t];(0,s.useEffect)((()=>{qi(e,t,{isDataDirty:!0,defaultValueQueriesData:null}),i()}),[e,null==r?void 0:r.filterType,null==r?void 0:r.column,null==r||null==(n=r.dataset)?void 0:n.value,JSON.stringify(null==r?void 0:r.adhoc_filters),null==r?void 0:r.time_range,i,t])})(z,M),(0,s.useEffect)((()=>{be&&Re&&Ee&&De&&Fe()}),[be,Re,Ee,De,Fe,Ue]);const it=(0,s.useMemo)((()=>{var e;const t=[];return void 0===(null==ce||null==(e=ce.dataset)?void 0:e.value)?[]:(Object.values(ge).forEach((e=>{var n,i,r;const o=null==(n=e.form_data)?void 0:n.datasource;void 0!==o&&(null==(i=me[o])?void 0:i.id)!==(null==ce||null==(r=ce.dataset)?void 0:r.value)&&t.push(e.id)})),t)}),[JSON.stringify(ge),null==ce||null==($=ce.dataset)?void 0:$.value,JSON.stringify(me)]);return(0,s.useEffect)((()=>{H&&ie(de)}),[H]),(0,s.useEffect)((()=>{ne&&!H&&(qi(z,M,ne),ie(null))}),[de,M,z,H,ne]),H?(0,C.tZ)(ro,{onClick:()=>N(M)}):(0,C.tZ)(ko,{activeKey:ee,onChange:e=>te(e),centered:!0},(0,C.tZ)(mo,{tab:Io.configuration.name,key:Io.configuration.key,forceRender:!0},(0,C.tZ)(go,null,(0,C.tZ)(bo,{name:["filters",M,"type"],hidden:!0,initialValue:Xi.BE.NATIVE_FILTER},(0,C.tZ)(j.II,null)),(0,C.tZ)(bo,{name:["filters",M,"name"],label:(0,C.tZ)(xo,null,(0,c.t)("Filter name")),initialValue:null==E?void 0:E.name,rules:[{required:!H,message:(0,c.t)("Name is required")}]},(0,C.tZ)(j.II,Wo("name-input"))),(0,C.tZ)(bo,J()({name:["filters",M,"filterType"],rules:[{required:!H,message:(0,c.t)("Name is required")}],initialValue:(null==E?void 0:E.filterType)||"filter_select",label:(0,C.tZ)(xo,null,(0,c.t)("Filter Type"))},Wo("filter-type")),(0,C.tZ)(V.Ph,{ariaLabel:(0,c.t)("Filter type"),options:pe.map((e=>{var t,n,i;const r=null==(t=he[e])?void 0:t.value.name,o=r?Fo[r]:void 0,s=1===(null==(n=Ui[e])?void 0:n.length)&&(null==(i=Ui[e])?void 0:a()(i).call(i,Oi.Z.TEMPORAL))&&!fe;return{value:e,label:o||r,customLabel:s?(0,C.tZ)(Q.u,{title:(0,c.t)("Datasets do not contain a temporal column")},o||r):void 0,disabled:s}})),onChange:e=>{qi(z,M,{filterType:e,defaultDataMask:null,column:null}),re()}}))),"filter_time"===(null==ce?void 0:ce.filterType)&&(0,C.tZ)(Do,null,(0,c.t)("Dashboard time range filters apply to temporal columns defined in\n          the filter section of each chart. Add temporal columns to the chart\n          filters to have this dashboard filter impact those charts.")),be&&(0,C.tZ)(fo,null,Ue?(0,C.tZ)(bo,J()({name:["filters",M,"dataset"],label:(0,C.tZ)(xo,null,(0,c.t)("Dataset")),initialValue:oe?{label:oe.table_name,value:oe.id}:void 0,rules:[{required:!H,message:(0,c.t)("Dataset is required")}]},Wo("datasource-input")),(0,C.tZ)(Qr,{onChange:e=>{e.value!==ye&&qi(z,M,{dataset:e,defaultDataMask:null,column:null}),re()}})):(0,C.tZ)(bo,{label:(0,C.tZ)(xo,null,(0,c.t)("Dataset"))},(0,C.tZ)(p.Z,{position:"inline-centered"})),be&&Object.keys(xe).map((e=>xe[e].element))),(0,C.tZ)(Ro,{defaultActiveKey:U,onChange:e=>{q(e)},expandIconPosition:"right",key:`native-filter-config-${M}`},"filter_time"!==(null==ce?void 0:ce.filterType)&&(0,C.tZ)(Ir.Z.Panel,{forceRender:!0,header:_o.configuration.name,key:`${M}-${_o.configuration.key}`},Te&&nt&&(0,C.tZ)(yo,{name:["filters",M,"dependencies"],initialValue:ue},(0,C.tZ)(po,{availableFilters:tt,dependencies:ue,onDependenciesChange:e=>{qi(z,M,{dependencies:e}),re(),L(),Ne()},getDependencySuggestion:()=>K(M)})),be&&ke&&(0,C.tZ)(So,{name:["filters",M,"preFilter"]},(0,C.tZ)(Lr,{initialValue:Ae,title:(0,c.t)("Pre-filter available values"),onChange:e=>{Ne(),e&&Ye()}},(0,C.tZ)(Co,{name:["filters",M,"adhoc_filters"],initialValue:null==E?void 0:E.adhoc_filters,required:!0,rules:[{validator:et}]},(0,C.tZ)(Or.Z,{columns:(null==oe||null==(F=oe.columns)?void 0:F.filter((e=>e.filterable)))||[],savedMetrics:(null==oe?void 0:oe.metrics)||[],datasource:oe,onChange:e=>{qi(z,M,{adhoc_filters:e}),re(),Ye()},label:(0,C.tZ)("span",null,(0,C.tZ)(xo,null,(0,c.t)("Pre-filter")),!Je&&(0,C.tZ)(To,null))})),ve&&(0,C.tZ)(yo,{name:["filters",M,"time_range"],label:(0,C.tZ)(xo,null,(0,c.t)("Time range")),initialValue:(null==E?void 0:E.time_range)||(0,c.t)("No filter"),required:!Ge,rules:[{validator:et}]},(0,C.tZ)(Er.ZP,{name:"time_range",onChange:e=>{qi(z,M,{time_range:e}),re(),Ye()}})),Je&&(0,C.tZ)(yo,{name:["filters",M,"granularity_sqla"],label:(0,C.tZ)(s.Fragment,null,(0,C.tZ)(xo,null,(0,c.t)("Time column"))," ",(0,C.tZ)(bn.V,{placement:"top",tooltip:(0,c.t)("Optional time column if time range should apply to another column than the default time column")})),initialValue:null==E?void 0:E.granularity_sqla},(0,C.tZ)(Br,{allowClear:!0,form:z,formField:"granularity_sqla",filterId:M,filterValues:e=>!!e.is_dttm,datasetId:ye,onChange:e=>{qi(z,M,{granularity_sqla:e}),re()}})))),"filter_range"!==(null==ce?void 0:ce.filterType)?(0,C.tZ)(So,{name:["filters",M,"sortFilter"]},(0,C.tZ)(Lr,{initialValue:Ve,title:(0,c.t)("Sort filter values"),onChange:e=>{He(e||void 0),Ne()}},(0,C.tZ)(yo,{name:["filters",M,"controlValues","sortAscending"],initialValue:Ke,label:(0,C.tZ)(xo,null,(0,c.t)("Sort type"))},(0,C.tZ)(Ut.Y.Group,{onChange:e=>{He(e.target.value)}},(0,C.tZ)(Ut.Y,{value:!0},(0,c.t)("Sort ascending")),(0,C.tZ)(Ut.Y,{value:!1},(0,c.t)("Sort descending")))),we&&(0,C.tZ)(Co,{name:["filters",M,"sortMetric"],initialValue:null==E?void 0:E.sortMetric,label:(0,C.tZ)(s.Fragment,null,(0,C.tZ)(xo,null,(0,c.t)("Sort Metric"))," ",(0,C.tZ)(bn.V,{placement:"top",tooltip:(0,c.t)("If a metric is specified, sorting will be done based on the metric value")}))},(0,C.tZ)(V.Ph,{allowClear:!0,ariaLabel:(0,c.t)("Sort metric"),name:"sortMetric",options:G.map((e=>{var t;return{value:e.metric_name,label:null!=(t=e.verbose_name)?t:e.metric_name}})),onChange:e=>{void 0!==e&&(qi(z,M,{sortMetric:e}),re())}})))):(0,C.tZ)(So,{name:["filters",M,"rangeFilter"]},(0,C.tZ)(Lr,{initialValue:Le,title:(0,c.t)("Single Value"),onChange:e=>{We(e?Ur.c.Exact:void 0),Ne()}},(0,C.tZ)(yo,{name:["filters",M,"controlValues","enableSingleValue"],initialValue:je,label:(0,C.tZ)(xo,null,(0,c.t)("Single value type"))},(0,C.tZ)(Ut.Y.Group,{onChange:e=>We(e.target.value)},(0,C.tZ)(Ut.Y,{value:Ur.c.Minimum},(0,c.t)("Minimum")),(0,C.tZ)(Ut.Y,{value:Ur.c.Exact},(0,c.t)("Exact")),(0,C.tZ)(Ut.Y,{value:Ur.c.Maximum},(0,c.t)("Maximum"))))))),(0,C.tZ)(Ir.Z.Panel,{forceRender:!0,header:_o.settings.name,key:`${M}-${_o.settings.key}`},(0,C.tZ)(bo,{name:["filters",M,"description"],initialValue:null==E?void 0:E.description,label:(0,C.tZ)(xo,null,(0,c.t)("Description"))},(0,C.tZ)(j.Kx,null)),(0,C.tZ)(So,{name:["filters",M,"defaultValueQueriesData"],hidden:!0,initialValue:null}),(0,C.tZ)(So,{name:["filters",M,"defaultValue"]},(0,C.tZ)(Lr,{checked:Ee,disabled:Oe||Qe,initialValue:Ee,title:(0,c.t)("Filter has default value"),tooltip:ze,onChange:e=>{Pe(e),e||qi(z,M,{defaultDataMask:null}),Ne()}},!H&&(0,C.tZ)(Co,{name:["filters",M,"defaultDataMask"],initialValue:Xe,label:(0,C.tZ)(xo,null,(0,c.t)("Default Value")),required:Ee,rules:[{validator:()=>{var e,t;if(null!=ce&&null!=(e=ce.defaultDataMask)&&null!=(t=e.filterState)&&t.value){const e=z.getFieldsError();return A((t=>t.length&&!e.find((e=>e.errors.length>0))?[]:t)),Promise.resolve()}return A((e=>a()(e).call(e,M)?e:[...e,M])),Promise.reject(new Error((0,c.t)("Default value is required")))}}]},W?(0,C.tZ)(Mr,{title:(0,c.t)("Cannot load filter"),body:W,level:"error"}):Be?(0,C.tZ)(Zo,null,(0,C.tZ)(eo,{setDataMask:e=>{var t,n;di()(null==Xe||null==(t=Xe.filterState)?void 0:t.value,null==e||null==(n=e.filterState)?void 0:n.value)||Ne(),qi(z,M,{defaultDataMask:e}),z.validateFields([["filters",M,"defaultDataMask"]]),re()},hasDefaultValue:Ee,filterId:M,hasDataset:be,form:z,formData:Me,enableNoResults:Ze}),be&&ye&&(0,C.tZ)(Q.u,{title:(0,c.t)("Refresh the default values")},(0,C.tZ)(wo,{onClick:()=>Fe(!0)}))):(0,c.t)('Fill all required fields to enable "Default Value"')))),Object.keys(Ce).sort(((e,t)=>vo.indexOf(e)-vo.indexOf(t))).map((e=>Ce[e].element))))),(0,C.tZ)(mo,{tab:Io.scoping.name,key:Io.scoping.key,forceRender:!0},(0,C.tZ)(Fi,{updateFormValues:qe,pathToFormValue:["filters",M],forceUpdate:re,filterScope:null==E?void 0:E.scope,formFilterScope:null==ce?void 0:ce.scope,formScopingType:null==ce?void 0:ce.scoping,initiallyExcludedCharts:it})))},zo=s.memo((0,s.forwardRef)(Oo));var Po={name:"ihui0v",styles:"text-align:left;& .ant-alert-action{align-self:center;}"},Uo={name:"zjik7",styles:"display:flex"};function No(e){let{title:t,onConfirm:n,onDismiss:i,children:r}=e;return(0,C.tZ)($t.Z,{closable:!1,type:"warning",key:"alert",message:t,css:Po,description:r,action:(0,C.tZ)("div",{css:Uo},(0,C.tZ)(K.Z,{key:"cancel",buttonSize:"small",buttonStyle:"secondary",onClick:i},(0,c.t)("Keep editing")),(0,C.tZ)(K.Z,{key:"submit",buttonSize:"small",buttonStyle:"primary",onClick:n},(0,c.t)("Yes, cancel")))})}const qo=e=>{let{canSave:t=!0,onCancel:n,handleSave:i,onDismiss:r,onConfirmCancel:o,saveAlertVisible:a}=e;return a?(0,C.tZ)(No,{key:"cancel-confirm",title:(0,c.t)("There are unsaved changes."),onConfirm:o,onDismiss:r},(0,c.t)("Are you sure you want to cancel?")):(0,C.tZ)(s.Fragment,null,(0,C.tZ)(K.Z,{key:"cancel",buttonStyle:"secondary",onClick:n},(0,c.t)("Cancel")),(0,C.tZ)(K.Z,{disabled:!t,key:"submit",buttonStyle:"primary",onClick:i},(0,c.t)("Save")))};var Ao=n(60812),Lo=n(92242);const jo=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    padding: ${4*t.gridUnit}px;\n  `}}
`,Vo=e=>{let{componentId:t,divider:n}=e;return(0,C.tZ)(jo,null,(0,C.tZ)(Ft.xJ,{initialValue:n?n.title:"",label:(0,c.t)("Title"),name:["filters",t,"title"],rules:[{required:!0,message:(0,c.t)("Title is required"),whitespace:!0}]},(0,C.tZ)(j.II,null)),(0,C.tZ)(Ft.xJ,{initialValue:n?n.description:"",label:(0,c.t)("Description"),name:["filters",t,"description"]},(0,C.tZ)(j.Kx,{rows:4})),(0,C.tZ)(Ft.xJ,{hidden:!0,name:["filters",t,"type"],initialValue:Xi.BE.DIVIDER}))},Ko=(0,y.iK)(yn.o)`
  min-width: 700px;
  .ant-modal-body {
    padding: 0px;
  }
`,Bo=y.iK.div`
  display: flex;
  height: 700px;
  flex-direction: row;
  .filters-list {
    width: ${e=>{let{theme:t}=e;return 50*t.gridUnit}}px;
    overflow: auto;
  }
`,Ho=(0,y.iK)(V.qz)`
  width: 100%;
`,Wo=Qi("filters-config-modal"),Yo=["filter_select"],Jo=[],Go={},Qo={filters:{}};function Xo(e){let{isOpen:t,initialFilterId:n,createNewOnOpen:i,onSave:r,onCancel:o}=e;const[l]=V.qz.useForm(),d=(0,s.useRef)(),u=tr(),h=function(){const e=tr();return(0,s.useMemo)((()=>e.reduce(((e,t)=>(e[t.id]=t,e)),{})),[e])}(),[p,m]=(0,s.useState)(Jo),[g,f]=(0,s.useState)(Go),[v,b]=(0,s.useState)(!1),y=(0,s.useMemo)((()=>Ji()([...(0,Lo.QN)(u),...p]).filter((e=>{var t;return!g[e]||(null==(t=g[e])?void 0:t.isPending)}))),[u,p,g]),x=null!=n?n:y[0],[Z,w]=(0,s.useState)(x),[R,k]=(0,s.useState)(Jo),[D,I]=(0,s.useState)(Qo),_=p.filter((e=>!g[e])),$=(0,s.useCallback)((e=>{const t=g[e];null!=t&&t.isPending&&clearTimeout(t.timerId),f((t=>({...t,[e]:null})))}),[g]),F=(0,s.useMemo)((()=>Object.keys(h)),[h]),[M,E]=(0,s.useState)(F),[O,z]=(0,s.useState)([x]),P=e=>[`${e}-${_o.configuration.key}`,`${e}-${_o.settings.key}`],[U,N]=(0,s.useState)(P(x)),q=(0,s.useCallback)((e=>{const t=(0,Lo.W6)(e);m([...p,t]),w(t),b(!1),E([...M,t]),N(P(t))}),[p,M,w,E,m]);((e,t,n)=>{const i=(0,Ao.D)(e);(0,s.useEffect)((()=>{n&&e&&!i&&t(Xi.BE.NATIVE_FILTER)}),[n,e,i,t])})(t,q,i),((e,t,n,i)=>{(0,s.useEffect)((()=>{const r=e[t];if(r&&!r.isPending){const r=n.flat().find((n=>!e[n]&&n!==t));r&&i(r)}}),[t,e,n,i])})(g,Z,M,w);const A=(0,Lo.EJ)(f,E,b),L=function(e){void 0===e&&(e=!1),m(Jo),w(x),f(Go),b(!1),I(Qo),k(Jo),y.length>0&&N(P(y[0])),e||E(F),z([x]),l.resetFields(["filters"]),l.setFieldsValue({changed:!1})},j=(0,s.useCallback)((e=>{const t=D.filters[e],n=h[e];return t&&"name"in t&&t.name||t&&"title"in t&&t.title||n&&"name"in n&&n.name||n&&"title"in n&&n.title||(0,c.t)("[untitled]")}),[h,D.filters]),K=(0,s.useCallback)((e=>{var t;if(g[e])return!1;const n=(null==(t=l.getFieldValue("filters"))?void 0:t[e])||h[e];return n&&"filterType"in n&&a()(Yo).call(Yo,n.filterType)}),[h,l,g]),B=(0,s.useCallback)((e=>y.filter((t=>t!==e)).filter((e=>K(e))).map((e=>({label:j(e),value:e})))),[K,y,j]),H=(0,s.useCallback)((()=>{const e=l.getFieldsError(),t=[];e.forEach((e=>{const n=e.name[1];e.errors.length>0&&!a()(t).call(t,n)&&t.push(n)})),!t.length&&R.length>0?k(Jo):t.length>0&&!di()(Wi()(R),Wi()(t))&&k(t)}),[l,R]),W=async()=>{const e=await(0,Lo.G$)(l,Z,w);H(),e?((e=>{Object.keys(h).forEach((e=>{const t=h[e];if(!("cascadeParentIds"in t))return;const{cascadeParentIds:n}=t;n&&(t.cascadeParentIds=n.filter((e=>K(e))))}));const t=null==e?void 0:e.filters;t&&Object.keys(t).forEach((e=>{const n=t[e];if(!("dependencies"in n))return;const{dependencies:i}=n;i&&(n.dependencies=i.filter((e=>K(e))))}))})(e),(0,Lo.GA)(h,M,g,r,e)(),L(!0)):d.current.changeTab("configuration")},Y=()=>{L(),o()},J=()=>{const e=l.getFieldValue("changed"),t=M.length!==F.length||M.some(((e,t)=>e!==F[t]));_.length>0||l.isFieldsTouched()||e||t?b(!0):Y()},G=(0,s.useCallback)((()=>{const e=new Map,t=l.getFieldValue("filters");return t&&Object.keys(t).forEach((n=>{const i=t[n],r=h[n];let o=[];i&&"dependencies"in i?o=[...i.dependencies]:null!=r&&r.cascadeParentIds&&(o=[...r.cascadeParentIds]),e.set(n,o)})),e}),[h,l]),Q=(0,s.useCallback)((()=>{const e=G();y.filter((e=>!g[e])).forEach((t=>{const n={name:["filters",t,"dependencies"],errors:(0,Lo.uh)(e,t)?[(0,c.t)("Cyclic dependency detected")]:[]};l.setFields([n])})),H()}),[G,y,l,H,g]),X=(0,s.useCallback)((e=>{const t=G(),n=M.filter((t=>t!==e&&K(t)));return n.find((n=>{const i=t.get(e)||[];return i.push(n),!(0,Lo.uh)(t,e)||(i.pop(),!1)}))||n[0]}),[G,K,M]),ee=(0,s.useMemo)((()=>T()(((e,t)=>{const n=e.filters&&Object.values(e.filters).some((e=>e.name&&null!==e.name)),i=e.filters&&Object.values(e.filters).some((e=>e.title&&null!==e.title));(n||i)&&I(t),b(!1),H()}),Gi.M)),[H]);(0,s.useEffect)((()=>{Bi()(g)||k((e=>e.filter((e=>!g[e]))))}),[g]),(0,s.useEffect)((()=>{a()(O).call(O,Z)||z([...O,Z])}),[Z]);const te=(0,s.useCallback)((e=>N(e)),[N]),ne=(0,s.useMemo)((()=>M.map((e=>{if(!a()(O).call(O,e))return null;const t=e.startsWith(Lo.Ky),n=Z===e;return(0,C.tZ)("div",{key:e,style:{height:"100%",overflowY:"auto",display:n?"":"none"}},t?(0,C.tZ)(Vo,{componentId:e,divider:h[e]}):(0,C.tZ)(zo,{ref:d,form:l,filterId:e,filterToEdit:h[e],removedFilters:g,restoreFilter:$,getAvailableFilters:B,key:e,activeFilterPanelKeys:U,handleActiveFilterPanelChange:te,isActive:n,setErroredFilters:k,validateDependencies:Q,getDependencySuggestion:X}))}))),[O,M,Z,h,l,g,$,B,U,Q,X,te]);return(0,C.tZ)(Ko,{visible:t,maskClosable:!1,title:(0,c.t)("Add and edit filters"),width:"50%",destroyOnClose:!0,onCancel:J,onOk:W,centered:!0,footer:(0,C.tZ)(qo,{onDismiss:()=>b(!1),onCancel:J,handleSave:W,canSave:!R.length,saveAlertVisible:v,onConfirmCancel:Y})},(0,C.tZ)(S.Z,null,(0,C.tZ)(Bo,null,(0,C.tZ)(Ho,{form:l,onValuesChange:ee,layout:"vertical"},(0,C.tZ)(Dr,{erroredFilters:R,onRemove:A,onAdd:q,onChange:e=>{w(e),N(P(e))},getFilterTitle:j,currentFilterId:Z,removedFilters:g,restoreFilter:$,onRearrange:(e,t)=>{const n=[...M],i=n.splice(e,1)[0];n.splice(t,0,i),E(n)},filters:M},ne)))))}const ea=s.memo(Xo),ta=e=>{var t,n;let{isOpen:i,chartId:o,onClose:a}=e;const l=(0,r.I0)(),[d]=V.qz.useForm(),u=(0,r.v9)((e=>{var t;let{dashboardInfo:n}=e;return null==n||null==(t=n.metadata)?void 0:t.chart_configuration})),h=(0,r.v9)((e=>e.charts)),p=(0,r.v9)((e=>e.dashboardLayout.present)),m=null==u||null==(t=u[o])||null==(n=t.crossFilters)?void 0:n.scope,g=()=>{const e=(0,xi.Q)(d.getFieldValue("scope"),h,p);l((0,Ln.Aw)({...u,[o]:{id:o,crossFilters:{scope:d.getFieldValue("scope"),chartsInScope:e}}})),a()};return(0,C.tZ)(yn.o,{visible:i,maskClosable:!1,title:(0,c.t)("Cross Filter Scoping"),width:"55%",destroyOnClose:!0,onCancel:a,onOk:g,centered:!0,footer:(0,C.tZ)(s.Fragment,null,(0,C.tZ)(K.Z,{key:"cancel",buttonStyle:"secondary",onClick:a},(0,c.t)("Cancel")),(0,C.tZ)(K.Z,{key:"submit",buttonStyle:"primary",onClick:g},(0,c.t)("Save")))},(0,C.tZ)(Ho,{preserve:!1,form:d,layout:"vertical"},(0,C.tZ)(Vi,{form:d,scope:m,chartId:o})))};var na=n(54076);const ia=e=>{if((0,u.c)(u.T.DASHBOARD_EDIT_CHART_IN_NEW_TAB))return e?(0,c.t)("Click to edit %s in a new tab",e):(0,c.t)("Click to edit chart.");const t="MacOS"===(0,na.fV)(),n=e?(0,c.t)("Click to edit %s.",e):(0,c.t)("Click to edit chart."),i=(0,c.t)("Use %s to open in a new tab.",t?(0,c.t)("⌘ + click"):(0,c.t)("ctrl + click"));return(0,C.tZ)(s.Fragment,null,(0,C.tZ)("div",null,n),(0,C.tZ)("div",null,i))};var ra=n(15423),oa=n(95345),aa=n(41814);const sa="cross_filter_scoping",la="download_as_image",da="explore_chart",ca="export_csv",ua="export_full_csv",ha="force_refresh",pa="fullscreen",ma="toggle_chart_description",ga=y.iK.div`
  padding: ${e=>{let{theme:t}=e;return t.gridUnit/4}}px
    ${e=>{let{theme:t}=e;return 1.5*t.gridUnit}}px;

  .dot {
    display: block;

    height: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    width: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    border-radius: 50%;
    margin: ${e=>{let{theme:t}=e;return t.gridUnit/2}}px 0;

    background-color: ${e=>{let{theme:t}=e;return t.colors.text.label}};
  }

  &:hover {
    cursor: pointer;
  }
`,fa=y.iK.div`
  height: auto;
  margin: ${e=>{let{theme:t}=e;return t.gridUnit}}px 0;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  line-height: 21px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
`,va=()=>(0,C.tZ)(ga,null,(0,C.tZ)("span",{className:"dot"}),(0,C.tZ)("span",{className:"dot"}),(0,C.tZ)("span",{className:"dot"})),ba=C.iv`
  &&.anticon > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`,ya=e=>{let{exploreUrl:t,triggerNode:n,modalTitle:i,modalBody:r}=e;const[o,a]=(0,s.useState)(!1),l=(0,s.useCallback)((()=>a(!0)),[]),d=(0,s.useCallback)((()=>a(!1)),[]),u=(0,ci.k6)(),h=(0,y.Fg)();return(0,C.tZ)(s.Fragment,null,(0,C.tZ)("span",{onClick:l,role:"button",tabIndex:0},n),(0,C.tZ)(yn.Z,{css:C.iv`
            .ant-modal-body {
              display: flex;
              flex-direction: column;
            }
          `,show:o,onHide:d,title:i,footer:(0,C.tZ)(s.Fragment,null,(0,C.tZ)(K.Z,{buttonStyle:"secondary",buttonSize:"small",onClick:()=>u.push(t)},(0,c.t)("Edit chart")),(0,C.tZ)(K.Z,{buttonStyle:"primary",buttonSize:"small",onClick:d},(0,c.t)("Close"))),responsive:!0,resizable:!0,resizableConfig:{minHeight:128*h.gridUnit,minWidth:128*h.gridUnit,defaultSize:{width:"auto",height:"75vh"}},draggable:!0,destroyOnClose:!0},r))};class Ca extends s.PureComponent{constructor(e){super(e),this.toggleControls=this.toggleControls.bind(this),this.refreshChart=this.refreshChart.bind(this),this.handleMenuClick=this.handleMenuClick.bind(this),this.state={showControls:!1,showCrossFilterScopingModal:!1}}refreshChart(){this.props.updatedDttm&&this.props.forceRefresh(this.props.slice.slice_id,this.props.dashboardId)}toggleControls(){this.setState((e=>({showControls:!e.showControls})))}handleMenuClick(e){var t,n,i,r,o,a,s,l;let{key:d,domEvent:u}=e;switch(d){case ha:this.refreshChart(),this.props.addSuccessToast((0,c.t)("Data refreshed"));break;case sa:this.setState({showCrossFilterScopingModal:!0});break;case ma:null==(t=(n=this.props).toggleExpandSlice)||t.call(n,this.props.slice.slice_id);break;case da:null==(i=(r=this.props).logExploreChart)||i.call(r,this.props.slice.slice_id);break;case ca:null==(o=(a=this.props).exportCSV)||o.call(a,this.props.slice.slice_id);break;case pa:this.props.handleToggleFullSize();break;case ua:null==(s=(l=this.props).exportFullCSV)||s.call(l,this.props.slice.slice_id);break;case la:{var h,p;const e=document.querySelector(".ant-dropdown:not(.ant-dropdown-hidden)");e.style.visibility="hidden",(0,Bt.Z)((m=this.props.slice.slice_id,`.dashboard-chart-id-${m}`),this.props.slice.slice_name,!0)(u).then((()=>{e.style.visibility="visible"})),null==(h=(p=this.props).logEvent)||h.call(p,mt.xE,{chartId:this.props.slice.slice_id});break}}var m}render(){const{componentId:e,dashboardId:t,slice:n,isFullSize:i,cachedDttm:r=[],updatedDttm:o=null,addSuccessToast:l=(()=>{}),addDangerToast:d=(()=>{}),supersetCanShare:h=!1,isCached:p=[],crossFiltersEnabled:m}=this.props,g=(0,bi.Z)().items,f="table"===n.viz_type,v=Object.entries(g).filter((e=>{var t;let[,{value:n}]=e;return null==(t=n.behaviors)?void 0:a()(t).call(t,yi.cg.INTERACTIVE_CHART)})).find((e=>{let[t]=e;return t===n.viz_type})),b=(r||[]).map((e=>ct().utc(e).fromNow())),y=o?ct().utc(o).fromNow():"",x=[...new Set(p.map((e=>e?(0,c.t)("Cached %s",b):y?(0,c.t)("Fetched %s",y):""))||"")],S=x.map(((e,t)=>(0,C.tZ)("div",{key:`tooltip-${t}`},x.length>1?(0,c.t)("Query %s: %s",t+1,e):e))),Z=i?(0,c.t)("Exit fullscreen"):(0,c.t)("Enter fullscreen"),w=(0,C.tZ)(bt.v,{onClick:this.handleMenuClick,selectable:!1},(0,C.tZ)(bt.v.Item,{key:ha,disabled:"loading"===this.props.chartStatus,style:{height:"auto",lineHeight:"initial"}},(0,c.t)("Force refresh"),(0,C.tZ)(fa,null,S)),(0,C.tZ)(bt.v.Item,{key:pa},Z),(0,C.tZ)(bt.v.Divider,null),n.description&&(0,C.tZ)(bt.v.Item,{key:ma},this.props.isDescriptionExpanded?(0,c.t)("Hide chart description"):(0,c.t)("Show chart description")),this.props.supersetCanExplore&&(0,C.tZ)(bt.v.Item,{key:da},(0,C.tZ)(vi.rU,{to:this.props.exploreUrl},(0,C.tZ)(Q.u,{title:ia(this.props.slice.slice_name)},(0,c.t)("Edit chart")))),this.props.supersetCanExplore&&(0,C.tZ)(bt.v.Item,{key:"view_query"},(0,C.tZ)(wt.Z,{triggerNode:(0,C.tZ)("span",null,(0,c.t)("View query")),modalTitle:(0,c.t)("View query"),modalBody:(0,C.tZ)(ra.Z,{latestQueryFormData:this.props.formData}),draggable:!0,resizable:!0,responsive:!0})),this.props.supersetCanExplore&&(0,C.tZ)(bt.v.Item,{key:"view_results"},(0,C.tZ)(ya,{exploreUrl:this.props.exploreUrl,triggerNode:(0,C.tZ)("span",null,(0,c.t)("View as table")),modalTitle:(0,c.t)("Chart Data: %s",n.slice_name),modalBody:(0,C.tZ)(oa.Tg,{queryFormData:this.props.formData,queryForce:!1,dataSize:20,isRequest:!0,isVisible:!0})})),(0,pt.cr)(u.T.DRILL_TO_DETAIL)&&this.props.supersetCanExplore&&(0,C.tZ)(aa.p,{chartId:n.slice_id,formData:this.props.formData}),(n.description||this.props.supersetCanExplore)&&(0,C.tZ)(bt.v.Divider,null),(0,pt.cr)(u.T.DASHBOARD_CROSS_FILTERS)&&v&&m&&(0,C.tZ)(s.Fragment,null,(0,C.tZ)(bt.v.Item,{key:sa},(0,c.t)("Cross-filter scoping")),(0,C.tZ)(bt.v.Divider,null)),h&&(0,C.tZ)(bt.v.SubMenu,{title:(0,c.t)("Share")},(0,C.tZ)(Zt,{dashboardId:t,dashboardComponentId:e,copyMenuItemTitle:(0,c.t)("Copy permalink to clipboard"),emailMenuItemTitle:(0,c.t)("Share chart by email"),emailSubject:(0,c.t)("Superset chart"),emailBody:(0,c.t)("Check out this chart: "),addSuccessToast:l,addDangerToast:d})),"filter_box"!==this.props.slice.viz_type&&this.props.supersetCanCSV&&(0,C.tZ)(bt.v.SubMenu,{title:(0,c.t)("Download")},(0,C.tZ)(bt.v.Item,{key:ca,icon:(0,C.tZ)(B.Z.FileOutlined,{css:ba})},(0,c.t)("Export to .CSV")),"filter_box"!==this.props.slice.viz_type&&(0,pt.cr)(u.T.ALLOW_FULL_CSV_EXPORT)&&this.props.supersetCanCSV&&f&&(0,C.tZ)(bt.v.Item,{key:ua,icon:(0,C.tZ)(B.Z.FileOutlined,{css:ba})},(0,c.t)("Export to full .CSV")),(0,C.tZ)(bt.v.Item,{key:la,icon:(0,C.tZ)(B.Z.FileImageOutlined,{css:ba})},(0,c.t)("Download as image"))));return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(ta,{chartId:n.slice_id,isOpen:this.state.showCrossFilterScopingModal,onClose:()=>this.setState({showCrossFilterScopingModal:!1})}),i&&(0,C.tZ)(B.Z.FullscreenExitOutlined,{style:{fontSize:22},onClick:()=>{this.props.handleToggleFullSize()}}),(0,C.tZ)(Ci.$i,{overlay:w,trigger:["click"],placement:"bottomRight"},(0,C.tZ)("span",{id:`slice_${n.slice_id}-controls`,role:"button","aria-label":"More Options"},(0,C.tZ)(va,null))))}}const xa=(0,ci.EN)(Ca);var Sa=n(87185),Za=n.n(Sa),wa=n(52794);const Ra=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: inline-block;
    color: ${t.colors.grayscale.light5};
    background: ${t.colors.grayscale.base};
    border-radius: 1em;
    vertical-align: text-top;
    padding: ${t.gridUnit}px ${2*t.gridUnit}px;
    font-size: ${t.typography.sizes.m}px;
    font-weight: ${t.typography.weights.bold};
    min-width: 1em;
    min-height: 1em;
    line-height: 1em;
    vertical-align: middle;
    white-space: nowrap;

    svg {
      position: relative;
      top: -2px;
      color: ${t.colors.grayscale.light5};
      width: 1em;
      height: 1em;
      display: inline-block;
      vertical-align: middle;
    }

    &:hover {
      cursor: pointer;
      background: ${t.colors.grayscale.dark1};
    }

    &.has-cross-filters {
      background: ${t.colors.primary.base};
      &:hover {
        background: ${t.colors.primary.dark1};
      }
    }

    &.has-incompatible-filters {
      color: ${t.colors.grayscale.dark2};
      background: ${t.colors.alert.base};
      &:hover {
        background: ${t.colors.alert.dark1};
      }
      svg {
        color: ${t.colors.grayscale.dark2};
      }
    }

    &.filters-inactive {
      color: ${t.colors.grayscale.light5};
      background: ${t.colors.grayscale.light1};
      padding: ${t.gridUnit}px;
      text-align: center;
      height: 22px;
      width: 22px;

      &:hover {
        background: ${t.colors.grayscale.base};
      }
    }
  `}}
`,ka=y.iK.span`
  position: relative;
  margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  font-weight: ${e=>{let{bold:t,theme:n}=e;return t?n.typography.weights.bold:"auto"}};
  color: ${e=>{let{color:t,theme:n}=e;return t||n.colors.grayscale.light5}};
  display: flex;
  align-items: center;
  & > * {
    margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,Ta=y.iK.i`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -${e=>{let{theme:t}=e;return 5*t.gridUnit}}px;
`,Da=y.iK.button`
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  text-align: left;
  padding: 0;
  border: none;
  background: none;
  outline: none;
  width: 100%;

  &::-moz-focus-inner {
    border: 0;
  }

  & i svg {
    color: transparent;
    margin-right: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }

  &:hover i svg {
    color: inherit;
  }
`,Ia=y.iK.div`
  margin: 0 -${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
`,_a=y.iK.div`
  padding-left: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
  margin: -${e=>{let{theme:t}=e;return 3*t.gridUnit}}px 0;
`,$a=y.iK.div`
  min-width: 200px;
  max-width: 300px;
  overflow-x: hidden;
`,Fa=y.iK.div`
  max-width: 100%;
  flex-grow: 1;
  overflow: auto;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
`,Ma=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n  padding-top: ${3*t.gridUnit}px;\n  max-width: 100%;\n  flex-grow: 1;\n  overflow: auto;\n  color: ${t.colors.grayscale.light5};\n  `}}
`;n(14670);const Ea=(0,c.t)("Please apply filter changes"),Oa=e=>null==e?"":"string"==typeof e||"number"==typeof e?`${e}`:Array.isArray(e)?e.join(", "):"object"==typeof e?JSON.stringify(e):(0,c.t)("Unknown value"),za=e=>{let{filterSetFilterValues:t,dataMaskSelected:n}=e;return t.find((e=>{let{dataMask:t={}}=e;const i=Object.entries(n);return i.every((e=>{var n;let[r,o]=e;const a=(0,pi.JB)(o.filterState,null==t||null==(n=t[r])?void 0:n.filterState,{ignoreUndefined:!0,ignoreNull:!0}),s=i.length===Object.keys(null!=t?t:{}).length;return a&&s}))}))},Pa=e=>{let{indicator:{column:t,name:n,value:i,path:r=[]},onClick:o=(()=>{}),text:a}=e;const l=Oa(i);return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(Da,{onClick:()=>o([...r,`LABEL-${t}`])},(0,C.tZ)(ka,{bold:!0},(0,C.tZ)(Ta,null,(0,C.tZ)(B.Z.SearchOutlined,{iconSize:"m",css:C.iv`
                span {
                  vertical-align: 0;
                }
              `})),n,l?": ":""),(0,C.tZ)(Fa,null,l)),a&&(0,C.tZ)(Ma,null,a))},Ua={name:"1gca25q",styles:"span{line-height:0;}"},Na=e=>{let{appliedCrossFilterIndicators:t=[],appliedIndicators:n=[],incompatibleIndicators:i=[],unsetIndicators:o=[],onHighlightFilterSource:a,children:l}=e;const[d,u]=(0,s.useState)(!1),h=(0,y.Fg)(),p=(0,r.v9)((e=>{var t;return null==(t=e.dashboardState)?void 0:t.activeTabs}));(0,s.useEffect)((()=>{d&&window.addEventListener("resize",(()=>u(!1)),{once:!0})}),[d]),(0,s.useEffect)((()=>{u(!1)}),[p]);const m=()=>{const e=[];return t.length&&e.push("appliedCrossFilters"),n.length&&e.push("applied"),i.length&&e.push("incompatible"),e.length?e:["unset"]},[g,f]=(0,s.useState)((()=>[...m()])),v=e=>`${e.column} - ${e.name}`,b=(0,C.tZ)($a,null,(0,C.tZ)(C.xB,{styles:(0,C.iv)(".filterStatusPopover{.ant-popover-inner{background-color:",h.colors.grayscale.dark2,"cc;.ant-popover-inner-content{padding-top:0;padding-bottom:0;}}&.ant-popover-placement-bottom,&.ant-popover-placement-bottomLeft,&.ant-popover-placement-bottomRight{&>.ant-popover-content>.ant-popover-arrow{border-top-color:",h.colors.grayscale.dark2,"cc;border-left-color:",h.colors.grayscale.dark2,"cc;}}&.ant-popover-placement-top,&.ant-popover-placement-topLeft,&.ant-popover-placement-topRight{&>.ant-popover-content>.ant-popover-arrow{border-bottom-color:",h.colors.grayscale.dark2,"cc;border-right-color:",h.colors.grayscale.dark2,"cc;}}&.ant-popover-placement-left,&.ant-popover-placement-leftTop,&.ant-popover-placement-leftBottom{&>.ant-popover-content>.ant-popover-arrow{border-top-color:",h.colors.grayscale.dark2,"cc;border-right-color:",h.colors.grayscale.dark2,"cc;}}&.ant-popover-placement-right,&.ant-popover-placement-rightTop,&.ant-popover-placement-rightBottom{&>.ant-popover-content>.ant-popover-arrow{border-bottom-color:",h.colors.grayscale.dark2,"cc;border-left-color:",h.colors.grayscale.dark2,"cc;}}&.ant-popover{color:",h.colors.grayscale.light4,";z-index:99;}}","")}),(0,C.tZ)(Ia,null,(0,C.tZ)(Ir.Z,{ghost:!0,light:!0,activeKey:g,onChange:function(e){f("string"==typeof e?[e]:e)}},t.length?(0,C.tZ)(Ir.Z.Panel,{key:"appliedCrossFilters",header:(0,C.tZ)(ka,{bold:!0,color:h.colors.primary.light1},(0,C.tZ)(B.Z.CursorTarget,{css:(0,C.iv)({fill:h.colors.primary.light1},"",""),iconSize:"xl"}),(0,c.t)("Applied Cross Filters (%d)",t.length))},(0,C.tZ)(_a,{css:(0,C.iv)({paddingBottom:3*h.gridUnit},"","")},t.map((e=>(0,C.tZ)(Pa,{key:v(e),indicator:e,onClick:a}))))):null,n.length?(0,C.tZ)(Ir.Z.Panel,{key:"applied",header:(0,C.tZ)(ka,{bold:!0,color:h.colors.success.base},(0,C.tZ)(B.Z.CheckCircleFilled,{css:Ua,iconSize:"m"})," ",(0,c.t)("Applied Filters (%d)",n.length))},(0,C.tZ)(_a,{css:(0,C.iv)({paddingBottom:3*h.gridUnit},"","")},n.map((e=>(0,C.tZ)(Pa,{key:v(e),indicator:e,onClick:a}))))):null,i.length?(0,C.tZ)(Ir.Z.Panel,{key:"incompatible",header:(0,C.tZ)(ka,{bold:!0,color:h.colors.alert.base},(0,C.tZ)(B.Z.ExclamationCircleFilled,{css:Ua,iconSize:"m"})," ",(0,c.t)("Incompatible Filters (%d)",i.length))},(0,C.tZ)(_a,{css:(0,C.iv)({paddingBottom:3*h.gridUnit},"","")},i.map((e=>(0,C.tZ)(Pa,{key:v(e),indicator:e,onClick:a}))))):null,o.length?(0,C.tZ)(Ir.Z.Panel,{key:"unset",header:(0,C.tZ)(ka,{bold:!0,color:h.colors.grayscale.light1},(0,C.tZ)(B.Z.MinusCircleFilled,{css:Ua,iconSize:"m"})," ",(0,c.t)("Unset Filters (%d)",o.length)),disabled:!o.length},(0,C.tZ)(_a,{css:(0,C.iv)({paddingBottom:3*h.gridUnit},"","")},o.map((e=>(0,C.tZ)(Pa,{key:v(e),indicator:e,onClick:a}))))):null)));return(0,C.tZ)(Qn.ZP,{overlayClassName:"filterStatusPopover",content:b,visible:d,onVisibleChange:function(e){u(e),e&&f(m())},placement:"bottomRight",trigger:"click"},l)};var qa,Aa=n(5364),La=n(69856);!function(e){e.Unset="UNSET",e.Applied="APPLIED",e.Incompatible="INCOMPATIBLE",e.CrossFilterApplied="CROSS_FILTER_APPLIED"}(qa||(qa={}));const ja=new Set(Object.values(La.i2)),Va=e=>null!=e&&e.label?e.label:null!=e&&e.value?(0,zi.Z)(null==e?void 0:e.value).join(", "):null,Ka=(e,t,n)=>{const i=t.columns[e],r=Array.isArray(i)?i:[i];if(null==i||t.isDateFilter&&i===Aa.vM||0===r.length)return[];if(t.isDateFilter&&ja.has(e)){const t=((e===La.i2.time_grain_sqla?n.time_grain_sqla:n.granularity)||[]).reduce(((e,t)=>{let[n,i]=t;return{...e,[n]:i}}),{});return r.map((e=>t[e]||e))}return r},Ba=e=>{var t,n;return new Set(((null==e||null==(t=e.queriesResponse)||null==(n=t[0])?void 0:n.applied_filters)||[]).map((e=>e.column)))},Ha=e=>{var t,n;return new Set(((null==e||null==(t=e.queriesResponse)||null==(n=t[0])?void 0:n.rejected_filters)||[]).map((e=>e.column)))},Wa={},Ya={},Ja={},Ga={},Qa={},Xa=[],es=e=>{var t,n,i;let{chartId:o}=e;const l=(0,r.I0)(),d=(0,r.v9)((e=>e.datasources)),c=(0,r.v9)((e=>e.dashboardFilters)),h=(0,r.v9)((e=>{var t;return null==(t=e.nativeFilters)?void 0:t.filters})),p=(0,r.v9)((e=>e.dashboardInfo)),m=(0,r.v9)((e=>e.charts)),g=(0,r.v9)((e=>e.dashboardLayout.present)),f=(0,r.v9)((e=>e.dataMask)),[v,y]=(0,s.useState)(Xa),[x,S]=(0,s.useState)(Xa),Z=(0,s.useCallback)((e=>{l((0,wa.$7)(e[0]))}),[l]),w=m[o],R=(0,Ao.D)(w),k=null==R?void 0:R.chartStatus,T=(0,Ao.D)(c),D=(0,Ao.D)(d),I=(null==w?void 0:w.chartStatus)&&a()(t=["rendered","success"]).call(t,w.chartStatus);(0,s.useEffect)((()=>{if(!I&&x.length>0)S(Xa);else if("success"!==k){var e,t,n,i,r,s,l,u;(null==w||null==(e=w.queriesResponse)||null==(t=e[0])?void 0:t.rejected_filters)===(null==R||null==(n=R.queriesResponse)||null==(i=n[0])?void 0:i.rejected_filters)&&(null==w||null==(r=w.queriesResponse)||null==(s=r[0])?void 0:s.applied_filters)===(null==R||null==(l=R.queriesResponse)||null==(u=l[0])?void 0:u.applied_filters)&&c===T&&d===D||S(((e,t,n,i)=>{const r=Ba(i),o=Ha(i),s=Object.values(t).filter((t=>t.chartId!==e)),l=Object.entries(n).filter((e=>{let[t]=e;return s.find((e=>e.datasourceId===t))})).map((e=>{let[,t]=e;return t})),d=Ya[e];if(Wa[e]&&(0,pi.JB)(null==d?void 0:d.appliedColumns,r)&&(0,pi.JB)(null==d?void 0:d.rejectedColumns,o)&&(0,pi.JB)(null==d?void 0:d.matchingFilters,s)&&(0,pi.JB)(null==d?void 0:d.matchingDatasources,l))return Wa[e];const c=s.reduce(((t,i)=>t.concat(((e,t,n,i,r)=>{const o=(e,t)=>i.has(e)&&t.columns[e]?qa.Applied:r.has(e)?qa.Incompatible:qa.Unset;return Object.keys(t.columns).filter((n=>{var i;return a()(i=(0,Yt.up)({filterScope:t.scopes[n]})).call(i,e)})).map((e=>({column:e,name:t.labels[e]||e,value:Ka(e,t,n),status:o(e,t),path:t.directPathToFilter})))})(e,i,n[i.datasourceId]||{},r,o))),[]);return c.sort(((e,t)=>e.name.localeCompare(t.name))),Wa[e]=c,Ya[e]={appliedColumns:r,rejectedColumns:o,matchingFilters:s,matchingDatasources:l},c})(o,c,d,w))}}),[w,o,c,x.length,d,null==R?void 0:R.queriesResponse,k,T,D,I]);const _=(0,Ao.D)(h),$=(0,Ao.D)(g),F=(0,Ao.D)(f),M=(0,Ao.D)(null==(n=p.metadata)?void 0:n.chart_configuration);(0,s.useEffect)((()=>{if(!I&&v.length>0)y(Xa);else if("success"!==k){var e,t,n,i,r,s,l,d,c,m;(null==w||null==(e=w.queriesResponse)||null==(t=e[0])?void 0:t.rejected_filters)===(null==R||null==(n=R.queriesResponse)||null==(i=n[0])?void 0:i.rejected_filters)&&(null==w||null==(r=w.queriesResponse)||null==(s=r[0])?void 0:s.applied_filters)===(null==R||null==(l=R.queriesResponse)||null==(d=l[0])?void 0:d.applied_filters)&&h===_&&g===$&&f===F&&M===(null==(c=p.metadata)?void 0:c.chart_configuration)||y(function(e,t,n,i,r,o){void 0===o&&(o=Qa);const s=Ba(i),l=Ha(i),d=Ga[n];if(Ja[n]&&(0,pi.JB)(null==d?void 0:d.appliedColumns,s)&&(0,pi.JB)(null==d?void 0:d.rejectedColumns,l)&&(null==d?void 0:d.nativeFilters)===e&&(null==d?void 0:d.dashboardLayout)===r&&(null==d?void 0:d.chartConfiguration)===o&&(null==d?void 0:d.dataMask)===t)return Ja[n];const c=e=>{let{label:t,column:n,type:i=Xi.gT.NativeFilters}=e;const r=null!==t;return i===Xi.gT.CrossFilters&&r?qa.CrossFilterApplied:!n&&r?qa.Applied:n&&l.has(n)?qa.Incompatible:n&&s.has(n)&&r?qa.Applied:qa.Unset};let h=[];(0,u.c)(u.T.DASHBOARD_NATIVE_FILTERS)&&(h=e&&Object.values(e).filter((e=>{var t;return e.type===Xi.BE.NATIVE_FILTER&&(null==(t=e.chartsInScope)?void 0:a()(t).call(t,n))})).map((e=>{var n,i,r,o;const a=null==(n=e.targets)||null==(i=n[0])||null==(r=i.column)?void 0:r.name,s=null==(o=t[e.id])?void 0:o.filterState,l=Va(s);return{column:a,name:e.name,path:[e.id],status:c({label:l,column:a}),value:l}})));let p=[];if((0,u.c)(u.T.DASHBOARD_CROSS_FILTERS)){const e=Object.values(r);p=Object.values(o).filter((e=>{var t,i;return null==(t=e.crossFilters)||null==(i=t.chartsInScope)?void 0:a()(i).call(i,n)})).map((n=>{var i,r,o;const a=null==(i=t[n.id])?void 0:i.filterState,s=Va(a),l=null==a?void 0:a.filters,d=l&&Object.keys(l)[0],u=e.find((e=>{var t;return(null==e||null==(t=e.meta)?void 0:t.chartId)===n.id}));return{column:d,name:null==u||null==(r=u.meta)?void 0:r.sliceName,path:[...null!=(o=null==u?void 0:u.parents)?o:[],null==u?void 0:u.id],status:c({label:s,type:Xi.gT.CrossFilters}),value:s}})).filter((e=>e.status===qa.CrossFilterApplied))}const m=p.concat(h);return Ja[n]=m,Ga[n]={nativeFilters:e,dashboardLayout:r,chartConfiguration:o,dataMask:t,appliedColumns:s,rejectedColumns:l},m}(h,f,o,w,g,null==(m=p.metadata)?void 0:m.chart_configuration))}}),[w,o,null==(i=p.metadata)?void 0:i.chart_configuration,f,h,v.length,g,null==R?void 0:R.queriesResponse,M,k,$,F,_,I]);const E=(0,s.useMemo)((()=>Za()((e=>{const t=[qa.Applied,qa.Unset,qa.Incompatible];return e.sort(((e,n)=>t.indexOf(e.status)-t.indexOf(n.status)))})([...x,...v]),((e,t)=>e.column===t.column&&e.name===t.name&&(e.status!==qa.Applied||t.status!==qa.Applied)))),[x,v]),O=(0,s.useMemo)((()=>E.filter((e=>e.status===qa.CrossFilterApplied))),[E]),z=(0,s.useMemo)((()=>E.filter((e=>e.status===qa.Applied))),[E]),P=(0,s.useMemo)((()=>E.filter((e=>e.status===qa.Unset))),[E]),U=(0,s.useMemo)((()=>E.filter((e=>e.status===qa.Incompatible))),[E]);if(!(O.length||z.length||U.length||P.length))return null;const N=!O.length&&!z.length&&!U.length;return(0,C.tZ)(Na,{appliedCrossFilterIndicators:O,appliedIndicators:z,unsetIndicators:P,incompatibleIndicators:U,onHighlightFilterSource:Z},(0,C.tZ)(Ra,{className:b()("filter-counts",!!U.length&&"has-incompatible-filters",!!O.length&&"has-cross-filters",N&&"filters-inactive")},(0,C.tZ)(B.Z.Filter,{iconSize:"m"}),!N&&(0,C.tZ)("span",null,z.length+O.length),U.length?(0,C.tZ)(s.Fragment,null," ",(0,C.tZ)(B.Z.AlertSolid,null),(0,C.tZ)("span",null,U.length)):null))},ts=s.memo(es);var ns=n(25619);const is=(0,c.t)("Annotation layers are still loading."),rs=(0,c.t)("One ore more annotation layers failed loading."),os=(0,y.iK)(B.Z.CursorTarget)`
  cursor: pointer;
  color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  height: 22px;
  width: 22px;
`,as=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    font-size: ${t.typography.sizes.l}px;
    font-weight: ${t.typography.weights.bold};
    margin-bottom: ${t.gridUnit}px;
    display: flex;
    max-width: 100%;
    align-items: flex-start;
    min-height: 0;

    & > .header-title {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      flex-grow: 1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;

      & > span.ant-tooltip-open {
        display: inline;
      }
    }

    & > .header-controls {
      display: flex;

      & > * {
        margin-left: ${2*t.gridUnit}px;
      }
    }

    .dropdown.btn-group {
      pointer-events: none;
      vertical-align: top;
      & > * {
        pointer-events: auto;
      }
    }

    .dropdown-toggle.btn.btn-default {
      background: none;
      border: none;
      box-shadow: none;
    }

    .dropdown-menu.dropdown-menu-right {
      top: ${5*t.gridUnit}px;
    }

    .divider {
      margin: ${t.gridUnit}px 0;
    }

    .refresh-tooltip {
      display: block;
      height: ${4*t.gridUnit}px;
      margin: ${t.gridUnit}px 0;
      color: ${t.colors.text.label};
    }
  `}}
`,ss=e=>{let{innerRef:t=null,forceRefresh:n=(()=>({})),updateSliceName:i=(()=>({})),toggleExpandSlice:o=(()=>({})),logExploreChart:a=(()=>({})),logEvent:l,exportCSV:d=(()=>({})),editMode:u=!1,annotationQuery:h={},annotationError:p={},cachedDttm:m=null,updatedDttm:g=null,isCached:f=[],isExpanded:v=!1,sliceName:b="",supersetCanExplore:y=!1,supersetCanShare:x=!1,supersetCanCSV:S=!1,sliceCanEdit:Z=!1,exportFullCSV:w,slice:R,componentId:k,dashboardId:T,addSuccessToast:D,addDangerToast:I,handleToggleFullSize:_,isFullSize:$,chartStatus:F,formData:M,width:E,height:O}=e;const z=(0,r.I0)(),P=(0,gi.fG)(),U=(0,s.useContext)(ns.DashboardPageIdContext),[N,q]=(0,s.useState)(null),A=(0,s.useRef)(null),L=(0,r.v9)((e=>{var t,n;return null==(t=e.dataMask[null==R?void 0:R.slice_id])||null==(n=t.filterState)?void 0:n.value})),j=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.crossFiltersEnabled})),V=(0,s.useMemo)((()=>({value:L,name:(0,c.t)("Emitted values")})),[L]),K=!u&&y;(0,s.useEffect)((()=>{const e=A.current;K?q(ia(b)):e&&(e.scrollWidth>e.offsetWidth||e.scrollHeight>e.offsetHeight)?q(null!=b?b:null):q(null)}),[b,E,O,K]);const B=`/explore/?dashboard_page_id=${U}&slice_id=${R.slice_id}`;return(0,C.tZ)(as,{ref:t},(0,C.tZ)("div",{className:"header-title",ref:A},(0,C.tZ)(Q.u,{title:N},(0,C.tZ)(fi.Z,{title:b||(u?"---":""),canEdit:u,onSaveTitle:i,showTooltip:!1,url:K?B:void 0})),!!Object.values(h).length&&(0,C.tZ)(Q.u,{id:"annotations-loading-tooltip",placement:"top",title:is},(0,C.tZ)("i",{role:"img","aria-label":is,className:"fa fa-refresh warning"})),!!Object.values(p).length&&(0,C.tZ)(Q.u,{id:"annotation-errors-tooltip",placement:"top",title:rs},(0,C.tZ)("i",{role:"img","aria-label":rs,className:"fa fa-exclamation-circle danger"}))),(0,C.tZ)("div",{className:"header-controls"},!u&&(0,C.tZ)(s.Fragment,null,L&&(0,C.tZ)(Q.u,{placement:"top",title:(0,C.tZ)(Pa,{indicator:V,text:(0,c.t)("Click to clear emitted filters")})},(0,C.tZ)(os,{onClick:()=>z((0,lt.ze)(null==R?void 0:R.slice_id))})),!P.hideChartControls&&(0,C.tZ)(ts,{chartId:R.slice_id}),!P.hideChartControls&&(0,C.tZ)(xa,{slice:R,isCached:f,isExpanded:v,cachedDttm:m,updatedDttm:g,toggleExpandSlice:o,forceRefresh:n,logExploreChart:a,logEvent:l,exportCSV:d,exportFullCSV:w,supersetCanExplore:y,supersetCanShare:x,supersetCanCSV:S,sliceCanEdit:Z,componentId:k,dashboardId:T,addSuccessToast:D,addDangerToast:I,handleToggleFullSize:_,isFullSize:$,isDescriptionExpanded:v,chartStatus:F,formData:M,exploreUrl:B,crossFiltersEnabled:j}))))},ls={height:d().number.isRequired};function ds(e){let{height:t}=e;return(0,C.tZ)("div",{className:"missing-chart-container",style:{height:t+20}},(0,C.tZ)("div",{className:"missing-chart-body"},(0,c.t)("There is no chart definition associated with this component, could it have been deleted?"),(0,C.tZ)("br",null),(0,C.tZ)("br",null),(0,c.t)("Delete this container and save to remove this message.")))}ds.propTypes=ls;var cs=n(20194);const us={id:d().number.isRequired,componentId:d().string.isRequired,dashboardId:d().number.isRequired,width:d().number.isRequired,height:d().number.isRequired,updateSliceName:d().func.isRequired,isComponentVisible:d().bool,handleToggleFullSize:d().func.isRequired,setControlValue:d().func,chart:W.$6.isRequired,formData:d().object.isRequired,labelColors:d().object,sharedLabelColors:d().object,datasource:d().object,slice:W.Rw.isRequired,sliceName:d().string.isRequired,timeout:d().number.isRequired,maxRows:d().number.isRequired,filters:d().object.isRequired,refreshChart:d().func.isRequired,logEvent:d().func.isRequired,toggleExpandSlice:d().func.isRequired,changeFilter:d().func.isRequired,setFocusedFilterField:d().func.isRequired,unsetFocusedFilterField:d().func.isRequired,editMode:d().bool.isRequired,isExpanded:d().bool.isRequired,isCached:d().bool,supersetCanExplore:d().bool.isRequired,supersetCanShare:d().bool.isRequired,supersetCanCSV:d().bool.isRequired,sliceCanEdit:d().bool.isRequired,addSuccessToast:d().func.isRequired,addDangerToast:d().func.isRequired,ownState:d().object,filterState:d().object,postTransformProps:d().func,datasetsStatus:d().oneOf(["loading","error","complete"]),isInView:d().bool,emitCrossFilters:d().bool},hs=Object.keys(us).filter((e=>"width"!==e&&"height"!==e&&"isComponentVisible"!==e)),ps=new Set(["filter_box"]),ms=y.iK.div`
  overflow: hidden;
  position: relative;

  &.dashboard-chart--overflowable {
    overflow: visible;
  }
`,gs=y.iK.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
`,fs=y.iK.div`
  display: flex;
  flex-direction: column;
  max-height: 100%;
`;class vs extends s.Component{constructor(e){super(e),this.logExploreChart=()=>{this.props.logEvent(mt.oK,{slice_id:this.props.slice.slice_id,is_cached:this.props.isCached})},this.onExploreChart=async e=>{const t=e.shiftKey||e.ctrlKey||e.metaKey;try{const e=window.localStorage.getItem("last_tab_id"),n=e?String(Number.parseInt(e,10)+1):void 0,i=await(0,mi.nv)(this.props.datasource.id,this.props.datasource.type,this.props.formData,this.props.slice.slice_id,n),r=(0,ui.y8)(null,{[yt.KD.formDataKey.name]:i,[yt.KD.sliceId.name]:this.props.slice.slice_id});(0,u.c)(u.T.DASHBOARD_EDIT_CHART_IN_NEW_TAB)||t?window.open(r,"_blank","noreferrer"):this.props.history.push(r)}catch(e){xt.Z.error(e),this.props.addDangerToast((0,c.t)("An error occurred while opening Explore"))}},this.state={width:e.width,height:e.height,descriptionHeight:0},this.changeFilter=this.changeFilter.bind(this),this.handleFilterMenuOpen=this.handleFilterMenuOpen.bind(this),this.handleFilterMenuClose=this.handleFilterMenuClose.bind(this),this.exportCSV=this.exportCSV.bind(this),this.exportFullCSV=this.exportFullCSV.bind(this),this.forceRefresh=this.forceRefresh.bind(this),this.resize=this.resize.bind(this),this.setDescriptionRef=this.setDescriptionRef.bind(this),this.setHeaderRef=this.setHeaderRef.bind(this),this.getChartHeight=this.getChartHeight.bind(this),this.getDescriptionHeight=this.getDescriptionHeight.bind(this)}shouldComponentUpdate(e,t){var n,i,r,o,a,s,l,d,c;if(t.width!==this.state.width||t.height!==this.state.height||t.descriptionHeight!==this.state.descriptionHeight||!di()(e.datasource,this.props.datasource))return!0;if((null==(n=this.props)||null==(i=n.chart)?void 0:i.chartStatus)!==(null==e||null==(r=e.chart)?void 0:r.chartStatus)&&"loading"===(null==(o=this.props)||null==(a=o.chart)?void 0:a.chartStatus))return!0;if(e.isComponentVisible){if(e.chart.triggerQuery)return!0;if(e.isFullSize!==this.props.isFullSize)return clearTimeout(this.resizeTimeout),this.resizeTimeout=setTimeout(this.resize,350),!1;e.width===this.props.width&&e.height===this.props.height&&e.width===this.state.width&&e.height===this.state.height||(clearTimeout(this.resizeTimeout),this.resizeTimeout=setTimeout(this.resize,350));for(let t=0;t<hs.length;t+=1){const n=hs[t];if(!(0,pi.JB)(e[n],this.props[n]))return!0}}else if((null==(s=e.formData)?void 0:s.color_scheme)!==(null==(l=this.props.formData)?void 0:l.color_scheme)||!(0,pi.JB)(null==(d=e.formData)?void 0:d.label_colors,null==(c=this.props.formData)?void 0:c.label_colors))return!0;return this.props.cacheBusterProp!==e.cacheBusterProp}componentDidMount(){if(this.props.isExpanded){const e=this.getDescriptionHeight();this.setState({descriptionHeight:e})}}componentWillUnmount(){clearTimeout(this.resizeTimeout)}componentDidUpdate(e){if(this.props.isExpanded!==e.isExpanded){const e=this.getDescriptionHeight();this.setState({descriptionHeight:e})}}getDescriptionHeight(){return this.props.isExpanded&&this.descriptionRef?this.descriptionRef.offsetHeight:0}getChartHeight(){const e=this.getHeaderHeight();return Math.max(this.state.height-e-this.state.descriptionHeight,20)}getHeaderHeight(){if(this.headerRef){const e=getComputedStyle(this.headerRef).getPropertyValue("margin-bottom"),t=parseInt(e,10)||0;return this.headerRef.offsetHeight+t}return 22}setDescriptionRef(e){this.descriptionRef=e}setHeaderRef(e){this.headerRef=e}resize(){const{width:e,height:t}=this.props;this.setState((()=>({width:e,height:t})))}changeFilter(e){void 0===e&&(e={}),this.props.logEvent(mt.Qg,{id:this.props.chart.id,columns:Object.keys(e)}),this.props.changeFilter(this.props.chart.id,e)}handleFilterMenuOpen(e,t){this.props.setFocusedFilterField(e,t)}handleFilterMenuClose(e,t){this.props.unsetFocusedFilterField(e,t)}exportCSV(e){void 0===e&&(e=!1),this.props.logEvent(mt.PC,{slice_id:this.props.slice.slice_id,is_cached:this.props.isCached}),(0,ui.pe)({formData:e?{...this.props.formData,row_limit:this.props.maxRows}:this.props.formData,resultType:"full",resultFormat:"csv",force:!0,ownState:this.props.ownState})}exportFullCSV(){this.exportCSV(!0)}forceRefresh(){return this.props.logEvent(mt.TD,{slice_id:this.props.slice.slice_id,is_cached:this.props.isCached}),this.props.refreshChart(this.props.chart.id,!0,this.props.dashboardId)}render(){const{id:e,componentId:t,dashboardId:n,chart:i,slice:r,datasource:o,isExpanded:a,editMode:s,filters:l,formData:d,labelColors:c,sharedLabelColors:u,updateSliceName:h,sliceName:p,toggleExpandSlice:m,timeout:g,supersetCanExplore:f,supersetCanShare:v,supersetCanCSV:y,sliceCanEdit:x,addSuccessToast:S,addDangerToast:Z,ownState:w,filterState:R,handleToggleFullSize:k,isFullSize:T,setControlValue:D,postTransformProps:I,datasetsStatus:_,isInView:$,emitCrossFilters:F,logEvent:M}=this.props,{width:E}=this.state;if(!i||!r)return(0,C.tZ)(ds,{height:this.getChartHeight()});const{queriesResponse:O,chartUpdateEndTime:z,chartStatus:P}=i,U="loading"===P,N=(null==O?void 0:O.map((e=>{let{is_cached:t}=e;return t})))||[],q=(null==O?void 0:O.map((e=>{let{cached_dttm:t}=e;return t})))||[],A=ps.has(r.viz_type),L=(0,Yt.Z3)(e)?function(e){let{activeFilters:t={},filterId:n}=e;return Object.entries(t).reduce(((e,t)=>{const[i,{values:r}]=t,{chartId:o,column:a}=(0,cs._)(i);return o===n?{...e,[a]:r}:e}),{})}({activeFilters:l,filterId:e}):{};return(0,C.tZ)(fs,{className:"chart-slice","data-test-chart-id":e,"data-test-viz-type":r.viz_type,"data-test-chart-name":r.slice_name},(0,C.tZ)(ss,{innerRef:this.setHeaderRef,slice:r,isExpanded:a,isCached:N,cachedDttm:q,updatedDttm:z,toggleExpandSlice:m,forceRefresh:this.forceRefresh,editMode:s,annotationQuery:i.annotationQuery,logExploreChart:this.logExploreChart,logEvent:M,onExploreChart:this.onExploreChart,exportCSV:this.exportCSV,exportFullCSV:this.exportFullCSV,updateSliceName:h,sliceName:p,supersetCanExplore:f,supersetCanShare:v,supersetCanCSV:y,sliceCanEdit:x,componentId:t,dashboardId:n,filters:l,addSuccessToast:S,addDangerToast:Z,handleToggleFullSize:k,isFullSize:T,chartStatus:i.chartStatus,formData:d,width:E,height:this.getHeaderHeight()}),a&&r.description_markeddown&&(0,C.tZ)("div",{className:"slice_description bs-callout bs-callout-default",ref:this.setDescriptionRef,dangerouslySetInnerHTML:{__html:r.description_markeddown}}),(0,C.tZ)(ms,{className:b()("dashboard-chart",A&&"dashboard-chart--overflowable")},U&&(0,C.tZ)(gs,{style:{width:E,height:this.getChartHeight()}}),(0,C.tZ)(hi.Z,{width:E,height:this.getChartHeight(),addFilter:this.changeFilter,onFilterMenuOpen:this.handleFilterMenuOpen,onFilterMenuClose:this.handleFilterMenuClose,annotationData:i.annotationData,chartAlert:i.chartAlert,chartId:e,chartStatus:P,datasource:o,dashboardId:n,initialValues:L,formData:d,labelColors:c,sharedLabelColors:u,ownState:w,filterState:R,queriesResponse:i.queriesResponse,timeout:g,triggerQuery:i.triggerQuery,vizType:r.viz_type,setControlValue:D,postTransformProps:I,datasetsStatus:_,isInView:$,emitCrossFilters:F})))}}vs.propTypes=us,vs.defaultProps={isCached:!1,isComponentVisible:!0};const bs=(0,ci.EN)(vs);var ys=n(9531);const Cs={},xs=(0,r.$j)((function(e,t){var n,i,r,o,a;let{charts:s,dashboardInfo:l,dashboardState:d,dataMask:c,datasources:u,sliceEntities:h,nativeFilters:p,common:m}=e;const{id:g,extraControls:f,setControlValue:v}=t,b=s[g]||Cs,y=b&&b.form_data&&u[b.form_data.datasource]||ys.tw,{colorScheme:C,colorNamespace:x,datasetsStatus:S}=d,Z=(null==l||null==(n=l.metadata)?void 0:n.label_colors)||{},w=(null==l||null==(i=l.metadata)?void 0:i.shared_label_colors)||{},R=(0,si.Z)({chart:b,chartConfiguration:null==(r=l.metadata)?void 0:r.chart_configuration,charts:s,filters:(0,Yt._f)(g),colorScheme:C,colorNamespace:x,sliceId:g,nativeFilters:null==p?void 0:p.filters,allSliceIds:d.sliceIds,dataMask:c,extraControls:f,labelColors:Z,sharedLabelColors:w});return R.dashboardId=l.id,{chart:b,datasource:y,labelColors:Z,sharedLabelColors:w,slice:h.slices[g],timeout:l.common.conf.SUPERSET_WEBSERVER_TIMEOUT,filters:(0,Yt.De)()||Cs,formData:R,editMode:d.editMode,isExpanded:!!d.expandedSlices[g],supersetCanExplore:!!l.superset_can_explore,supersetCanShare:!!l.superset_can_share,supersetCanCSV:!!l.superset_can_csv,sliceCanEdit:!!l.slice_can_edit,ownState:null==(o=c[g])?void 0:o.ownState,filterState:null==(a=c[g])?void 0:a.filterState,maxRows:m.conf.SQL_MAX_ROW,setControlValue:v,datasetsStatus:S,emitCrossFilters:!!l.crossFiltersEnabled}}),(function(e){return(0,i.DE)({updateComponents:Vn.WZ,addSuccessToast:Kn.ws,addDangerToast:Kn.Gb,toggleExpandSlice:jn.WL,changeFilter:oi.M6,setFocusedFilterField:jn.GH,unsetFocusedFilterField:jn.oY,refreshChart:ai.refreshChart,logEvent:Bn.logEvent},e)}))(bs),Ss=e=>{let{onDelete:t}=e;return(0,C.tZ)(Gn,{onClick:t,icon:(0,C.tZ)(B.Z.Trash,{iconSize:"xl"})})},Zs=y.iK.div`
  .hover-menu {
    opacity: 0;
    position: absolute;
    z-index: 10;
    font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}};
  }

  .hover-menu--left {
    width: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
    top: 50%;
    transform: translate(0, -50%);
    left: ${e=>{let{theme:t}=e;return-7*t.gridUnit}}px;
    padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .hover-menu--left > :nth-child(n):not(:only-child):not(:last-child) {
    margin-bottom: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
  }

  .hover-menu--top {
    height: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
    top: ${e=>{let{theme:t}=e;return-6*t.gridUnit}}px;
    left: 50%;
    transform: translate(-50%);
    padding: 0 ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }
`;class ws extends s.PureComponent{render(){const{innerRef:e,position:t,children:n}=this.props;return(0,C.tZ)(Zs,{className:"hover-menu-container"},(0,C.tZ)("div",{ref:e,className:b()("hover-menu","left"===t&&"hover-menu--left","top"===t&&"hover-menu--top")},n))}}ws.defaultProps={position:"left",innerRef:null,children:null};var Rs=n(29119);const ks={right:function(){return(0,C.tZ)("div",{className:"resize-handle resize-handle--right"})},bottom:function(){return(0,C.tZ)("div",{className:"resize-handle resize-handle--bottom"})},bottomRight:function(){return(0,C.tZ)("div",{className:"resize-handle resize-handle--bottom-right"})}},Ts={top:!1,right:!0,bottom:!0,left:!1,topRight:!1,bottomRight:!0,bottomLeft:!1,topLeft:!1},Ds={widthAndHeight:Ts,widthOnly:{...Ts,bottomRight:!1,bottom:!1},heightOnly:{...Ts,bottomRight:!1,right:!1},notAdjustable:{...Ts,bottomRight:!1,bottom:!1,right:!1}},Is=Number.MAX_VALUE,_s={id:d().string.isRequired,children:d().node,adjustableWidth:d().bool,adjustableHeight:d().bool,gutterWidth:d().number,widthStep:d().number,heightStep:d().number,widthMultiple:d().number,heightMultiple:d().number,minWidthMultiple:d().number,maxWidthMultiple:d().number,minHeightMultiple:d().number,maxHeightMultiple:d().number,staticHeight:d().number,staticHeightMultiple:d().number,staticWidth:d().number,staticWidthMultiple:d().number,onResizeStop:d().func,onResize:d().func,onResizeStart:d().func,editMode:d().bool.isRequired},$s={children:null,adjustableWidth:!0,adjustableHeight:!0,gutterWidth:H.es,widthStep:H.cd,heightStep:H.cd,widthMultiple:null,heightMultiple:null,minWidthMultiple:1,maxWidthMultiple:Is,minHeightMultiple:1,maxHeightMultiple:Is,staticHeight:null,staticHeightMultiple:null,staticWidth:null,staticWidthMultiple:null,onResizeStop:null,onResize:null,onResizeStart:null},Fs=[H.cd,H.cd],Ms={right:"resizable-container-handle--right",bottom:"resizable-container-handle--bottom"},Es=(0,y.iK)(Rs.e)`
  ${e=>{let{theme:t}=e;return C.iv`
    &.resizable-container {
      background-color: transparent;
      position: relative;

      /* re-resizable sets an empty div to 100% width and height, which doesn't
      play well with many 100% height containers we need */

      & ~ div {
        width: auto !important;
        height: auto !important;
      }
    }

    &.resizable-container--resizing {
      /* after ensures border visibility on top of any children */

      &:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        box-shadow: inset 0 0 0 2px ${t.colors.primary.base};
      }

      & > span .resize-handle {
        border-color: ${t.colors.primary.base};
      }
    }

    .resize-handle {
      opacity: 0;
      z-index: 10;

      &--bottom-right {
        position: absolute;
        border-right: 1px solid ${t.colors.text.label};
        border-bottom: 1px solid ${t.colors.text.label};
        right: ${4*t.gridUnit}px;
        bottom: ${4*t.gridUnit}px;
        width: ${2*t.gridUnit}px;
        height: ${2*t.gridUnit}px;
      }

      &--right {
        width: ${t.gridUnit/2}px;
        height: ${5*t.gridUnit}px;
        right: ${t.gridUnit}px;
        top: 50%;
        transform: translate(0, -50%);
        position: absolute;
        border-left: 1px solid ${t.colors.text.label};
        border-right: 1px solid ${t.colors.text.label};
      }

      &--bottom {
        height: ${t.gridUnit/2}px;
        width: ${5*t.gridUnit}px;
        bottom: ${t.gridUnit}px;
        left: 50%;
        transform: translate(-50%);
        position: absolute;
        border-top: 1px solid ${t.colors.text.label};
        border-bottom: 1px solid ${t.colors.text.label};
      }
    }
  `}}

  &.resizable-container:hover .resize-handle,
  &.resizable-container--resizing .resize-handle {
    opacity: 1;
  }

  .dragdroppable-column & .resizable-container-handle--right {
    /* override the default because the inner column's handle's mouse target is very small */
    right: 0 !important;
  }

  & .resizable-container-handle--bottom {
    bottom: 0 !important;
  }
`;class Os extends s.PureComponent{constructor(e){super(e),this.state={isResizing:!1},this.handleResizeStart=this.handleResizeStart.bind(this),this.handleResize=this.handleResize.bind(this),this.handleResizeStop=this.handleResizeStop.bind(this)}handleResizeStart(e,t,n){const{id:i,onResizeStart:r}=this.props;r&&r({id:i,direction:t,ref:n}),this.setState((()=>({isResizing:!0})))}handleResize(e,t,n){const{onResize:i,id:r}=this.props;i&&i({id:r,direction:t,ref:n})}handleResizeStop(e,t,n,i){const{id:r,onResizeStop:o,widthStep:a,heightStep:s,widthMultiple:l,heightMultiple:d,adjustableHeight:c,adjustableWidth:u,gutterWidth:h}=this.props;if(o){const e=l+Math.round(i.width/(a+h)),t=d+Math.round(i.height/s);o({id:r,widthMultiple:u?e:null,heightMultiple:c?t:null}),this.setState((()=>({isResizing:!1})))}}render(){const{children:e,adjustableWidth:t,adjustableHeight:n,widthStep:i,heightStep:r,widthMultiple:o,heightMultiple:a,staticHeight:s,staticHeightMultiple:l,staticWidth:d,staticWidthMultiple:c,minWidthMultiple:u,maxWidthMultiple:h,minHeightMultiple:p,maxHeightMultiple:m,gutterWidth:g,editMode:f}=this.props,v={width:t?(i+g)*o-g:c&&c*i||d||void 0,height:n?r*a:l&&l*r||s||void 0};let y=Ds.notAdjustable;f&&t&&n?y=Ds.widthAndHeight:f&&t?y=Ds.widthOnly:f&&n&&(y=Ds.heightOnly);const{isResizing:x}=this.state;return(0,C.tZ)(Es,{enable:y,grid:Fs,minWidth:t?u*(i+g)-g:void 0,minHeight:n?p*r:void 0,maxWidth:t?Math.max(v.width,Math.min(Is,h*(i+g)-g)):void 0,maxHeight:n?Math.max(v.height,Math.min(Is,m*r)):void 0,size:v,onResizeStart:this.handleResizeStart,onResize:this.handleResize,onResizeStop:this.handleResizeStop,handleComponent:ks,className:b()("resizable-container",x&&"resizable-container--resizing"),handleClasses:Ms},e)}}Os.propTypes=_s,Os.defaultProps=$s;const zs=Os,Ps=C.iv`
  && {
    position: fixed;
    z-index: 3000;
    left: 0;
    top: 0;
  }
`;var Us=n(78186);const Ns=(0,y.iK)(bt.v.Item)`
  &.ant-menu-item {
    height: auto;
    line-height: 1.4;

    padding-top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    padding-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;

    margin-top: 0;
    margin-bottom: 0;

    &:not(:last-child) {
      margin-bottom: 0;
    }

    &:hover {
      background: ${e=>{let{theme:t}=e;return t.colors.grayscale.light3}};
    }

    &.active {
      font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
      background: ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    }
  }

  &.ant-menu-item-selected {
    color: unset;
  }
`;var qs={name:"s5xdrg",styles:"display:flex;align-items:center"};const As=e=>{const{value:t,options:n,onChange:i,renderButton:r=(e=>e.label),renderOption:o=(e=>(0,C.tZ)("div",{className:e.className},e.label))}=e,a=(0,y.Fg)(),s=n.find((e=>e.value===t));return(0,C.tZ)(V.Gj,{trigger:["click"],overlayStyle:{zIndex:a.zIndex.max},overlay:(0,C.tZ)(bt.v,{onClick:e=>{let{key:t}=e;return i(t)}},n.map((e=>(0,C.tZ)(Ns,{id:"menu-item",key:e.value,className:b()("dropdown-item",{active:e.value===t})},o(e)))))},(0,C.tZ)("div",{role:"button",css:qs},s&&r(s),(0,C.tZ)(B.Z.CaretDown,{iconColor:a.colors.grayscale.base,css:(0,C.iv)({marginTop:.5*a.gridUnit},"","")})))},Ls=[{value:"edit",label:(0,c.t)("Edit")},{value:"preview",label:(0,c.t)("Preview")}];class js extends s.PureComponent{render(){const{id:e,value:t,onChange:n}=this.props;return(0,C.tZ)(As,{id:e,options:Ls,value:t,onChange:n})}}const Vs=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    position: relative;
    outline: none;

    &.with-popover-menu--focused:after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 2px solid ${t.colors.primary.base};
      pointer-events: none;
    }

    .dashboard-component-tabs li &.with-popover-menu--focused:after {
      top: ${-3*t.gridUnit}px;
      left: ${-2*t.gridUnit}px;
      width: calc(100% + ${4*t.gridUnit}px);
      height: calc(100% + ${7*t.gridUnit}px);
    }
  `}}
`,Ks=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    position: absolute;
    flex-wrap: nowrap;
    left: 1px;
    top: -42px;
    height: ${10*t.gridUnit}px;
    padding: 0 ${4*t.gridUnit}px;
    background: ${t.colors.grayscale.light5};
    box-shadow: 0 1px 2px 1px
      ${(0,x.Zf)(t.colors.grayscale.dark2,parseFloat(t.opacity.mediumLight)/100)};
    font-size: ${t.typography.sizes.m}px;
    cursor: default;
    z-index: 3000;

    &,
    .menu-item {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    /* vertical spacer after each menu item */
    .menu-item:not(:last-child):after {
      content: '';
      width: 1px;
      height: 100%;
      background: ${t.colors.grayscale.light2};
      margin: 0 ${4*t.gridUnit}px;
    }
  `}}
`;class Bs extends s.PureComponent{constructor(e){super(e),this.container=void 0,this.state={isFocused:e.isFocused},this.setRef=this.setRef.bind(this),this.handleClick=this.handleClick.bind(this)}UNSAFE_componentWillReceiveProps(e){e.editMode&&e.isFocused&&!this.state.isFocused?(document.addEventListener("click",this.handleClick),document.addEventListener("drag",this.handleClick),this.setState({isFocused:!0})):this.state.isFocused&&!e.editMode&&(document.removeEventListener("click",this.handleClick),document.removeEventListener("drag",this.handleClick),this.setState({isFocused:!1}))}componentWillUnmount(){document.removeEventListener("click",this.handleClick),document.removeEventListener("drag",this.handleClick)}setRef(e){this.container=e}handleClick(e){if(!this.props.editMode)return;const{onChangeFocus:t,shouldFocus:n,disableClick:i}=this.props,r=n(e,this.container);i||!r||this.state.isFocused?!r&&this.state.isFocused&&(document.removeEventListener("click",this.handleClick),document.removeEventListener("drag",this.handleClick),this.setState((()=>({isFocused:!1}))),t&&t(!1)):(document.addEventListener("click",this.handleClick),document.addEventListener("drag",this.handleClick),this.setState((()=>({isFocused:!0}))),t&&t(!0))}render(){var e;const{children:t,menuItems:n,editMode:i,style:r}=this.props,{isFocused:o}=this.state;return(0,C.tZ)(Vs,{ref:this.setRef,onClick:this.handleClick,role:"none",className:b()("with-popover-menu",i&&o&&"with-popover-menu--focused"),style:r},t,i&&o&&(null!=(e=null==n?void 0:n.length)?e:0)>0&&(0,C.tZ)(Ks,null,n.map(((e,t)=>(0,C.tZ)("div",{className:"menu-item",key:`menu-item-${t}`},e)))))}}Bs.defaultProps={children:null,disableClick:!1,onChangeFocus:null,menuItems:[],isFocused:!1,shouldFocus:(e,t)=>{var n;return(null==t?void 0:t.contains(e.target))||"menu-item"===e.target.id||"menu-item"===(null==(n=e.target.parentNode)?void 0:n.id)},style:null};const Hs={id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,depth:d().number.isRequired,editMode:d().bool.isRequired,logEvent:d().func.isRequired,addDangerToast:d().func.isRequired,undoLength:d().number.isRequired,redoLength:d().number.isRequired,availableColumnCount:d().number.isRequired,columnWidth:d().number.isRequired,onResizeStart:d().func.isRequired,onResize:d().func.isRequired,onResizeStop:d().func.isRequired,deleteComponent:d().func.isRequired,handleComponentDrop:d().func.isRequired,updateComponents:d().func.isRequired,htmlSanitization:d().bool,htmlSchemaOverrides:d().object},Ws="# ✨Header 1\n## ✨Header 2\n### ✨Header 3\n\n<br />\n\nClick here to learn more about [markdown formatting](https://bit.ly/1dQOfRK)",Ys=(0,c.t)("This markdown component has an error."),Js=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    &.dashboard-markdown {
      overflow: hidden;

      h4,
      h5,
      h6 {
        font-weight: ${t.typography.weights.normal};
      }

      h5 {
        color: ${t.colors.grayscale.base};
      }

      h6 {
        font-size: ${t.typography.sizes.s}px;
      }

      .dashboard-component-chart-holder {
        overflow-y: auto;
        overflow-x: hidden;
      }

      .dashboard--editing & {
        cursor: move;
      }
    }
  `}}
`;class Gs extends s.PureComponent{constructor(e){super(e),this.state={isFocused:!1,markdownSource:e.component.meta.code,editor:null,editorMode:"preview",undoLength:e.undoLength,redoLength:e.redoLength},this.renderStartTime=mt.Yd.getTimestamp(),this.handleChangeFocus=this.handleChangeFocus.bind(this),this.handleChangeEditorMode=this.handleChangeEditorMode.bind(this),this.handleMarkdownChange=this.handleMarkdownChange.bind(this),this.handleDeleteComponent=this.handleDeleteComponent.bind(this),this.handleResizeStart=this.handleResizeStart.bind(this),this.setEditor=this.setEditor.bind(this)}componentDidMount(){this.props.logEvent(mt.aD,{viz_type:"markdown",start_offset:this.renderStartTime,ts:(new Date).getTime(),duration:mt.Yd.getTimestamp()-this.renderStartTime})}static getDerivedStateFromProps(e,t){const{hasError:n,editorMode:i,markdownSource:r,undoLength:o,redoLength:a}=t,{component:s,undoLength:l,redoLength:d}=e;return l!==o||d!==a?{...t,undoLength:l,redoLength:d,markdownSource:s.meta.code,hasError:!1}:n||"preview"!==i||s.meta.code===r?t:{...t,markdownSource:s.meta.code}}static getDerivedStateFromError(){return{hasError:!0}}componentDidUpdate(e){!this.state.editor||e.component.meta.width===this.props.component.meta.width&&e.columnWidth===this.props.columnWidth||this.state.editor.resize(!0),this.props.editMode&&Rt.cE.preload()}componentDidCatch(){this.state.editor&&"preview"===this.state.editorMode&&this.props.addDangerToast((0,c.t)("This markdown component has an error. Please revert your recent changes."))}setEditor(e){e.getSession().setUseWrapMode(!0),this.setState({editor:e})}handleChangeFocus(e){const t=!!e,n=t?"edit":"preview";this.setState((()=>({isFocused:t}))),this.handleChangeEditorMode(n)}handleChangeEditorMode(e){const t={...this.state,editorMode:e};"preview"===e&&(this.updateMarkdownContent(),t.hasError=!1),this.setState(t)}updateMarkdownContent(){const{updateComponents:e,component:t}=this.props;t.meta.code!==this.state.markdownSource&&e({[t.id]:{...t,meta:{...t.meta,code:this.state.markdownSource}}})}handleMarkdownChange(e){this.setState({markdownSource:e})}handleDeleteComponent(){const{deleteComponent:e,id:t,parentId:n}=this.props;e(t,n)}handleResizeStart(e){const{editorMode:t}=this.state,{editMode:n,onResizeStart:i}=this.props,r="edit"===t;i(e),n&&r&&this.updateMarkdownContent()}renderEditMode(){return(0,C.tZ)(Rt.cE,{onChange:this.handleMarkdownChange,width:"100%",height:"100%",showGutter:!1,editorProps:{$blockScrolling:!0},value:"string"==typeof this.state.markdownSource?this.state.markdownSource:Ws,readOnly:!1,onLoad:this.setEditor})}renderPreviewMode(){const{hasError:e}=this.state;return(0,C.tZ)(Us.Z,{source:e?Ys:this.state.markdownSource||Ws,htmlSanitization:this.props.htmlSanitization,htmlSchemaOverrides:this.props.htmlSchemaOverrides})}render(){const{isFocused:e,editorMode:t}=this.state,{component:n,parentComponent:i,index:r,depth:o,availableColumnCount:a,columnWidth:s,onResize:l,onResizeStop:d,handleComponentDrop:c,editMode:u}=this.props,h=i.type===g.BA?i.meta.width||H.cx:n.meta.width||H.cx,p="edit"===t;return(0,C.tZ)(Ee,{component:n,parentComponent:i,orientation:i.type===g.Os?"column":"row",index:r,depth:o,onDrop:c,disableDragDrop:e,editMode:u},(t=>{let{dropIndicatorProps:r,dragSourceRef:o}=t;return(0,C.tZ)(Bs,{onChangeFocus:this.handleChangeFocus,menuItems:[(0,C.tZ)(js,{id:`${n.id}-mode`,value:this.state.editorMode,onChange:this.handleChangeEditorMode})],editMode:u},(0,C.tZ)(Js,{className:b()("dashboard-markdown",p&&"dashboard-markdown--editing"),id:n.id},(0,C.tZ)(zs,{id:n.id,adjustableWidth:i.type===g.Os,adjustableHeight:!0,widthStep:s,widthMultiple:h,heightStep:H.cd,heightMultiple:n.meta.height,minWidthMultiple:H.cx,minHeightMultiple:H.AA,maxWidthMultiple:a+h,onResizeStart:this.handleResizeStart,onResize:l,onResizeStop:d,editMode:!e&&u},(0,C.tZ)("div",{ref:o,className:"dashboard-component dashboard-component-chart-holder"},u&&(0,C.tZ)(ws,{position:"top"},(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent})),u&&p?this.renderEditMode():this.renderPreviewMode()))),r&&(0,C.tZ)("div",r))}))}}Gs.propTypes=Hs,Gs.defaultProps={};const Qs=(0,r.$j)((function(e){return{undoLength:e.dashboardLayout.past.length,redoLength:e.dashboardLayout.future.length,htmlSanitization:e.common.conf.HTML_SANITIZATION,htmlSchemaOverrides:e.common.conf.HTML_SANITIZATION_SCHEMA_EXTENSIONS}}))(Gs),Xs=y.iK.div`
  ${e=>{let{theme:t,position:n}=e;return C.iv`
    height: ${5*t.gridUnit}px;
    overflow: hidden;
    cursor: move;
    ${"top"===n&&C.iv`
      transform: rotate(90deg);
    `}
    & path {
      fill: ${t.colors.grayscale.base};
    }
  `}}
`;function el(e){let{position:t="left",innerRef:n=null}=e;return(0,C.tZ)(Xs,{ref:n,position:t},(0,C.tZ)(B.Z.Drag,null))}var tl=n(713);const nl=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: inline-block;

    &:before {
      content: '';
      width: 1em;
      height: 1em;
      margin-right: ${2*t.gridUnit}px;
      display: inline-block;
      vertical-align: middle;
    }

    &.background--white {
      padding-left: 0;
      background: transparent;

      &:before {
        background: ${t.colors.grayscale.light5};
        border: 1px solid ${t.colors.grayscale.light2};
      }
    }

    /* Create the transparent rect icon */
    &.background--transparent:before {
      background-image: linear-gradient(
          45deg,
          ${t.colors.text.label} 25%,
          transparent 25%
        ),
        linear-gradient(-45deg, ${t.colors.text.label} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${t.colors.text.label} 75%),
        linear-gradient(-45deg, transparent 75%, ${t.colors.text.label} 75%);
      background-size: ${2*t.gridUnit}px ${2*t.gridUnit}px;
      background-position: 0 0, 0 ${t.gridUnit}px,
        ${t.gridUnit}px ${-t.gridUnit}px, ${-t.gridUnit}px 0px;
    }
  `}}
`;function il(e){const t=(0,c.t)("background");return(0,C.tZ)(nl,{className:b()("background-style-option",e.className)},`${e.label} ${t}`)}function rl(e){return(0,C.tZ)(nl,{className:b()("background-style-option",e.className)},e.label)}class ol extends s.PureComponent{render(){const{id:e,value:t,onChange:n}=this.props;return(0,C.tZ)(As,{id:e,options:tl.Z,value:t,onChange:n,renderButton:il,renderOption:rl})}}const al={id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,depth:d().number.isRequired,editMode:d().bool.isRequired,availableColumnCount:d().number.isRequired,columnWidth:d().number.isRequired,minColumnWidth:d().number.isRequired,onResizeStart:d().func.isRequired,onResize:d().func.isRequired,onResizeStop:d().func.isRequired,deleteComponent:d().func.isRequired,handleComponentDrop:d().func.isRequired,updateComponents:d().func.isRequired},sl=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    &.grid-column {
      width: 100%;
      position: relative;

      & > :not(.hover-menu):not(:last-child) {
        margin-bottom: ${4*t.gridUnit}px;
      }
    }

    .dashboard--editing &:after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
      border: 1px dashed ${t.colors.grayscale.light2};
    }
    .dashboard--editing .resizable-container--resizing:hover > &:after,
    .dashboard--editing .hover-menu:hover + &:after {
      border: 1px dashed ${t.colors.primary.base};
      z-index: 2;
    }
  `}}
`,ll=e=>C.iv`
  min-height: ${25*e.gridUnit}px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${e.colors.text.label};
`;class dl extends s.PureComponent{constructor(e){super(e),this.state={isFocused:!1},this.handleChangeBackground=this.handleUpdateMeta.bind(this,"background"),this.handleChangeFocus=this.handleChangeFocus.bind(this),this.handleDeleteComponent=this.handleDeleteComponent.bind(this)}handleDeleteComponent(){const{deleteComponent:e,id:t,parentId:n}=this.props;e(t,n)}handleChangeFocus(e){this.setState((()=>({isFocused:Boolean(e)})))}handleUpdateMeta(e,t){const{updateComponents:n,component:i}=this.props;t&&i.meta[e]!==t&&n({[i.id]:{...i,meta:{...i.meta,[e]:t}}})}render(){const{component:e,parentComponent:t,index:n,availableColumnCount:i,columnWidth:r,minColumnWidth:o,depth:a,onResizeStart:s,onResize:l,onResizeStop:d,handleComponentDrop:u,editMode:h,onChangeTab:p,isComponentVisible:m}=this.props,g=e.children||[],f=tl.Z.find((t=>t.value===(e.meta.background||H.HE)));return(0,C.tZ)(Ee,{component:e,parentComponent:t,orientation:"column",index:n,depth:a,onDrop:u,editMode:h},(t=>{let{dropIndicatorProps:n,dragSourceRef:u}=t;return(0,C.tZ)(zs,{id:e.id,adjustableWidth:!0,adjustableHeight:!1,widthStep:r,widthMultiple:e.meta.width,minWidthMultiple:o,maxWidthMultiple:i+(e.meta.width||0),onResizeStart:s,onResize:l,onResizeStop:d,editMode:h},(0,C.tZ)(Bs,{isFocused:this.state.isFocused,onChangeFocus:this.handleChangeFocus,disableClick:!0,menuItems:[(0,C.tZ)(ol,{id:`${e.id}-background`,value:e.meta.background,onChange:this.handleChangeBackground})],editMode:h},h&&(0,C.tZ)(ws,{innerRef:u,position:"top"},(0,C.tZ)(el,{position:"top"}),(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent}),(0,C.tZ)(Gn,{onClick:this.handleChangeFocus,icon:(0,C.tZ)(B.Z.Cog,{iconSize:"xl"})})),(0,C.tZ)(sl,{className:b()("grid-column",f.className)},0===g.length?(0,C.tZ)("div",{css:ll},(0,c.t)("Empty column")):g.map(((t,n)=>(0,C.tZ)(Wl,{key:t,id:t,parentId:e.id,depth:a+1,index:n,availableColumnCount:e.meta.width,columnWidth:r,onResizeStart:s,onResize:l,onResizeStop:d,isComponentVisible:m,onChangeTab:p}))),n&&(0,C.tZ)("div",n))))}))}}dl.propTypes=al,dl.defaultProps={};const cl=dl,ul={id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,depth:d().number.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,editMode:d().bool.isRequired,handleComponentDrop:d().func.isRequired,deleteComponent:d().func.isRequired},hl=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    width: 100%;
    padding: ${2*t.gridUnit}px 0; /* this is padding not margin to enable a larger mouse target */
    background-color: transparent;

    &:after {
      content: '';
      height: 1px;
      width: 100%;
      background-color: ${t.colors.grayscale.light2};
      display: block;
    }

    div[draggable='true'] & {
      cursor: move;
    }

    .dashboard-component-tabs & {
      padding-left: ${4*t.gridUnit}px;
      padding-right: ${4*t.gridUnit}px;
    }
  `}}
`;class pl extends s.PureComponent{constructor(e){super(e),this.handleDeleteComponent=this.handleDeleteComponent.bind(this)}handleDeleteComponent(){const{deleteComponent:e,id:t,parentId:n}=this.props;e(t,n)}render(){const{component:e,depth:t,parentComponent:n,index:i,handleComponentDrop:r,editMode:o}=this.props;return(0,C.tZ)(Ee,{component:e,parentComponent:n,orientation:"row",index:i,depth:t,onDrop:r,editMode:o},(e=>{let{dropIndicatorProps:t,dragSourceRef:n}=e;return(0,C.tZ)("div",{ref:n},o&&(0,C.tZ)(ws,{position:"left"},(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent})),(0,C.tZ)(hl,{className:"dashboard-component dashboard-component-divider"}),t&&(0,C.tZ)("div",t))}))}}pl.propTypes=ul;const ml=pl;var gl=n(79271);const fl={id:d().string.isRequired,dashboardId:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,depth:d().number.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,editMode:d().bool.isRequired,handleComponentDrop:d().func.isRequired,deleteComponent:d().func.isRequired,updateComponents:d().func.isRequired},vl=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    font-weight: ${t.typography.weights.bold};
    width: 100%;
    padding: ${4*t.gridUnit}px 0;

    &.header-small {
      font-size: ${t.typography.sizes.l}px;
    }

    &.header-medium {
      font-size: ${t.typography.sizes.xl}px;
    }

    &.header-large {
      font-size: ${t.typography.sizes.xxl}px;
    }

    .dashboard--editing .dashboard-grid & {
      &:after {
        border: 1px dashed transparent;
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 1;
        pointer-events: none;
      }

      &:hover:after {
        border: 1px dashed ${t.colors.primary.base};
        z-index: 2;
      }
    }

    .dashboard--editing .dragdroppable-row & {
      cursor: move;
    }

    /**
   * grids add margin between items, so don't double pad within columns
   * we'll not worry about double padding on top as it can serve as a visual separator
   */
    .grid-column > :not(:last-child) & {
      margin-bottom: ${-4*t.gridUnit}px;
    }

    .background--white &,
    &.background--white,
    .dashboard-component-tabs & {
      padding-left: ${4*t.gridUnit}px;
      padding-right: ${4*t.gridUnit}px;
    }
  `}}
`;class bl extends s.PureComponent{constructor(e){super(e),this.state={isFocused:!1},this.handleDeleteComponent=this.handleDeleteComponent.bind(this),this.handleChangeFocus=this.handleChangeFocus.bind(this),this.handleUpdateMeta=this.handleUpdateMeta.bind(this),this.handleChangeSize=this.handleUpdateMeta.bind(this,"headerSize"),this.handleChangeBackground=this.handleUpdateMeta.bind(this,"background"),this.handleChangeText=this.handleUpdateMeta.bind(this,"text")}handleChangeFocus(e){this.setState((()=>({isFocused:e})))}handleUpdateMeta(e,t){const{updateComponents:n,component:i}=this.props;t&&i.meta[e]!==t&&n({[i.id]:{...i,meta:{...i.meta,[e]:t}}})}handleDeleteComponent(){const{deleteComponent:e,id:t,parentId:n}=this.props;e(t,n)}render(){const{isFocused:e}=this.state,{dashboardId:t,component:n,depth:i,parentComponent:r,index:o,handleComponentDrop:a,editMode:s}=this.props,l=gl.Z.find((e=>e.value===(n.meta.headerSize||H.u_))),d=tl.Z.find((e=>e.value===(n.meta.background||H.HE)));return(0,C.tZ)(Ee,{component:n,parentComponent:r,orientation:"row",index:o,depth:i,onDrop:a,disableDragDrop:e,editMode:s},(e=>{let{dropIndicatorProps:r,dragSourceRef:o}=e;return(0,C.tZ)("div",{ref:o},s&&i<=2&&(0,C.tZ)(ws,{position:"left"},(0,C.tZ)(el,{position:"left"})),(0,C.tZ)(Bs,{onChangeFocus:this.handleChangeFocus,menuItems:[(0,C.tZ)(As,{id:`${n.id}-header-style`,options:gl.Z,value:n.meta.headerSize,onChange:this.handleChangeSize}),(0,C.tZ)(ol,{id:`${n.id}-background`,value:n.meta.background,onChange:this.handleChangeBackground})],editMode:s},(0,C.tZ)(vl,{className:b()("dashboard-component","dashboard-component-header",l.className,d.className)},s&&(0,C.tZ)(ws,{position:"top"},(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent})),(0,C.tZ)(fi.Z,{title:n.meta.text,canEdit:s,onSaveTitle:this.handleChangeText,showTooltip:!1}),!s&&(0,C.tZ)(ii,{id:n.id,dashboardId:t}))),r&&(0,C.tZ)("div",r))}))}}bl.propTypes=fl,bl.defaultProps={};const yl=bl;var Cl=n(71894);const xl={id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,depth:d().number.isRequired,editMode:d().bool.isRequired,availableColumnCount:d().number.isRequired,columnWidth:d().number.isRequired,occupiedColumnCount:d().number.isRequired,onResizeStart:d().func.isRequired,onResize:d().func.isRequired,onResizeStop:d().func.isRequired,handleComponentDrop:d().func.isRequired,deleteComponent:d().func.isRequired,updateComponents:d().func.isRequired},Sl=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    position: relative;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
    width: 100%;
    height: fit-content;

    & > :not(:last-child):not(.hover-menu) {
      margin-right: ${4*t.gridUnit}px;
    }

    &.grid-row--empty {
      min-height: ${25*t.gridUnit}px;
    }
  `}}
`,Zl=e=>C.iv`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${e.colors.text.label};
`;class wl extends s.PureComponent{constructor(e){super(e),this.state={isFocused:!1,isInView:!1},this.handleDeleteComponent=this.handleDeleteComponent.bind(this),this.handleUpdateMeta=this.handleUpdateMeta.bind(this),this.handleChangeBackground=this.handleUpdateMeta.bind(this,"background"),this.handleChangeFocus=this.handleChangeFocus.bind(this),this.containerRef=s.createRef(),this.observerEnabler=null,this.observerDisabler=null}componentDidMount(){if((0,u.c)(u.T.DASHBOARD_VIRTUALIZATION)&&!(0,Cl.b)()){this.observerEnabler=new IntersectionObserver((e=>{let[t]=e;t.isIntersecting&&!this.state.isInView&&this.setState({isInView:!0})}),{rootMargin:"100% 0px"}),this.observerDisabler=new IntersectionObserver((e=>{let[t]=e;!t.isIntersecting&&this.state.isInView&&this.setState({isInView:!1})}),{rootMargin:"400% 0px"});const e=this.containerRef.current;e&&(this.observerEnabler.observe(e),this.observerDisabler.observe(e))}}componentWillUnmount(){var e,t;null==(e=this.observerEnabler)||e.disconnect(),null==(t=this.observerDisabler)||t.disconnect()}handleChangeFocus(e){this.setState((()=>({isFocused:Boolean(e)})))}handleUpdateMeta(e,t){const{updateComponents:n,component:i}=this.props;t&&i.meta[e]!==t&&n({[i.id]:{...i,meta:{...i.meta,[e]:t}}})}handleDeleteComponent(){const{deleteComponent:e,component:t,parentId:n}=this.props;e(t.id,n)}render(){const{component:e,parentComponent:t,index:n,availableColumnCount:i,columnWidth:r,occupiedColumnCount:o,depth:a,onResizeStart:s,onResize:l,onResizeStop:d,handleComponentDrop:u,editMode:h,onChangeTab:p,isComponentVisible:m}=this.props,g=e.children||[],f=tl.Z.find((t=>t.value===(e.meta.background||H.HE)));return(0,C.tZ)(Ee,{component:e,parentComponent:t,orientation:"row",index:n,depth:a,onDrop:u,editMode:h},(t=>{let{dropIndicatorProps:n,dragSourceRef:u}=t;return(0,C.tZ)(Bs,{isFocused:this.state.isFocused,onChangeFocus:this.handleChangeFocus,disableClick:!0,menuItems:[(0,C.tZ)(ol,{id:`${e.id}-background`,value:f.value,onChange:this.handleChangeBackground})],editMode:h},h&&(0,C.tZ)(ws,{innerRef:u,position:"left"},(0,C.tZ)(el,{position:"left"}),(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent}),(0,C.tZ)(Gn,{onClick:this.handleChangeFocus,icon:(0,C.tZ)(B.Z.Cog,{iconSize:"xl"})})),(0,C.tZ)(Sl,{className:b()("grid-row",0===g.length&&"grid-row--empty",f.className),ref:this.containerRef},0===g.length?(0,C.tZ)("div",{css:Zl},(0,c.t)("Empty row")):g.map(((t,n)=>(0,C.tZ)(Wl,{key:t,id:t,parentId:e.id,depth:a+1,index:n,availableColumnCount:i-o,columnWidth:r,onResizeStart:s,onResize:l,onResizeStop:d,isComponentVisible:m,onChangeTab:p,isInView:this.state.isInView}))),n&&(0,C.tZ)("div",n)))}))}}wl.propTypes=xl;const Rl=wl;var kl=n(94301);const Tl="RENDER_TAB",Dl="RENDER_TAB_CONTENT",Il={dashboardId:d().number.isRequired,id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,depth:d().number.isRequired,renderType:d().oneOf([Tl,Dl]).isRequired,onDropOnTab:d().func,onHoverTab:d().func,editMode:d().bool.isRequired,canEdit:d().bool.isRequired,availableColumnCount:d().number,columnWidth:d().number,onResizeStart:d().func,onResize:d().func,onResizeStop:d().func,handleComponentDrop:d().func.isRequired,updateComponents:d().func.isRequired,setDirectPathToChild:d().func.isRequired,setEditMode:d().func.isRequired},_l={availableColumnCount:0,columnWidth:0,onDropOnTab(){},onHoverTab(){},onResizeStart(){},onResize(){},onResizeStop(){}},$l=y.iK.div`
  ${e=>{let{isHighlighted:t,theme:{gridUnit:n,colors:i}}=e;return`\n    padding: ${n}px ${2*n}px;\n    margin: ${-n}px ${-2*n}px;\n    transition: box-shadow 0.2s ease-in-out;\n    ${t&&`box-shadow: 0 0 ${n}px ${i.primary.light1};`}\n  `}}
`,Fl=e=>e.dropIndicatorProps&&(0,C.tZ)("div",{className:"drop-indicator drop-indicator--bottom"}),Ml=e=>e.dropIndicatorProps&&(0,C.tZ)("div",{className:"drop-indicator drop-indicator--top"});class El extends s.PureComponent{constructor(e){super(e),this.handleChangeText=this.handleChangeText.bind(this),this.handleDrop=this.handleDrop.bind(this),this.handleOnHover=this.handleOnHover.bind(this),this.handleTopDropTargetDrop=this.handleTopDropTargetDrop.bind(this),this.handleChangeTab=this.handleChangeTab.bind(this)}handleChangeTab(e){let{pathToTabIndex:t}=e;this.props.setDirectPathToChild(t)}handleChangeText(e){const{updateComponents:t,component:n}=this.props;e&&e!==n.meta.text&&t({[n.id]:{...n,meta:{...n.meta,text:e}}})}handleDrop(e){this.props.handleComponentDrop(e),this.props.onDropOnTab(e)}handleOnHover(){this.props.onHoverTab()}handleTopDropTargetDrop(e){e&&this.props.handleComponentDrop({...e,destination:{...e.destination,index:0}})}renderTabContent(){const{component:e,parentComponent:t,depth:n,availableColumnCount:i,columnWidth:r,onResizeStart:o,onResize:a,onResizeStop:s,editMode:l,isComponentVisible:d,canEdit:u,setEditMode:h,dashboardId:p}=this.props,m=0===e.children.length;return(0,C.tZ)("div",{className:"dashboard-component-tabs-content"},l&&(0,C.tZ)(Ee,{component:e,parentComponent:t,orientation:"column",index:0,depth:n,onDrop:this.handleTopDropTargetDrop,editMode:!0,className:"empty-droptarget"},Ml),m&&(0,C.tZ)(kl.x3,{title:l?(0,c.t)("Drag and drop components to this tab"):(0,c.t)("There are no components added to this tab"),description:u&&(l?(0,C.tZ)("span",null,(0,c.t)("You can")," ",(0,C.tZ)("a",{href:`/chart/add?dashboard_id=${p}`,rel:"noopener noreferrer",target:"_blank"},(0,c.t)("create a new chart"))," ",(0,c.t)("or use existing ones from the panel on the right")):(0,C.tZ)("span",null,(0,c.t)("You can add the components in the")," ",(0,C.tZ)("span",{role:"button",tabIndex:0,onClick:()=>h(!0)},(0,c.t)("edit mode")))),image:"chart.svg"}),e.children.map(((t,l)=>(0,C.tZ)(Wl,{key:t,id:t,parentId:e.id,depth:n,index:l,onDrop:this.handleDrop,onHover:this.handleOnHover,availableColumnCount:i,columnWidth:r,onResizeStart:o,onResize:a,onResizeStop:s,isComponentVisible:d,onChangeTab:this.handleChangeTab}))),l&&(0,C.tZ)(Ee,{component:e,parentComponent:t,orientation:"column",index:e.children.length,depth:n,onDrop:this.handleDrop,onHover:this.handleOnHover,editMode:!0,className:"empty-droptarget"},Fl))}renderTab(){const{component:e,parentComponent:t,index:n,depth:i,editMode:r,isFocused:o,isHighlighted:a}=this.props;return(0,C.tZ)(Ee,{component:e,parentComponent:t,orientation:"column",index:n,depth:i,onDrop:this.handleDrop,onHover:this.handleOnHover,editMode:r},(t=>{let{dropIndicatorProps:i,dragSourceRef:s}=t;return(0,C.tZ)($l,{isHighlighted:a,className:"dragdroppable-tab",ref:s},(0,C.tZ)(fi.Z,{title:e.meta.text,defaultTitle:e.meta.defaultText,placeholder:e.meta.placeholder,canEdit:r&&o,onSaveTitle:this.handleChangeText,showTooltip:!1,editing:r&&o}),!r&&(0,C.tZ)(ii,{id:e.id,dashboardId:this.props.dashboardId,placement:n>=5?"left":"right"}),i&&(0,C.tZ)("div",i))}))}render(){const{renderType:e}=this.props;return e===Tl?this.renderTab():this.renderTabContent()}}El.propTypes=Il,El.defaultProps=_l;const Ol=(0,r.$j)((function(e){return{canEdit:e.dashboardInfo.dash_edit_perm}}),(function(e){return(0,i.DE)({setEditMode:jn.Mb},e)}))(El);function zl(e){let{currentComponent:t,directPathToChild:n=[]}=e;if(!t||0===n.length||-1===n.indexOf(t.id))return-1;const i=n.findIndex((e=>e===t.id)),r=n[i+1];return t.children.indexOf(r)>=0?t.children.findIndex((e=>e===r)):-1}function Pl(e,t){const n=(e.parents||[]).slice();return n.push(e.id),n.push(e.children[t]),n}function Ul(e){if(void 0===e&&(e=[]),e.length>0){const t=e.slice();for(;t.length;){const e=t.pop(),n=e&&e.split("-")[0];if(!a()(H.Ep).call(H.Ep,n))return e}}return null}const Nl={id:d().string.isRequired,parentId:d().string.isRequired,component:W.cP.isRequired,parentComponent:W.cP.isRequired,index:d().number.isRequired,depth:d().number.isRequired,renderTabContent:d().bool,editMode:d().bool.isRequired,renderHoverMenu:d().bool,directPathToChild:d().arrayOf(d().string),activeTabs:d().arrayOf(d().string),logEvent:d().func.isRequired,setActiveTabs:d().func,availableColumnCount:d().number,columnWidth:d().number,onResizeStart:d().func,onResize:d().func,onResizeStop:d().func,createComponent:d().func.isRequired,handleComponentDrop:d().func.isRequired,onChangeTab:d().func.isRequired,deleteComponent:d().func.isRequired,updateComponents:d().func.isRequired},ql={renderTabContent:!0,renderHoverMenu:!0,availableColumnCount:0,columnWidth:0,activeTabs:[],directPathToChild:[],setActiveTabs(){},onResizeStart(){},onResize(){},onResizeStop(){}},Al=y.iK.div`
  width: 100%;
  background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};

  .dashboard-component-tabs-content {
    min-height: ${e=>{let{theme:t}=e;return 12*t.gridUnit}}px;
    margin-top: ${e=>{let{theme:t}=e;return t.gridUnit/4}}px;
    position: relative;
  }

  .ant-tabs {
    overflow: visible;

    .ant-tabs-nav-wrap {
      min-height: ${e=>{let{theme:t}=e;return 12.5*t.gridUnit}}px;
    }

    .ant-tabs-content-holder {
      overflow: visible;
    }
  }

  div .ant-tabs-tab-btn {
    text-transform: none;
  }
`;class Ll extends s.PureComponent{constructor(e){super(e),this.getTabInfo=e=>{var t;let n=Math.max(0,zl({currentComponent:e.component,directPathToChild:e.directPathToChild}));0===n&&null!=(t=e.activeTabs)&&t.length&&e.component.children.forEach(((t,i)=>{var r;0===n&&a()(r=e.activeTabs).call(r,t)&&(n=i)}));const{children:i}=e.component,r=i[n];return{tabIndex:n,activeKey:r}},this.showDeleteConfirmModal=e=>{const{component:t,deleteComponent:n}=this.props;V.xT.confirm({title:(0,c.t)("Delete dashboard tab?"),content:(0,C.tZ)("span",null,(0,c.t)("Deleting a tab will remove all content within it. You may still reverse this action with the")," ",(0,C.tZ)("b",null,(0,c.t)("undo"))," ",(0,c.t)("button (cmd + z) until you save your changes.")),onOk:()=>{n(e,t.id);const i=t.children.indexOf(e);this.handleDeleteTab(i)},okType:"danger",okText:(0,c.t)("DELETE"),cancelText:(0,c.t)("CANCEL"),icon:null})},this.handleEdit=(e,t)=>{const{component:n,createComponent:i}=this.props;"add"===t?(null==e||null==e.stopPropagation||e.stopPropagation(),i({destination:{id:n.id,type:n.type,index:n.children.length},dragging:{id:H.Xk,type:g.gn}})):"remove"===t&&this.showDeleteConfirmModal(e)};const{tabIndex:t,activeKey:n}=this.getTabInfo(e);this.state={tabIndex:t,activeKey:n},this.handleClickTab=this.handleClickTab.bind(this),this.handleDeleteComponent=this.handleDeleteComponent.bind(this),this.handleDeleteTab=this.handleDeleteTab.bind(this),this.handleDropOnTab=this.handleDropOnTab.bind(this),this.handleDrop=this.handleDrop.bind(this)}componentDidMount(){this.props.setActiveTabs(this.state.activeKey)}componentDidUpdate(e,t){t.activeKey!==this.state.activeKey&&this.props.setActiveTabs(this.state.activeKey,t.activeKey)}UNSAFE_componentWillReceiveProps(e){const t=Math.max(0,e.component.children.length-1),n=this.props.component.children,i=e.component.children;if(this.state.tabIndex>t&&this.setState((()=>({tabIndex:t}))),e.dashboardId!==this.props.dashboardId){const{tabIndex:t,activeKey:n}=this.getTabInfo(e);this.setState((()=>({tabIndex:t,activeKey:n})))}if(e.isComponentVisible){const t=Ul(e.directPathToChild),r=Ul(this.props.directPathToChild);if(t!==r||t===r&&n!==i){const t=zl({currentComponent:e.component,directPathToChild:e.directPathToChild});t>-1&&t!==this.state.tabIndex&&this.setState((()=>({tabIndex:t,activeKey:i[t]})))}}}handleClickTab(e){const{component:t}=this.props,{children:n}=t;if(e!==this.state.tabIndex){const n=Pl(t,e),i=n[n.length-1];this.props.logEvent(mt.Iq,{target_id:i,index:e}),this.props.onChangeTab({pathToTabIndex:n})}this.setState((()=>({activeKey:n[e]})))}handleDeleteComponent(){const{deleteComponent:e,id:t,parentId:n}=this.props;e(t,n)}handleDeleteTab(e){this.state.tabIndex===e&&this.handleClickTab(Math.max(0,e-1))}handleDropOnTab(e){const{component:t}=this.props,{destination:n}=e;if(n){const e=n.id===t.id?n.index:t.children.indexOf(n.id);e>-1&&setTimeout((()=>{this.handleClickTab(e)}),30)}}handleDrop(e){e.dragging.type!==g.yR&&this.props.handleComponentDrop(e)}render(){const{depth:e,component:t,parentComponent:n,index:i,availableColumnCount:r,columnWidth:o,onResizeStart:s,onResize:l,onResizeStop:d,renderTabContent:c,renderHoverMenu:u,isComponentVisible:h,editMode:p,nativeFilters:m}=this.props,{children:g}=t,{tabIndex:f,activeKey:v}=this.state;let b;const y=(null==m?void 0:m.focusedFilterId)||(null==m?void 0:m.hoveredFilterId);var x;return y&&(b=null==(x=m.filters[y])?void 0:x.tabsInScope),(0,C.tZ)(Ee,{component:t,parentComponent:n,orientation:"row",index:i,depth:e,onDrop:this.handleDrop,editMode:p},(i=>{let{dropIndicatorProps:m,dragSourceRef:y}=i;return(0,C.tZ)(Al,{className:"dashboard-component dashboard-component-tabs"},p&&u&&(0,C.tZ)(ws,{innerRef:y,position:"left"},(0,C.tZ)(el,{position:"left"}),(0,C.tZ)(Ss,{onDelete:this.handleDeleteComponent})),(0,C.tZ)(w.cl,{id:t.id,activeKey:v,onChange:e=>{this.handleClickTab(g.indexOf(e))},onEdit:this.handleEdit,type:p?"editable-card":"card"},g.map(((n,i)=>{var u;return(0,C.tZ)(w.cl.TabPane,{key:n,tab:(0,C.tZ)(Wl,{id:n,parentId:t.id,depth:e,index:i,renderType:Tl,availableColumnCount:r,columnWidth:o,onDropOnTab:this.handleDropOnTab,onHoverTab:()=>this.handleClickTab(i),isFocused:v===n,isHighlighted:v!==n&&(null==(u=b)?void 0:a()(u).call(u,n))})},c&&(0,C.tZ)(Wl,{id:n,parentId:t.id,depth:e,index:i,renderType:Dl,availableColumnCount:r,columnWidth:o,onResizeStart:s,onResize:l,onResizeStop:d,onDropOnTab:this.handleDropOnTab,isComponentVisible:f===i&&h}))}))),m&&n.id!==H._4&&(0,C.tZ)("div",m))}))}}Ll.propTypes=Nl,Ll.defaultProps=ql;const jl=(0,r.$j)((function(e){return{nativeFilters:e.nativeFilters,activeTabs:e.dashboardState.activeTabs,directPathToChild:e.dashboardState.directPathToChild}}))(Ll),Vl={[g.dW]:e=>{let{id:t,parentId:n,component:i,parentComponent:o,index:l,depth:d,availableColumnCount:c,columnWidth:u,onResizeStart:h,onResize:p,onResizeStop:m,editMode:f,isComponentVisible:v,dashboardId:x,fullSizeChartId:S,getComponentById:Z=(()=>{}),deleteComponent:w,updateComponents:R,handleComponentDrop:k,setFullSizeChartId:T,isInView:D}=e;const{chartId:I}=i.meta,_=S===I,$=(e=>{var t;const n=(0,y.Fg)(),i=(0,r.v9)((e=>e.nativeFilters)),o=((e,t)=>{if(!e.focusedFilterField)return null;const{chartId:n,column:i}=e.focusedFilterField;return{chartId:n,scope:t[n].scopes[i]}})((0,r.v9)((e=>e.dashboardState)),(0,r.v9)((e=>e.dashboardFilters))),s=(null==i?void 0:i.focusedFilterId)||(null==i?void 0:i.hoveredFilterId);if(!o&&!s)return{};const l={borderColor:n.colors.primary.light2,opacity:1,boxShadow:`0px 0px ${2*n.gridUnit}px ${n.colors.primary.base}`,pointerEvents:"auto"};var d,c;if(s){if(null!=(d=i.filters[s])&&null!=(c=d.chartsInScope)&&a()(c).call(c,e))return l}else if(e===(null==o?void 0:o.chartId)||a()(t=(0,Yt.up)({filterScope:null==o?void 0:o.scope})).call(t,e))return l;return{opacity:.3,pointerEvents:"none"}})(I),F=(0,r.v9)((e=>e.dashboardState)),[M,E]=(0,s.useState)({}),[O,z]=(0,s.useState)(),[P,U]=(0,s.useState)(),[N,q]=(0,s.useState)(0),A=(0,s.useMemo)((()=>{var e;return null!=(e=null==F?void 0:F.directPathToChild)?e:[]}),[F]),L=(0,s.useMemo)((()=>{var e;return null!=(e=null==F?void 0:F.directPathLastUpdated)?e:0}),[F]),j=(0,s.useMemo)((()=>function(e){const t={};if(e.length>0){const n=e.slice();for(;n.length;){const e=n.pop(),i=e.split("-")[0];if(t[i.toLowerCase()]=e,!a()(H.Ep).call(H.Ep,i))break}}return t}(A)),[A]);(0,s.useEffect)((()=>{const{label:e,chart:t}=j;L!==N&&i.id===t&&(q(L),z(i.id),U(e))}),[i,N,L,j]),(0,s.useEffect)((()=>{let e;return O&&(e=setTimeout((()=>{z(void 0),U(void 0)}),2e3)),()=>{e&&clearTimeout(e)}}),[O]);const V=(0,s.useMemo)((()=>{var e,t,n;const r=null==(e=Z(null==(n=o.parents)?void 0:n.find((e=>e.startsWith(g.BA)))))||null==(t=e.meta)?void 0:t.width;let a=i.meta.width||H.cx;return o.type===g.BA?a=o.meta.width||H.cx:r&&a>r&&(a=r),a}),[i,Z,o.meta.width,o.parents,o.type]),{chartWidth:K,chartHeight:B}=(0,s.useMemo)((()=>{let e=0,t=0;return _?(e=window.innerWidth-32,t=window.innerHeight-32):(e=Math.floor(V*u+(V-1)*H.es-32),t=Math.floor(i.meta.height*H.cd-32)),{chartWidth:e,chartHeight:t}}),[u,i,_,V]),W=(0,s.useCallback)((()=>{w(t,n)}),[w,t,n]),Y=(0,s.useCallback)((e=>{R({[i.id]:{...i,meta:{...i.meta,sliceNameOverride:e}}})}),[i,R]),J=(0,s.useCallback)((()=>{T(_?null:I)}),[I,_,T]),G=(0,s.useCallback)(((e,t)=>{E((n=>({...n,[e]:t})))}),[]);return(0,C.tZ)(Ee,{component:i,parentComponent:o,orientation:o.type===g.Os?"column":"row",index:l,depth:d,onDrop:k,disableDragDrop:!1,editMode:f},(e=>{let{dropIndicatorProps:t,dragSourceRef:n}=e;return(0,C.tZ)(zs,{id:i.id,adjustableWidth:o.type===g.Os,adjustableHeight:!0,widthStep:u,widthMultiple:V,heightStep:H.cd,heightMultiple:i.meta.height,minWidthMultiple:H.cx,minHeightMultiple:H.AA,maxWidthMultiple:c+V,onResizeStart:h,onResize:p,onResizeStop:m,editMode:f},(0,C.tZ)("div",{ref:n,style:$,css:_?Ps:void 0,className:b()("dashboard-component","dashboard-component-chart-holder",`dashboard-chart-id-${I}`,O?"fade-in":"fade-out")},!f&&(0,C.tZ)(ii,{id:i.id,scrollIntoView:O===i.id}),!!O&&(0,C.tZ)("style",null,`label[for=${P}] + .Select .Select__control {\n                    border-color: #00736a;\n                    transition: border-color 1s ease-in-out;\n                  }`),(0,C.tZ)(xs,{componentId:i.id,id:i.meta.chartId,dashboardId:x,width:K,height:B,sliceName:i.meta.sliceNameOverride||i.meta.sliceName||"",updateSliceName:Y,isComponentVisible:v,handleToggleFullSize:J,isFullSize:_,setControlValue:G,extraControls:M,isInView:D}),f&&(0,C.tZ)(ws,{position:"top"},(0,C.tZ)("div",null,(0,C.tZ)(Ss,{onDelete:W})))),t&&(0,C.tZ)("div",t))}))},[g.xh]:Qs,[g.BA]:cl,[g.hE]:ml,[g.Nc]:yl,[g.Os]:Rl,[g.gn]:Ol,[g.yR]:jl,[g.t]:e=>{let{component:t,parentComponent:n,index:i,depth:o,handleComponentDrop:a,editMode:l,columnWidth:d,availableColumnCount:u,onResizeStart:h,onResizeStop:p,onResize:m,deleteComponent:f,parentId:v,updateComponents:y,id:x}=e;const S=n.type===g.BA?n.meta.width||H.cx:t.meta.width||H.cx,Z=()=>{f(x,v)},w=tl.Z.find((e=>e.value===(t.meta.background||H.HE))),{Component:R}=Ye.get(t.meta.componentKey),k=(0,r.v9)((e=>{let{nativeFilters:t,dataMask:n}=e;return{nativeFilters:t,dataMask:n}}));return(0,C.tZ)(Ee,{component:t,parentComponent:n,orientation:n.type===g.Os?"column":"row",index:i,depth:o,onDrop:a,editMode:l},(e=>{let{dropIndicatorProps:i,dragSourceRef:r}=e;return(0,C.tZ)(Bs,{menuItems:[(0,C.tZ)(ol,{id:`${t.id}-background`,value:t.meta.background,onChange:e=>{return"background",n=e,void y({[t.id]:{...t,meta:{...t.meta,background:n}}});var n}})],editMode:l},(0,C.tZ)("div",{className:b()("dashboard-component",`dashboard-${t.componentKey}`,null==w?void 0:w.className),id:t.id},(0,C.tZ)(zs,{id:t.id,adjustableWidth:n.type===g.Os,widthStep:d,widthMultiple:S,heightStep:H.cd,adjustableHeight:!1,heightMultiple:t.meta.height,minWidthMultiple:H.cx,minHeightMultiple:H.cx,maxWidthMultiple:u+S,onResizeStart:h,onResize:m,onResizeStop:p},(0,C.tZ)("div",{ref:r,className:"dashboard-component"},l&&(0,C.tZ)(ws,{position:"top"},(0,C.tZ)(Ss,{onDelete:Z})),(0,C.tZ)(s.Suspense,{fallback:(0,C.tZ)("div",null,(0,c.t)("Loading..."))},(0,C.tZ)(R,{dashboardData:k}))))),i&&(0,C.tZ)("div",i))}))}};var Kl=n(72673);const Bl={id:d().string,parentId:d().string,depth:d().number,index:d().number,renderHoverMenu:d().bool,renderTabContent:d().bool,onChangeTab:d().func,component:W.cP.isRequired,parentComponent:W.cP.isRequired,createComponent:d().func.isRequired,deleteComponent:d().func.isRequired,updateComponents:d().func.isRequired,handleComponentDrop:d().func.isRequired,logEvent:d().func.isRequired,directPathToChild:d().arrayOf(d().string),directPathLastUpdated:d().number,dashboardId:d().number.isRequired,isComponentVisible:d().bool};class Hl extends s.PureComponent{render(){const{component:e}=this.props,t=e?Vl[e.type]:null;return t?(0,C.tZ)(t,this.props):null}}Hl.propTypes=Bl,Hl.defaultProps={isComponentVisible:!0};const Wl=(0,r.$j)((function(e,t){let{dashboardLayout:n,dashboardState:i,dashboardInfo:r}=e;const o=n.present,{id:a,parentId:s}=t,l=o[a],d={component:l,getComponentById:e=>o[e],parentComponent:o[s],editMode:i.editMode,filters:(0,Yt.De)(),dashboardId:r.id,fullSizeChartId:i.fullSizeChartId};if(l){const e=l.type;if(e===g.Os||e===g.BA){const{occupiedWidth:t,minimumWidth:n}=(0,Kl.Z)({id:a,components:o});e===g.Os&&(d.occupiedColumnCount=t),e===g.BA&&(d.minColumnWidth=n)}}return d}),(function(e){return(0,i.DE)({addDangerToast:Kn.Gb,createComponent:Vn.LM,deleteComponent:Vn.v7,updateComponents:Vn.WZ,handleComponentDrop:Vn._p,setDirectPathToChild:jn.E2,setFullSizeChartId:jn.zL,setActiveTabs:jn.$_,logEvent:Bn.logEvent},e)}))(Hl);var Yl=n(52004),Jl=n(90057),Gl=n(8868),Ql=n(6954);const Xl=e=>Object.values(e).reduce(((e,t)=>({...e,[t.id]:t.extraFormData})),{}),ed=(e,t)=>{var n;const i=null==t?void 0:t.value;return(null==(n=e.controlValues)?void 0:n.enableEmptyFilter)&&null==i},td=Qi("filter-bar"),nd=()=>(0,r.v9)((e=>e.nativeFilters.filterSets||{})),id=()=>{const e=(0,r.v9)((e=>{var t;return null==(t=e.dashboardState)?void 0:t.preselectNativeFilters})),t=(0,r.v9)((e=>e.nativeFilters.filters));return(0,s.useMemo)((()=>Object.entries(t).reduce(((t,n)=>{let[i,r]=n;return{...t,[i]:{...r,preselect:null==e?void 0:e[i]}}}),{})),[t,e])},rd=()=>{const e=(0,r.v9)((e=>e.dataMask));return(0,s.useMemo)((()=>Object.values(e).filter((e=>String(e.id).startsWith(Lo.rW))).reduce(((e,t)=>({...e,[t.id]:t})),{})),[e])};var od=n(81788),ad=n(37731);const sd=e=>C.iv`
  display: flex;

  && > .filter-clear-all-button {
    color: ${e.colors.grayscale.base};
    margin-left: 0;
    &:hover {
      color: ${e.colors.primary.dark1};
    }

    &[disabled],
    &[disabled]:hover {
      color: ${e.colors.grayscale.light1};
    }
  }
`,ld=(e,t)=>C.iv`
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  position: fixed;
  z-index: 100;

  // filter bar width minus 1px for border
  width: ${t-1}px;
  bottom: 0;

  padding: ${4*e.gridUnit}px;
  padding-top: ${6*e.gridUnit}px;

  background: linear-gradient(
    ${(0,Z.rgba)(e.colors.grayscale.light5,0)},
    ${e.colors.grayscale.light5} ${e.opacity.mediumLight}
  );

  & > button {
    pointer-events: auto;
  }

  & > .filter-apply-button {
    margin-bottom: ${3*e.gridUnit}px;
  }
`,dd=e=>C.iv`
  align-items: center;
  margin-left: auto;
  && > .filter-clear-all-button {
    text-transform: capitalize;
    font-weight: ${e.typography.weights.normal};
  }
  & > .filter-apply-button {
    &[disabled],
    &[disabled]:hover {
      color: ${e.colors.grayscale.light1};
      background: ${e.colors.grayscale.light3};
    }
  }
`,cd=e=>{let{width:t=ys.I6,onApply:n,onClearAll:i,dataMaskApplied:r,dataMaskSelected:o,isApplyDisabled:a,filterBarOrientation:l=Yl.B.VERTICAL}=e;const d=(0,s.useMemo)((()=>Object.values(r).some((e=>{var t,n,i;return(0,ad.Z)(null==(t=o[e.id])||null==(n=t.filterState)?void 0:n.value)||!o[e.id]&&(0,ad.Z)(null==(i=e.filterState)?void 0:i.value)}))),[r,o]),u=l===Yl.B.VERTICAL;return(0,C.tZ)("div",{css:e=>[sd(e),u?ld(e,t):dd(e)]},(0,C.tZ)(K.Z,J()({disabled:a,buttonStyle:"primary",htmlType:"submit",className:"filter-apply-button",onClick:n},td("apply-button")),u?(0,c.t)("Apply filters"):(0,c.t)("Apply")),(0,C.tZ)(K.Z,J()({disabled:!d,buttonStyle:"link",buttonSize:"small",className:"filter-clear-all-button",onClick:i},td("clear-button")),(0,c.t)("Clear all")))};var ud,hd=n(90731),pd=(ud=function(e,t){return ud=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n])},ud(e,t)},function(e,t){function n(){this.constructor=e}ud(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n)}),md="html",gd="svg",fd=function(e,t){var n,i,r,o={};if(e===md)r=document.createElement("div");else{if(e!==gd)throw new Error('Invalid element type "'+e+'" for createPortalNode: must be "html" or "svg".');r=document.createElementNS("http://www.w3.org/2000/svg","g")}if(t&&"object"==typeof t)for(var a=0,s=Object.entries(t.attributes);a<s.length;a++){var l=s[a],d=l[0],c=l[1];r.setAttribute(d,c)}var u={element:r,elementType:e,setPortalProps:function(e){o=e},getInitialPortalProps:function(){return o},mount:function(t,r){if(r!==i){if(u.unmount(),t!==n&&!function(e,t){if(t===md)return e instanceof HTMLElement;if(t===gd)return e instanceof SVGElement;throw new Error('Unrecognized element type "'+t+'" for validateElementType.')}(t,e))throw new Error('Invalid element type for portal: "'+e+'" portalNodes must be used with '+e+" elements, but OutPortal is within <"+t.tagName+">.");t.replaceChild(u.element,r),n=t,i=r}},unmount:function(e){e&&e!==i||n&&i&&(n.replaceChild(i,u.element),n=void 0,i=void 0)}};return u},vd=function(e){function t(t){var n=e.call(this,t)||this;return n.addPropsChannel=function(){Object.assign(n.props.node,{setPortalProps:function(e){n.setState({nodeProps:e})}})},n.state={nodeProps:n.props.node.getInitialPortalProps()},n}return pd(t,e),t.prototype.componentDidMount=function(){this.addPropsChannel()},t.prototype.componentDidUpdate=function(){this.addPropsChannel()},t.prototype.render=function(){var e=this,t=this.props,n=t.children,i=t.node;return hd.createPortal(s.Children.map(n,(function(t){return s.isValidElement(t)?s.cloneElement(t,e.state.nodeProps):t})),i.element)},t}(s.PureComponent),bd=function(e){function t(t){var n=e.call(this,t)||this;return n.placeholderNode=s.createRef(),n.passPropsThroughPortal(),n}return pd(t,e),t.prototype.passPropsThroughPortal=function(){var e=Object.assign({},this.props,{node:void 0});this.props.node.setPortalProps(e)},t.prototype.componentDidMount=function(){var e=this.props.node;this.currentPortalNode=e;var t=this.placeholderNode.current,n=t.parentNode;e.mount(n,t),this.passPropsThroughPortal()},t.prototype.componentDidUpdate=function(){var e=this.props.node;this.currentPortalNode&&e!==this.currentPortalNode&&(this.currentPortalNode.unmount(this.placeholderNode.current),this.currentPortalNode.setPortalProps({}),this.currentPortalNode=e);var t=this.placeholderNode.current,n=t.parentNode;e.mount(n,t),this.passPropsThroughPortal()},t.prototype.componentWillUnmount=function(){var e=this.props.node;e.unmount(this.placeholderNode.current),e.setPortalProps({})},t.prototype.render=function(){return s.createElement("div",{ref:this.placeholderNode})},t}(s.PureComponent),yd=fd.bind(null,md),Cd=(fd.bind(null,gd),n(99612)),xd=n(82607);const Sd=(0,s.forwardRef)(((e,t)=>{let{items:n,onOverflowingStateChange:i,dropdownContent:r,dropdownRef:o,dropdownStyle:a={},dropdownTriggerCount:l,dropdownTriggerIcon:d,dropdownTriggerText:u=(0,c.t)("More"),dropdownTriggerTooltip:h=null,style:p}=e;const m=(0,y.Fg)(),{ref:g,width:f=0}=(0,Cd.NB)(),v=(0,Ao.D)(f)||0,{current:b}=g,[x,S]=(0,s.useState)([]),[Z,w]=(0,s.useState)(!1),[R,k]=s.useState(-1);let T=(0,s.useRef)(null);o&&(T=o);const[D,I]=(0,s.useState)(!1),_=e=>e.reduce(((e,t)=>{let[n,i]=e;return n.push({id:t.id,element:s.cloneElement(t.element,{key:t.id})}),i.push(t.id),[n,i]}),[[],[]]),[$,F]=(0,s.useMemo)((()=>_(n.slice(0,-1!==R?R:n.length))),[n,R]),[M,E]=(0,s.useMemo)((()=>-1!==R?_(n.slice(R)):[[],[]]),[n,R]);(0,s.useLayoutEffect)((()=>{const e=null==b?void 0:b.children.item(0);if(e){const{children:t}=e,i=Array.from(t);if(x.length!==n.length){if(i.length!==n.length)return void k(-1);S(i.map((e=>e.getBoundingClientRect().width)))}const r=i.findIndex((t=>t.getBoundingClientRect().right>e.getBoundingClientRect().right+1));let o=-1===r&&M.length>0?n.length-M.length:r;if(f>v){const e=null==b?void 0:b.children.item(1),t=(null==e?void 0:e.getBoundingClientRect().right)||0,r=((null==b?void 0:b.getBoundingClientRect().right)||0)-t;let a=0;for(let e=i.length;e<n.length&&(a+=x[e],a<=r);e+=1)o=e+1}k(o)}}),[b,n.length,x,M.length,v,f]),(0,s.useEffect)((()=>{i&&i({notOverflowed:F,overflowed:E})}),[F,i,E]);const O=-1!==R?n.length-R:0,z=(0,s.useMemo)((()=>r||O?(0,C.tZ)("div",{css:C.iv`
              display: flex;
              flex-direction: column;
              gap: ${4*m.gridUnit}px;
            `,style:a,ref:T},r?r(M):M.map((e=>e.element))):null),[r,O,m.gridUnit,a,M]);return(0,s.useLayoutEffect)((()=>{Z&&setTimeout((()=>{T.current&&I(T.current.scrollHeight>500)}),100)}),[Z]),(0,s.useImperativeHandle)(t,(()=>({...g.current,open:()=>w(!0)})),[g]),(0,s.useEffect)((()=>(document.onscroll=Z?()=>w(!1):null,()=>{document.onscroll=null})),[Z]),(0,C.tZ)("div",{ref:g,css:C.iv`
          display: flex;
          align-items: center;
        `},(0,C.tZ)("div",{css:C.iv`
            display: flex;
            align-items: center;
            gap: ${4*m.gridUnit}px;
            margin-right: ${4*m.gridUnit}px;
            min-width: 0px;
          `,style:p},$.map((e=>e.element))),z&&(0,C.tZ)(s.Fragment,null,(0,C.tZ)(C.xB,{styles:C.iv`
                .ant-popover-inner-content {
                  max-height: ${500}px;
                  overflow: ${D?"auto":"visible"};
                  padding: ${3*m.gridUnit}px ${4*m.gridUnit}px;

                  // Some OS versions only show the scroll when hovering.
                  // These settings will make the scroll always visible.
                  ::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                  }
                  ::-webkit-scrollbar-thumb {
                    border-radius: 9px;
                    background-color: ${m.colors.grayscale.light1};
                    border: 3px solid transparent;
                    background-clip: content-box;
                  }
                  ::-webkit-scrollbar-track {
                    background-color: ${m.colors.grayscale.light4};
                    border-left: 1px solid ${m.colors.grayscale.light2};
                  }
                }
              `}),(0,C.tZ)(Qn.ZP,{content:z,trigger:"click",visible:Z,onVisibleChange:e=>w(e),placement:"bottom",destroyTooltipOnHide:!0},(0,C.tZ)(Q.u,{title:h},(0,C.tZ)(K.Z,{buttonStyle:"secondary"},d,u,(0,C.tZ)(xd.Z,{count:null!=l?l:O,color:(null!=l?l:O)>0?m.colors.primary.base:m.colors.grayscale.light1,showZero:!0,css:C.iv`
                      margin-left: ${2*m.gridUnit}px;
                    `}),(0,C.tZ)(B.Z.DownOutlined,{iconSize:"m",iconColor:m.colors.grayscale.light1,css:C.iv`
                      .anticon {
                        display: flex;
                      }
                    `}))))))})),Zd=Sd,wd=e=>{let{filtersOutOfScope:t,renderer:n,hasTopMargin:i,horizontalOverflow:r}=e;return(0,C.tZ)(V.Ol,{ghost:!0,bordered:!0,expandIconPosition:"right",collapsible:0===t.length?"disabled":void 0,css:e=>r?(0,C.iv)("&.ant-collapse>.ant-collapse-item{&>.ant-collapse-header{padding:0;&>.ant-collapse-arrow{right:0;padding:0;}}& .ant-collapse-content-box{padding:",4*e.gridUnit,"px 0 0;margin-bottom:",-4*e.gridUnit,"px;}}",""):(0,C.iv)("&.ant-collapse{margin-top:",i?6*e.gridUnit:0,"px;&>.ant-collapse-item{&>.ant-collapse-header{padding-left:0;padding-bottom:",2*e.gridUnit,"px;&>.ant-collapse-arrow{right:",e.gridUnit,"px;}}& .ant-collapse-content-box{padding:",4*e.gridUnit,"px 0 0;}}}","")},(0,C.tZ)(V.Ol.Panel,{header:(0,c.t)("Filters out of scope (%d)",t.length),key:"1"},t.map(n)))};var Rd=n(63279),kd=n(28368),Td=n.n(kd);const Dd=T()(((e,t)=>{e(t?(0,wa.qN)(t):(0,wa.DU)())}),yt.oP),Id=T()(((e,t)=>{e(t?(0,wa.$7)(t):(0,wa.Up)())}),yt.oP),_d=y.iK.div`
  & > div {
    height: auto !important;
    min-height: ${32}px;
  }
`,$d=[{data:[{}]}],Fd=[yi.cg.NATIVE_FILTER],Md=e=>{var t,n,i;let{dataMaskSelected:o,filter:a,focusedFilterId:l,onFilterSelectionChange:d,inView:h=!0,showOverflow:m,parentRef:g,setFilterActive:f,orientation:v=Yl.B.VERTICAL,overflow:b=!1}=e;const{id:y,targets:x,filterType:S,adhoc_filters:Z,time_range:w}=a,R=(0,bi.Z)().get(S),k=function(e,t){const n=(0,r.v9)((t=>{var n;return null==(n=t.nativeFilters.filters[e])?void 0:n.cascadeParentIds}));return(0,s.useMemo)((()=>{let e={};return(0,zi.Z)(n).forEach((n=>{const i=null==t?void 0:t[n];e=(0,Nr.on)(e,null==i?void 0:i.extraFormData)})),e}),[t,n])}(y,o),T=(()=>{const e=(0,r.v9)((e=>e.dashboardState.isRefreshing)),t=(0,r.v9)((e=>e.dashboardState.isFiltersRefreshing));return!e&&t})(),[D,I]=(0,s.useState)([]),[_,$]=(0,s.useState)(""),[F,M]=(0,s.useState)({inView:!1}),[E,O]=(0,s.useState)({}),[z,P]=(0,s.useState)(h),U=(0,s.useRef)(null),[N]=x,{datasetId:q,column:A={}}=N,{name:L}=A,j=!!q,[V,K]=(0,s.useState)(j),[B,H]=(0,s.useState)(!1),W=(0,r.I0)(),Y=(0,s.useCallback)((()=>{H(!1),K(!1),T&&W((0,jn.YC)())}),[W,T]);(0,s.useEffect)((()=>{!z&&h&&P(!0)}),[h,z,P]),(0,s.useEffect)((()=>{var e;if(!z)return;const t=(0,Nr.zi)({...a,datasetId:q,dependencies:k,groupby:L,adhoc_filters:Z,time_range:w}),n=(null==(e=a.dataMask)?void 0:e.ownState)||{};if(!B&&(!Td()(F,t,((e,t,n)=>"url_params"===n||void 0))||!di()(E,n)||T)){if(M(t),O(n),!j)return;H(!0),(0,ai.getChartDataRequest)({formData:t,force:!1,requestParams:{dashboardId:0},ownState:n}).then((e=>{let{response:t,json:n}=e;if((0,pt.cr)(u.T.GLOBAL_ASYNC_QUERIES)){const e="result"in n?n.result[0]:n;if(200===t.status)I([e]),Y();else{if(202!==t.status)throw new Error(`Received unexpected response status (${t.status}) while fetching chart data`);(0,zr.YJ)(e).then((e=>{I(e),Y()})).catch((e=>{$(e.message||e.error||(0,c.t)("Check configuration")),Y()}))}}else I(n.result),$(""),Y()})).catch((e=>{$(e.statusText),Y()}))}}),[z,k,q,L,Y,JSON.stringify(a),j,B,T]),(0,s.useEffect)((()=>{l&&l===a.id&&setTimeout((()=>{var e;null==U||null==(e=U.current)||e.focus()}),yt.oP)}),[U,l,a.id]);const J=(0,s.useCallback)((e=>d(a,e)),[a,d]),G=(0,s.useCallback)((()=>Id(W,y)),[W,y]),Q=(0,s.useCallback)((()=>Id(W)),[W]),X=(0,s.useCallback)((()=>Dd(W,y)),[W,y]),ee=(0,s.useCallback)((()=>Dd(W)),[W]),te=(0,s.useMemo)((()=>({setDataMask:J,setHoveredFilter:X,unsetHoveredFilter:ee,setFocusedFilter:G,unsetFocusedFilter:Q,setFilterActive:f})),[J,f,X,ee,G,Q]),ne=ed(a,null==(t=a.dataMask)?void 0:t.filterState),ie=(0,s.useMemo)((()=>{var e;return{...null==(e=a.dataMask)?void 0:e.filterState,validateStatus:ne&&"error"}}),[null==(n=a.dataMask)?void 0:n.filterState,ne]),re=(0,s.useMemo)((()=>({filterBarOrientation:v,isOverflowingFilterBar:b})),[v,b]);return _?(0,C.tZ)(Mr,{title:(0,c.t)("Cannot load filter"),body:_,level:"error"}):(0,C.tZ)(_d,null,V?(0,C.tZ)(p.Z,{position:"inline-centered"}):(0,C.tZ)(Xr.Z,{height:32,width:"100%",showOverflow:m,formData:F,displaySettings:re,parentRef:g,inputRef:U,queriesData:j?D:$d,chartType:S,behaviors:Fd,filterState:ie,ownState:null==(i=a.dataMask)?void 0:i.ownState,enableNoResults:null==R?void 0:R.enableNoResults,isRefreshing:B,hooks:te}))},Ed=s.memo(Md),Od=e=>{var t,n;return(null==e||null==(t=e.meta)?void 0:t.text)||(null==e||null==(n=e.meta)?void 0:n.defaultText)||""},zd=e=>{var t,n;return(null==e||null==(t=e.meta)?void 0:t.sliceNameOverride)||(null==e||null==(n=e.meta)?void 0:n.sliceName)||(null==e?void 0:e.id)||""},Pd=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: flex;
    align-items: center;
    margin: ${t.gridUnit}px 0;
    font-size: ${t.typography.sizes.s}px;

    &:first-of-type {
      margin-top: 0;
    }

    &:last-of-type {
      margin-bottom: 0;
    }

    & .ant-tooltip-open {
      display: inline-flex;
    }
  `}};
`,Ud=y.iK.span`
  ${e=>{let{theme:t}=e;return C.iv`
    color: ${t.colors.grayscale.base};
    padding-right: ${4*t.gridUnit}px;
    margin-right: auto;
    text-transform: uppercase;
    white-space: nowrap;
  `}};
`,Nd=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    color: ${t.colors.grayscale.dark1};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline;
  `}};
`,qd=y.iK.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,Ad=y.iK.span`
  text-decoration: underline;
  cursor: pointer;
`,Ld=y.iK.span`
  ${e=>{let{theme:t}=e;return C.iv`
    color: ${t.colors.primary.base};
  `}}
`,jd=y.iK.ul`
  ${e=>{let{theme:t}=e;return C.iv`
    padding-left: ${3*t.gridUnit}px;
    margin-bottom: 0;
  `}};
`,Vd=y.iK.span`
  font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
`,Kd=y.iK.div`
  min-width: 0;
  display: inline-flex;
  white-space: nowrap;
`,Bd=y.iK.div`
  display: flex;
  align-items: center;
`,Hd=e=>{let{title:t,children:n,...i}=e;return(0,C.tZ)(Q.u,J()({title:t,placement:"bottom",overlayClassName:"filter-card-tooltip"},i),(0,C.tZ)(Kd,null,n))},Wd=(e,t)=>Array.isArray(e)&&e.length>0?(0,C.tZ)(s.Fragment,null,(0,C.tZ)(Vd,null,t,":"),(0,C.tZ)(jd,null,e.map((e=>(0,C.tZ)("li",null,e))))):null,Yd=s.memo((e=>{let{filter:t}=e;const n=(e=>{const t=(0,r.v9)((e=>e.dashboardLayout.present)),n=(()=>{const e=(0,r.v9)((e=>e.charts));return(0,s.useMemo)((()=>Object.values(e)),[e])})();return(0,s.useMemo)((()=>{var i;let r;const o=t[H._4].children[0];if(o.startsWith("TABS-")&&(r=t[o].children),0===e.scope.rootPath.length)return;if(0===e.scope.excluded.length&&(e.scope.rootPath[0]===H._4||null!=(i=r)&&i.every((t=>{var n;return a()(n=e.scope.rootPath).call(n,t)}))))return{all:[(0,c.t)("All charts")]};if(0===e.scope.excluded.length&&r)return{tabs:e.scope.rootPath.map((e=>Od(t[e]))).filter(Boolean)};const s=Object.values(t).filter((e=>e.type===g.dW));if(e.scope.rootPath[0]===H._4)return{charts:n.filter((t=>{var n;return!a()(n=e.scope.excluded).call(n,t.id)})).map((e=>{const t=s.find((t=>t.meta.chartId===e.id));return zd(t)})).filter(Boolean)};if(r){const i=[...e.scope.rootPath],r=s.filter((e=>e.parents.some((e=>a()(i).call(i,e)))));e.scope.excluded.forEach((e=>{const t=i.findIndex((t=>{var n,i;return null==(n=r.find((t=>t.meta.chartId===e)))?void 0:a()(i=n.parents).call(i,t)}));t>-1&&i.splice(t,1)}));const o=n.filter((t=>{var n;return!a()(n=e.scope.excluded).call(n,t.id)})).reduce(((e,t)=>{const n=r.find((e=>e.meta.chartId===t.id&&e.parents.every((e=>!a()(i).call(i,e)))));return n&&e.push(n),e}),[]);return{tabs:i.map((e=>Od(t[e]))).filter(Boolean),charts:o.map(zd).filter(Boolean)}}}),[n,e.scope.excluded,e.scope.rootPath,t])})(t),i=(0,s.useRef)(null),o=(0,s.useRef)(null),[l,d]=(0,Rd.ro)(i,o),u=(0,s.useMemo)((()=>0!==l&&n?n.all?(0,C.tZ)("span",null,(0,c.t)("All charts")):(0,C.tZ)("div",null,Wd(n.tabs,(0,c.t)("Tabs")),Wd(n.charts,(0,c.t)("Charts"))):null),[l,n]);return(0,C.tZ)(Pd,null,(0,C.tZ)(Ud,null,(0,c.t)("Scope")),(0,C.tZ)(Hd,{title:u},(0,C.tZ)(Nd,{ref:i},n?Object.values(n).flat().map(((e,t)=>(0,C.tZ)("span",{key:e},0===t?e:`, ${e}`))):(0,c.t)("None")),d>0&&(0,C.tZ)(Ld,{ref:o},"+",l)))})),Jd=e=>{let{dependency:t,hasSeparator:n}=e;const i=(0,r.I0)(),o=(0,s.useCallback)((()=>{i((0,wa.$7)(t.id))}),[t.id,i]);return(0,C.tZ)("span",null,n&&(0,C.tZ)("span",null,", "),(0,C.tZ)(Ad,{role:"button",onClick:o,tabIndex:0},t.name))},Gd=s.memo((e=>{let{filter:t}=e;const n=(e=>{const t=(0,zi.Z)(e.cascadeParentIds);return(0,r.v9)((e=>0===t.length?[]:t.reduce(((t,n)=>(t.push(e.nativeFilters.filters[n]),t)),[])))})(t),i=(0,s.useRef)(null),o=(0,s.useRef)(null),[a,l]=(0,Rd.ro)(i,o),d=(0,y.Fg)(),u=(0,s.useMemo)((()=>a>0&&n?(0,C.tZ)(jd,null,n.map((e=>(0,C.tZ)("li",null,(0,C.tZ)(Jd,{dependency:e}))))):null),[a,n]);return Array.isArray(n)&&0!==n.length?(0,C.tZ)(Pd,null,(0,C.tZ)(Ud,{css:C.iv`
          display: inline-flex;
          align-items: center;
        `},(0,c.t)("Dependent on")," ",(0,C.tZ)(Hd,{title:(0,c.t)("Filter only displays values relevant to selections made in other filters.")},(0,C.tZ)(B.Z.Info,{iconSize:"m",iconColor:d.colors.grayscale.light1,css:C.iv`
              margin-left: ${d.gridUnit}px;
            `}))),(0,C.tZ)(Hd,{title:u},(0,C.tZ)(Nd,{ref:i},n.map(((e,t)=>(0,C.tZ)(Jd,{key:e.id,dependency:e,hasSeparator:0!==t})))),l&&(0,C.tZ)(Ld,{ref:o},"+",a))):null})),Qd=(0,y.iK)(K.Z)`
  padding: 0;
`,Xd=e=>{let{createNewOnOpen:t,dashboardId:n,initialFilterId:i,onClick:o,children:a}=e;const l=(0,r.I0)(),[d,c]=(0,s.useState)(!1),u=(0,s.useCallback)((()=>{c(!1)}),[c]),h=(0,s.useCallback)((async e=>{l(await(0,wa.RY)(e)),u()}),[l,u]),p=(0,s.useCallback)((()=>{c(!0),o&&o()}),[c,o]);return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(Qd,J()({},td("create-filter"),{buttonStyle:"link",buttonSize:"xsmall",onClick:p}),a),(0,C.tZ)(ea,{isOpen:d,onSave:h,onCancel:u,initialFilterId:i,createNewOnOpen:t,key:`filters-for-${n}`}))},ec=s.memo(Xd),tc=e=>{let{filter:t,hidePopover:n}=e;const i=(0,y.Fg)(),o=(0,s.useRef)(null),[a]=(0,Rd.ro)(o),l=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.id})),d=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm}));return(0,C.tZ)(Pd,{css:e=>C.iv`
          margin-bottom: ${3*e.gridUnit}px;
          justify-content: space-between;
        `},(0,C.tZ)(Bd,null,(0,C.tZ)(B.Z.FilterSmall,{css:e=>C.iv`
              margin-right: ${e.gridUnit}px;
            `}),(0,C.tZ)(Hd,{title:a?t.name:null},(0,C.tZ)(qd,{ref:o},t.name))),d&&(0,C.tZ)(Xd,{dashboardId:l,onClick:n,initialFilterId:t.id},(0,C.tZ)(B.Z.Edit,{iconSize:"l",iconColor:i.colors.grayscale.light1})))},nc=e=>{let{filter:t}=e;const n=(0,s.useMemo)((()=>(0,bi.Z)().get(t.filterType)),[t.filterType]);return(0,C.tZ)(Pd,null,(0,C.tZ)(Ud,null,(0,c.t)("Filter type")),(0,C.tZ)(Nd,null,null==n?void 0:n.name))},ic=e=>{let{filter:t,hidePopover:n}=e;return(0,C.tZ)("div",null,(0,C.tZ)(tc,{filter:t,hidePopover:n}),(0,C.tZ)(nc,{filter:t}),(0,C.tZ)(Yd,{filter:t}),(0,C.tZ)(Gd,{filter:t}))},rc=e=>{let{children:t,filter:n,getPopupContainer:i,isVisible:r=!0,placement:o}=e;const[a,l]=(0,s.useState)(!1);return(0,s.useEffect)((()=>{r||l(!1)}),[r]),(0,C.tZ)(Qn.ZP,{placement:o,overlayClassName:"filter-card-popover",mouseEnterDelay:.2,mouseLeaveDelay:.2,onVisibleChange:e=>{l(r&&e)},visible:r&&a,content:(0,C.tZ)(ic,{filter:n,hidePopover:()=>{l(!1)}}),getPopupContainer:null!=i?i:()=>document.body},t)};var oc;!function(e){e.AllFilters="allFilters",e.FilterSets="filterSets"}(oc||(oc={}));const ac=(e,t)=>{const n=nd(),i=Object.values(n),r=(0,s.useMemo)((()=>!!i.find((t=>{let{name:n}=t;return n===e}))),[i,e]);return t!==e&&r},sc=y.iK.div`
  display: flex;
  & button {
    ${e=>{let{disabled:t}=e;return"pointer-events: "+(t?"none":"all")}};
    flex: 1;
  }
`,lc=y.iK.div`
  display: grid;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  grid-gap: 10px;
  grid-template-columns: 1fr 1fr;
`,dc=e=>{let{onCancel:t,editMode:n,onEdit:i,onCreate:r,disabled:o,filterSetName:a}=e;const l=ac(a),d=!a||l||o;return(0,C.tZ)(s.Fragment,null,n?(0,C.tZ)(lc,null,(0,C.tZ)(K.Z,{buttonStyle:"tertiary",buttonSize:"small",onClick:t},(0,c.t)("Cancel")),(0,C.tZ)(Q.u,{placement:"right",title:!a&&(0,c.t)("Please filter set name")||l&&(0,c.t)("Filter set with this name already exists")||o&&Ea},(0,C.tZ)(sc,{disabled:d},(0,C.tZ)(K.Z,J()({disabled:d,buttonStyle:"primary",htmlType:"submit",buttonSize:"small",onClick:r},td("create-filter-set-button")),(0,c.t)("Create"))))):(0,C.tZ)(Q.u,{placement:"bottom",title:o&&Ea},(0,C.tZ)(sc,{disabled:o},(0,C.tZ)(K.Z,J()({disabled:o,buttonStyle:"tertiary",buttonSize:"small",onClick:i},td("new-filter-set-button")),(0,c.t)("Create new filter set")))))},cc=y.iK.div`
  display: flex;
  align-items: center;
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
`,uc=(0,y.iK)(V.Ol)`
  &.ant-collapse-ghost > .ant-collapse-item {
    & > .ant-collapse-content > .ant-collapse-content-box {
      padding: 0;
      padding-top: 0;
      padding-bottom: 0;
      font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
    }
    & > .ant-collapse-header {
      padding: 0;
      display: flex;
      align-items: center;
      flex-direction: row-reverse;
      justify-content: flex-end;
      max-width: max-content;
      & .ant-collapse-arrow {
        position: static;
        padding-left: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
      }
  }
`,hc=y.iK.div`
  padding-top: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  padding-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`,pc=e=>{let{dataMask:t,filterSet:n}=e;const i=(0,y.Fg)(),r=id(),o=Object.values(r).filter(Xi.kI);let s=null!=o?o:[];return null!=n&&n.nativeFilters&&(s=Object.values(null==n?void 0:n.nativeFilters).filter(Xi.kI)),(0,C.tZ)(uc,{ghost:!0,expandIconPosition:"right",defaultActiveKey:n?void 0:["filters"],expandIcon:e=>{let{isActive:t}=e;const n=i.colors.grayscale.base,r=t?B.Z.CaretUpOutlined:B.Z.CaretDownOutlined;return(0,C.tZ)(r,{iconColor:n})}},(0,C.tZ)(V.Ol.Panel,J()({},td("collapse-filter-set-description"),{header:(0,C.tZ)(cc,null,(0,C.tZ)(V.ZT.Text,{type:"secondary"},(0,c.t)("Filters (%d)",s.length))),key:"filters"}),s.map((e=>{var i,o,s,l,d,u;let{id:h,name:p}=e;const m=n&&!(0,pi.JB)(null==(i=r[h])?void 0:i.controlValues,null==n||null==(o=n.nativeFilters)||null==(s=o[h])?void 0:s.controlValues,{ignoreUndefined:!0}),g=!a()(l=Object.keys(r)).call(l,h);return(0,C.tZ)(V._e,{title:g&&(0,c.t)("This filter doesn't exist in dashboard. It will not be applied.")||m&&(0,c.t)("Filter metadata changed in dashboard. It will not be applied."),placement:"bottomLeft",key:h},(0,C.tZ)(hc,null,(0,C.tZ)(V.ZT.Text,{strong:!0,delete:g,mark:m},p,": "),(0,C.tZ)(V.ZT.Text,{delete:g,mark:m},Oa(null==t||null==(d=t[h])||null==(u=d.filterState)?void 0:u.value)||(0,C.tZ)(V.ZT.Text,{type:"secondary"},(0,c.t)("None")))))}))))},mc=(0,y.iK)(K.Z)`
  padding: 0;
`,gc=y.iK.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`,fc=y.iK.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  & > *,
  & > button.superset-button {
    ${e=>{let{theme:t}=e;return`margin-left: ${2*t.gridUnit}px`}};
  }
`,vc=e=>{var t,n;let{editMode:i,setFilterSetName:r,onDelete:o,onEdit:a,filterSetName:l,dataMaskSelected:d,filterSet:u,isApplied:h,onRebuild:p}=e;const m=(0,y.Fg)(),g=(0,C.tZ)(bt.v,null,(0,C.tZ)(bt.v.Item,{onClick:a},(0,c.t)("Edit")),(0,C.tZ)(bt.v.Item,{onClick:p},(0,C.tZ)(Q.u,{placement:"right",title:(0,c.t)("Remove invalid filters")},(0,c.t)("Rebuild"))),(0,C.tZ)(bt.v.Item,{onClick:o,danger:!0},(0,c.t)("Delete")));return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(gc,null,(0,C.tZ)(V.ZT.Text,{strong:!0,editable:{editing:i,icon:(0,C.tZ)("span",null),onChange:r}},null!=(t=null==u?void 0:u.name)?t:l),(0,C.tZ)(fc,null,h&&(0,C.tZ)(B.Z.CheckOutlined,{iconSize:"m",iconColor:m.colors.success.base}),o&&(0,C.tZ)(V.Gj,{overlay:g,placement:"bottomRight",trigger:["click"]},(0,C.tZ)(mc,J()({onClick:e=>{e.stopPropagation(),e.preventDefault()}},td("filter-set-menu-button"),{buttonStyle:"link",buttonSize:"xsmall"}),(0,C.tZ)(B.Z.EllipsisOutlined,{iconSize:"m"}))))),(0,C.tZ)(pc,{filterSet:u,dataMask:null!=(n=null==u?void 0:u.dataMask)?n:d}))},bc=y.iK.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${e=>{let{theme:t}=e;return 27*t.gridUnit}}px;

  & button.superset-button {
    margin-left: 0;
  }
  & input {
    width: 100%;
  }
`,yc=y.iK.div`
  ${e=>{let{theme:t,"data-selected":n,onClick:i}=e;return`\n    display: grid;\n    align-items: center;\n    justify-content: center;\n    grid-template-columns: 1fr;\n    grid-gap: ${t.gridUnit}px;\n    border-bottom: 1px solid ${t.colors.grayscale.light2};\n    padding: ${2*t.gridUnit}px ${4*t.gridUnit}px;\n    cursor: ${i?"pointer":"auto"};\n    background: ${n?t.colors.primary.light5:"transparent"};\n  `}}
`,Cc=(0,c.t)("New filter set"),xc=e=>{let{dataMaskSelected:t,onEditFilterSet:n,disabled:i,onFilterSelectionChange:o,tab:a}=e;const l=(0,r.I0)(),[d,c]=(0,s.useState)(Cc),[u,h]=(0,s.useState)(!1),p=rd(),m=nd(),g=Object.values(m),f=id(),v=Object.values(f),[b,y]=(0,s.useState)(null);(0,s.useEffect)((()=>{var e;if(a===oc.AllFilters)return;if(!g.length)return void y(null);const n=za({dataMaskSelected:t,filterSetFilterValues:g});y(null!=(e=null==n?void 0:n.id)?e:null)}),[a,t,g]);const x=(e,t)=>{var n,i,r;return!v.find((t=>(null==t?void 0:t.id)===e))||!(0,pi.JB)(null==(n=f[e])?void 0:n.controlValues,null==t||null==(i=t.nativeFilters)||null==(r=i[e])?void 0:r.controlValues,{ignoreUndefined:!0})},S=(e,t)=>{var n;const i=null==t?void 0:t.target;if(i){var r;const e=i.closest(`[data-anchor=${td("filter-set-wrapper",!0)}]`);if(null!=e&&null!=(r=e.querySelector(".ant-collapse-header"))&&r.contains(i)||null!=i&&i.closest(".ant-dropdown"))return}if(y(e),!e)return;const a=m[e];(null!=(n=Object.values(null==a?void 0:a.dataMask))?n:[]).forEach((e=>{const{extraFormData:t,filterState:n,id:i}=e;x(i,a)||o({id:i},{extraFormData:t,filterState:n})}))};return(0,C.tZ)(bc,null,!b&&(0,C.tZ)(yc,null,(0,C.tZ)(vc,{dataMaskSelected:t,editMode:u,setFilterSetName:c,filterSetName:d}),(0,C.tZ)(dc,{filterSetName:d.trim(),disabled:i,onCancel:()=>{h(!1),c(Cc)},editMode:u,onEdit:()=>h(!0),onCreate:()=>{const e={name:d.trim(),nativeFilters:f,dataMask:Object.keys(f).reduce(((e,t)=>({...e,[t]:p[t]})),{})};l((0,wa.xQ)(e)),h(!1),c(Cc)}})),g.map((e=>(0,C.tZ)(yc,J()({},td("filter-set-wrapper"),{"data-anchor":td("filter-set-wrapper",!0),"data-selected":e.id===b,onClick:t=>S(e.id,t),key:e.id}),(0,C.tZ)(vc,{isApplied:e.id===b&&!i,onDelete:()=>{return t=e.id,l((0,wa.$l)(t)),void(t===b&&y(null));var t},onEdit:()=>{return t=e.id,S(t),void n(t);var t},onRebuild:()=>(e=>{var t;const n=m[e],i=Object.values(null!=(t=null==n?void 0:n.dataMask)?t:{}).filter((e=>{const{id:t}=e;return!x(t,n)})).reduce(((e,t)=>({...e,[t.id]:f[t.id]})),{}),r={...n,nativeFilters:i,dataMask:Object.keys(i).reduce(((e,t)=>{var i;return{...e,[t]:null==(i=n.dataMask)?void 0:i[t]}}),{})};l((0,wa.ql)(r))})(e.id),dataMaskSelected:t,filterSet:e})))))},Sc=y.iK.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  justify-content: flex-start;
  grid-gap: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  background: ${e=>{let{theme:t}=e;return t.colors.primary.light4}};
  padding: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
`,Zc=(0,y.iK)(V.ZT.Text)`
  color: ${e=>{let{theme:t}=e;return t.colors.primary.dark2}};
`,wc=(0,y.iK)(V.ZT.Text)`
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  & .anticon {
    padding: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,Rc=y.iK.div`
  display: flex;
  & button {
    ${e=>{let{disabled:t}=e;return"pointer-events: "+(t?"none":"all")}};
    flex: 1;
  }
`,kc=e=>{let{filterSetId:t,onCancel:n,dataMaskSelected:i,disabled:o}=e;const a=rd(),l=(0,r.I0)(),d=nd(),u=id(),h=Object.values(d),[p,m]=(0,s.useState)(d[t].name),g=ac(p,d[t].name),f=(0,s.useMemo)((()=>za({dataMaskSelected:i,filterSetFilterValues:h})),[i,h]),v=f&&f.id!==t,b=o||v||g;return(0,C.tZ)(Sc,null,(0,C.tZ)(Zc,{strong:!0},(0,c.t)("Editing filter set:")),(0,C.tZ)(Zc,{editable:{editing:!0,icon:(0,C.tZ)("span",null),onChange:m}},p),(0,C.tZ)(lc,null,(0,C.tZ)(K.Z,{ghost:!0,buttonStyle:"tertiary",buttonSize:"small",onClick:n},(0,c.t)("Cancel")),(0,C.tZ)(V._e,{placement:"right",title:g&&(0,c.t)("Filter set with this name already exists")||v&&(0,c.t)("Filter set already exists")||o&&Ea},(0,C.tZ)(Rc,{disabled:b},(0,C.tZ)(K.Z,J()({disabled:b,buttonStyle:"primary",htmlType:"submit",buttonSize:"small",onClick:()=>{l((0,wa.ql)({id:t,name:p,nativeFilters:u,dataMask:{...a}})),n()}},td("filter-set-edit-save")),(0,c.t)("Save"))))),v&&(0,C.tZ)(wc,{mark:!0},(0,C.tZ)(B.Z.WarningOutlined,{iconSize:"m"}),(0,c.t)('This filter set is identical to: "%s"',null==f?void 0:f.name)))};var Tc=n(21804),Dc=n.n(Tc);const Ic=y.iK.div`
  .ant-btn-group {
    button.ant-btn {
      background-color: ${e=>{let{theme:t}=e;return t.colors.primary.dark1}};
      border-color: transparent;
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
      font-size: 12px;
      line-height: 13px;
      outline: none;
      text-transform: uppercase;
      &:first-of-type {
        border-radius: ${e=>{let{theme:t}=e;return`${t.gridUnit}px 0 0 ${t.gridUnit}px`}};
        margin: 0;
        width: 120px;
      }

      &:disabled {
        background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
        color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
      }
      &:nth-child(2) {
        margin: 0;
        border-radius: ${e=>{let{theme:t}=e;return`0 ${t.gridUnit}px ${t.gridUnit}px 0`}};
        width: ${e=>{let{theme:t}=e;return 9*t.gridUnit}}px;
        &:before,
        &:hover:before {
          border-left: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
          content: '';
          display: block;
          height: ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px;
          margin: 0;
          position: absolute;
          width: ${e=>{let{theme:t}=e;return.25*t.gridUnit}}px;
        }

        &:disabled:before {
          border-left: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
        }
      }
    }
  }
`,{SubMenu:_c}=bt.v,$c=(0,y.iK)((e=>{let{overlay:t,tooltip:n,placement:i,...r}=e;const o=function(e){return void 0===e&&(e={}),(0,C.tZ)(Ic,null,(0,C.tZ)(V.Gj.Button,J()({overlay:t},r,e)))};return n?o({buttonsRender:e=>{let[t,r]=e;return[(0,C.tZ)(V._e,{placement:i,id:`${Dc()(n)}-tooltip`,title:n},t),r]}}):o()}))`
  button.ant-btn:first-of-type {
    display: none;
  }
  > button.ant-btn:nth-child(2) {
    display: inline-flex;
    background-color: transparent !important;
    height: unset;
    padding: 0;
    border: none;
    width: auto !important;

    .anticon {
      line-height: 0;
    }
    &:after {
      box-shadow: none !important;
    }
  }
`,Fc=(0,y.iK)(bt.v)`
  ${e=>{let{theme:t}=e;return`\n    .info {\n      font-size: ${t.typography.sizes.s}px;\n      color: ${t.colors.grayscale.base};\n      padding: ${t.gridUnit}px ${3*t.gridUnit}px ${t.gridUnit}px ${3*t.gridUnit}px;\n    }\n    .ant-dropdown-menu-item-selected {\n      color: ${t.colors.grayscale.dark1};\n      background-color: ${t.colors.primary.light5};\n    }\n  `}}
`,Mc=(0,y.iK)(bt.v.Item)`
  display: flex;
  justify-content: space-between;
  > span {
    width: 100%;
  }
  border-bottom: ${e=>{let{divider:t,theme:n}=e;return t?`1px solid ${n.colors.grayscale.light3};`:"none;"}};
`,Ec=y.iK.div`
  display: flex;
  justify-content: space-between;
  > span {
    width: 100%;
  }
`,Oc=e=>{const t=(0,y.Fg)(),{icon:n,info:i,menuItems:r,selectedKeys:o,onSelect:l}=e,d=(e,n,i)=>(0,C.tZ)(Mc,{key:n,divider:i},(0,C.tZ)(Ec,null,(0,C.tZ)("span",null,e),(null==o?void 0:a()(o).call(o,n))&&(0,C.tZ)(B.Z.Check,{iconColor:t.colors.primary.base,className:"tick-menu-item",iconSize:"xl"}))),c=(0,s.useMemo)((()=>(0,C.tZ)(Fc,{selectedKeys:o,onSelect:l,selectable:!0},i&&(0,C.tZ)("div",{className:"info"},i),r.map((e=>{var t;return null!=(t=e.children)&&t.length?(0,C.tZ)(_c,{title:e.label,key:e.key},e.children.map((e=>d(e.label,e.key)))):d(e.label,e.key,e.divider)})))),[i,r]);return(0,C.tZ)($c,{overlay:c,trigger:["click"],icon:n})},zc=y.iK.span`
  display: flex;
  align-items: center;
  justify-content: space-between;

  .enable-cross-filters-text {
    padding-left: ${e=>{let{theme:t}=e;return 2*t.gridUnit+"px"}};
  }
`,Pc=(0,y.iK)(Nt.ZP)`
  ${e=>{let{theme:t}=e;return`\n  &,\n  svg {\n    display: inline-block;\n    width: ${4*t.gridUnit}px;\n    height: ${4*t.gridUnit}px;\n  }\n`}}
`,Uc=()=>{const e=(0,r.I0)(),t=(0,y.Fg)(),n=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.crossFiltersEnabled})),i=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.filterBarOrientation})),[o,a]=(0,s.useState)(i),l=(0,u.c)(u.T.DASHBOARD_CROSS_FILTERS),d=!!n&&l,[h,p]=(0,s.useState)(d),m=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm})),g=m&&(0,u.c)(u.T.HORIZONTAL_FILTER_BAR),f="cross-filters-menu-key",v=(0,s.useCallback)((async t=>{t||e((0,lt.sh)()),await e((0,Ln.C6)(t))}),[e,h]),b=(0,s.useCallback)((async t=>{const n=t.key;if(n===f)return p(!h),void v(!h);if(((r=n)===Yl.B.VERTICAL||r===Yl.B.HORIZONTAL)&&n!==i){a(n);try{await e((0,Ln.Mn)(t.key))}catch{a(i)}}var r}),[e,h,i]),x=(0,s.useMemo)((()=>(0,C.tZ)(zc,null,(0,C.tZ)(Pc,{className:"enable-cross-filters",checked:h,onChange:e=>p(e||!1)})," ",(0,C.tZ)("span",{className:"enable-cross-filters-text"},(0,c.t)("Enable cross-filtering")))),[h]),S=[];return l&&S.unshift({key:f,label:x,divider:g}),g&&S.push({key:"placement",label:(0,c.t)("Orientation of filter bar"),children:[{key:Yl.B.VERTICAL,label:(0,c.t)("Vertical (Left)")},{key:Yl.B.HORIZONTAL,label:(0,c.t)("Horizontal (Top)")}]}),S.length?(0,C.tZ)(Oc,{onSelect:b,icon:(0,C.tZ)(B.Z.Gear,{name:"gear",iconColor:t.colors.grayscale.base}),menuItems:S,selectedKeys:[o]}):null},Nc=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    margin: 0;
    padding: 0 ${2*t.gridUnit}px ${2*t.gridUnit}px;

    & > span {
      font-size: ${t.typography.sizes.l}px;
      flex-grow: 1;
      font-weight: ${t.typography.weights.bold};
    }

    & > div:first-of-type {
      line-height: 0;
    }

    & > button > span.anticon {
      line-height: 0;
    }
  `}}
`,qc=(0,y.iK)(K.Z)`
  padding: 0;
`,Ac=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    padding: ${3*t.gridUnit}px ${2*t.gridUnit}px ${t.gridUnit}px;\n\n    .ant-dropdown-trigger span {\n      padding-right: ${2*t.gridUnit}px;\n    }\n  `}}
`,Lc=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    margin-top: ${2*t.gridUnit}px;

    & button > [role='img']:first-of-type {
      margin-right: ${t.gridUnit}px;
      line-height: 0;
    }

    span[role='img'] {
      padding-bottom: 1px;
    }

    .ant-btn > .anticon + span {
      margin-left: 0;
    }
  `}}
`,jc=e=>{let{toggleFiltersBar:t}=e;const n=(0,y.Fg)(),i=id(),o=(0,s.useMemo)((()=>Object.values(i)),[i]),a=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm})),l=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.id}));return(0,C.tZ)(Ac,null,(0,C.tZ)(Nc,null,(0,C.tZ)("span",null,(0,c.t)("Filters")),(0,C.tZ)(Uc,null),(0,C.tZ)(qc,J()({},td("collapse-button"),{buttonStyle:"link",buttonSize:"xsmall",onClick:()=>t(!1)}),(0,C.tZ)(B.Z.Expand,{iconColor:n.colors.grayscale.base}))),a&&(0,C.tZ)(Lc,null,(0,C.tZ)(ec,{dashboardId:l,createNewOnOpen:0===o.length},(0,C.tZ)(B.Z.PlusSmall,null)," ",(0,c.t)("Add/Edit Filters"))))},Vc=s.memo(jc),Kc=y.iK.div`
  width: ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${e=>{let{width:t}=e;return t}}px; // arbitrary...
  }
`,Bc=y.iK.div`
  ${e=>{let{theme:t,width:n}=e;return`\n    & .ant-typography-edit-content {\n      left: 0;\n      margin-top: 0;\n      width: 100%;\n    }\n    position: absolute;\n    top: 0;\n    left: 0;\n    flex-direction: column;\n    flex-grow: 1;\n    width: ${n}px;\n    background: ${t.colors.grayscale.light5};\n    border-right: 1px solid ${t.colors.grayscale.light2};\n    border-bottom: 1px solid ${t.colors.grayscale.light2};\n    min-height: 100%;\n    display: none;\n    &.open {\n      display: flex;\n    }\n  `}}
`,Hc=y.iK.div`
  ${e=>{let{theme:t,offset:n}=e;return`\n    position: absolute;\n    top: ${n}px;\n    left: 0;\n    height: 100%;\n    width: ${8*t.gridUnit}px;\n    padding-top: ${2*t.gridUnit}px;\n    display: none;\n    text-align: center;\n    &.open {\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      padding: ${2*t.gridUnit}px;\n    }\n    svg {\n      cursor: pointer;\n    }\n  `}}
`,Wc=(0,y.iK)(B.Z.Collapse)`
  ${e=>{let{theme:t}=e;return`\n    color: ${t.colors.primary.base};\n    margin-bottom: ${3*t.gridUnit}px;\n  `}}
`,Yc=(0,y.iK)(B.Z.Filter)`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
`,Jc=(0,y.iK)(V.D6)`
  & .ant-tabs-nav-list {
    width: 100%;
  }
  & .ant-tabs-tab {
    display: flex;
    justify-content: center;
    margin: 0;
    flex: 1;
  }

  & > .ant-tabs-nav .ant-tabs-nav-operations {
    display: none;
  }
`,Gc=y.iK.div`
  margin-top: ${e=>{let{theme:t}=e;return 8*t.gridUnit}}px;
`,Qc=y.iK.div`
  padding: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${e=>{let{theme:t}=e;return 27*t.gridUnit}}px;
`,Xc=(0,s.createContext)(!1),eu=e=>{let{actions:t,canEdit:n,dataMaskSelected:i,focusedFilterId:r,filtersOpen:o,filterValues:a,height:l,isDisabled:d,isInitialized:h,offset:m,onSelectionChange:g,toggleFiltersBar:f,width:v}=e;const[y,x]=(0,s.useState)(null),S=nd(),Z=Object.values(S),[w,R]=(0,s.useState)(oc.AllFilters),k=a.filter(Xi.kI),[T,D]=(0,s.useState)(!1),I=(0,s.useRef)(),_=(0,s.useCallback)((()=>f(!0)),[f]),$=(0,s.useMemo)((()=>he()((()=>{clearTimeout(I.current),D(!0),I.current=setTimeout((()=>{D(!1)}),300)}),200)),[]);(0,s.useEffect)((()=>(document.onscroll=$,()=>{document.onscroll=null})),[$]);const F=(0,s.useMemo)((()=>({overflow:"auto",height:l,overscrollBehavior:"contain"})),[l]),M=k.length;return(0,C.tZ)(Xc.Provider,{value:T},(0,C.tZ)(Kc,J()({},td(),{className:b()({open:o}),width:v}),(0,C.tZ)(Hc,J()({},td("collapsable"),{className:b()({open:!o}),onClick:_,offset:m}),(0,C.tZ)(Wc,J()({},td("expand-button"),{iconSize:"l"})),(0,C.tZ)(Yc,J()({},td("filter-icon"),{iconSize:"l"}))),(0,C.tZ)(Bc,{className:b()({open:o}),width:v},(0,C.tZ)(Vc,{toggleFiltersBar:f}),h?(0,pt.cr)(u.T.DASHBOARD_NATIVE_FILTERS_SET)?(0,C.tZ)(Jc,{centered:!0,onChange:R,defaultActiveKey:oc.AllFilters,activeKey:y?oc.AllFilters:void 0},(0,C.tZ)(V.D6.TabPane,{tab:(0,c.t)("All filters (%(filterCount)d)",{filterCount:M}),key:oc.AllFilters,css:F},y&&(0,C.tZ)(kc,{dataMaskSelected:i,disabled:!d,onCancel:()=>x(null),filterSetId:y}),0===a.length?(0,C.tZ)(Gc,null,(0,C.tZ)(kl.Tc,{title:(0,c.t)("No filters are currently added"),image:"filter.svg",description:n&&(0,c.t)("Click the button above to add a filter to the dashboard")})):(0,C.tZ)(Qc,null,(0,C.tZ)(Tu,{dataMaskSelected:i,focusedFilterId:r,onFilterSelectionChange:g}))),(0,C.tZ)(V.D6.TabPane,{disabled:!!y,tab:(0,c.t)("Filter sets (%(filterSetCount)d)",{filterSetCount:Z.length}),key:oc.FilterSets,css:F},(0,C.tZ)(xc,{onEditFilterSet:x,disabled:!d,dataMaskSelected:i,tab:w,onFilterSelectionChange:g}))):(0,C.tZ)("div",{css:F,onScroll:$},0===a.length?(0,C.tZ)(Gc,null,(0,C.tZ)(kl.Tc,{title:(0,c.t)("No filters are currently added"),image:"filter.svg",description:n&&(0,c.t)("Click the button above to add a filter to the dashboard")})):(0,C.tZ)(Qc,null,(0,C.tZ)(Tu,{dataMaskSelected:i,focusedFilterId:r,onFilterSelectionChange:g}))):(0,C.tZ)("div",{css:(0,C.iv)({height:l},"","")},(0,C.tZ)(p.Z,null)),t)))},tu=s.memo(eu);var nu;!function(e){e.Right="right",e.Bottom="bottom",e.Left="left"}(nu||(nu={}));const iu=y.iK.div`
  position: absolute;
  right: 0;
`,ru=y.iK.h4`
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.dark1}};
  margin: 0;
  overflow-wrap: break-word;
`,ou=(0,y.iK)(ru)`
  font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.normal}};
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  max-width: ${e=>{let{theme:t}=e;return 15*t.gridUnit}}px;
  ${Rd.B3};
`,au=(0,y.iK)(ou)`
  max-width: none;
`,su=y.iK.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`,lu=(0,y.iK)(su)`
  margin-bottom: unset;
`,du=(0,y.iK)(su)`
  width: 100%;
`,cu=(0,y.iK)(Ft.l0)`
  width: 100%;
  && .ant-form-item-label > label {
    text-transform: none;
    width: 100%;
    padding-right: ${e=>{let{theme:t}=e;return 11*t.gridUnit}}px;
  }
  .ant-form-item-tooltip {
    margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,uu=(0,y.iK)(Ft.l0)`
  && .ant-form-item-label > label {
    margin-bottom: 0;
    text-transform: none;
  }
  .ant-form-item-tooltip {
    margin-bottom: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
  }
`,hu=(0,y.iK)(cu)`
  && .ant-form-item-label {
    line-height: 1;
    & > label {
      padding-right: unset;
    }
  }
`,pu=(0,y.iK)(Ft.xJ)`
  .ant-form-item-label {
    label.ant-form-item-required:not(.ant-form-item-required-mark-optional) {
      &::after {
        display: none;
      }
    }
  }
`,mu=(0,y.iK)(Ft.xJ)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    padding-bottom: 0;
    margin-right: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    label.ant-form-item-required:not(.ant-form-item-required-mark-optional) {
      &::after {
        display: none;
      }
    }

    & > label::after {
      display: none;
    }
  }

  .ant-form-item-control {
    width: ${e=>{let{theme:t}=e;return 41*t.gridUnit}}px;
  }
`,gu=pu,fu=y.iK.div`
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.m}}px;
  display: flex;
`,vu=()=>(0,C.tZ)("span",{css:e=>({color:e.colors.error.base,fontSize:`${e.typography.sizes.s}px`,paddingLeft:"1px"})},"*"),bu=e=>{let{description:t}=e;return(0,C.tZ)(fu,null,(0,C.tZ)(Q.u,{title:t,placement:"right",overlayInnerStyle:{display:"-webkit-box",overflow:"hidden",WebkitLineClamp:20,WebkitBoxOrient:"vertical",textOverflow:"ellipsis"}},(0,C.tZ)("i",{className:"fa fa-info-circle text-muted",css:e=>({paddingLeft:`${e.gridUnit}px`,cursor:"pointer"})})))},yu=e=>{var t,n,i;let{dataMaskSelected:r,filter:o,icon:a,onFilterSelectionChange:l,focusedFilterId:d,inView:c,showOverflow:u,parentRef:h,orientation:p=Yl.B.VERTICAL,overflow:m=!1}=e;const g=(0,s.useMemo)((()=>yd()),[]),[f,v]=(0,s.useState)(!1),{name:b="<undefined>"}=o,y=ed(o,null==(t=o.dataMask)?void 0:t.filterState),x=!(null==(n=o.controlValues)||!n.enableEmptyFilter),{FilterControlContainer:S,FormItem:Z,FilterControlTitleBox:w,FilterControlTitle:R}=((e,t)=>(0,s.useMemo)((()=>e===Yl.B.HORIZONTAL?t?{FilterControlContainer:hu,FormItem:gu,FilterControlTitleBox:du,FilterControlTitle:au}:{FilterControlContainer:uu,FormItem:mu,FilterControlTitleBox:lu,FilterControlTitle:ou}:{FilterControlContainer:cu,FormItem:pu,FilterControlTitleBox:su,FilterControlTitle:ru}),[e,t]))(p,m),k=(0,s.useMemo)((()=>{var e;return(0,C.tZ)(w,null,(0,C.tZ)(R,null,b),x&&(0,C.tZ)(vu,null),(null==(e=o.description)?void 0:e.trim())&&(0,C.tZ)(bu,{description:o.description}),(0,C.tZ)(iu,null,a))}),[w,R,b,x,o.description,a]),T=(0,s.useContext)(Xc),D=(0,s.useMemo)((()=>p===Yl.B.HORIZONTAL?m?nu.Left:nu.Bottom:nu.Right),[p,m]);return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(vd,{node:g},(0,C.tZ)(Ed,{dataMaskSelected:r,filter:o,showOverflow:u,focusedFilterId:d,onFilterSelectionChange:l,inView:c,parentRef:h,setFilterActive:v,orientation:p,overflow:m})),(0,C.tZ)(S,{layout:p!==Yl.B.HORIZONTAL||m?"vertical":"horizontal"},(0,C.tZ)(rc,{filter:o,isVisible:!f&&!T,placement:D},(0,C.tZ)("div",null,(0,C.tZ)(Z,{label:k,required:null==o||null==(i=o.controlValues)?void 0:i.enableEmptyFilter,validateStatus:y?"error":void 0},(0,C.tZ)(bd,{node:g}))))))},Cu=s.memo(yu),xu=e=>{let{title:t,description:n}=e;return(0,C.tZ)("div",null,(0,C.tZ)("h3",null,t),n?(0,C.tZ)("p",null,n):null)},Su=e=>{let{title:t,description:n}=e;const i=(0,y.Fg)(),[r,o]=(0,Rd.cB)();return(0,C.tZ)("div",{css:C.iv`
        display: flex;
        align-items: center;
        height: ${6*i.gridUnit}px;
        border-left: 1px solid ${i.colors.grayscale.light2};
        padding-left: ${4*i.gridUnit}px;

        .filter-item-wrapper:first-child & {
          border-left: none;
          padding-left: 0;
        }
      `},(0,C.tZ)(Q.u,{overlay:o?t:null},(0,C.tZ)("h3",{ref:r,css:C.iv`
            ${Rd.B3};
            max-width: ${32.5*i.gridUnit}px;
            font-size: ${i.typography.sizes.m}px;
            font-weight: ${i.typography.weights.normal};
            margin: 0;
            color: ${i.colors.grayscale.dark1};
          `},t)),n?(0,C.tZ)(Q.u,{overlay:n},(0,C.tZ)(B.Z.BookOutlined,{iconSize:"l",iconColor:i.colors.grayscale.base,css:C.iv`
              margin: 0 ${1.5*i.gridUnit}px;
              vertical-align: unset;
              line-height: unset;
            `})):null)},Zu=e=>{let{title:t,description:n}=e;const i=(0,y.Fg)(),[r,o]=(0,Rd.cB)(),[a,s]=(0,Rd.cB)();return(0,C.tZ)("div",{css:C.iv`
        border-top: 1px solid ${i.colors.grayscale.light2};
        padding-top: ${4*i.gridUnit}px;
        margin-bottom: ${4*i.gridUnit}px;
      `},(0,C.tZ)(Q.u,{overlay:o?(0,C.tZ)("strong",null,t):null},(0,C.tZ)("h3",{ref:r,css:C.iv`
            ${Rd.B3};
            display: block;
            color: ${i.colors.grayscale.dark1};
            font-weight: ${i.typography.weights.normal};
            font-size: ${i.typography.sizes.m}px;
            margin: 0 0 ${i.gridUnit}px 0;
          `},t)),n?(0,C.tZ)(Q.u,{overlay:s?n:null},(0,C.tZ)("p",{ref:a,css:C.iv`
              ${Rd.B3};
              display: block;
              font-size: ${i.typography.sizes.s}px;
              color: ${i.colors.grayscale.base};
              margin: ${i.gridUnit}px 0 0 0;
            `},n)):null)},wu=e=>{let{title:t,description:n,orientation:i=Yl.B.VERTICAL,overflow:r=!1}=e;return i===Yl.B.HORIZONTAL?r?(0,C.tZ)(Zu,{title:t,description:n}):(0,C.tZ)(Su,{title:t,description:n}):(0,C.tZ)(xu,{title:t,description:n})},Ru=e=>{let{filtersInScope:t,filtersOutOfScope:n,renderer:i,showCollapsePanel:r}=e;return(0,C.tZ)("div",{css:e=>C.iv`
        width: ${56*e.gridUnit}px;
        padding: ${e.gridUnit}px 0;
      `},t.map(i),r&&(0,C.tZ)(wd,{filtersOutOfScope:n,renderer:i,horizontalOverflow:!0}))},ku=e=>{let{focusedFilterId:t,dataMaskSelected:n,onFilterSelectionChange:i}=e;const o=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return(0,u.c)(u.T.HORIZONTAL_FILTER_BAR)?t.filterBarOrientation:Yl.B.VERTICAL})),[l,d]=(0,s.useState)([]),h=(0,s.useRef)(null),{filterControlFactory:p,filtersWithValues:m}=((e,t,n)=>{const i=id(),r=(0,s.useMemo)((()=>Object.values(i)),[i]),o=(0,s.useMemo)((()=>r.map((t=>({...t,dataMask:e[t.id]})))),[r,e]);return{filterControlFactory:(0,s.useCallback)(((i,r,a)=>{const s=o[i];return(0,Xi.nY)(s)?(0,C.tZ)(wu,{title:s.title,description:s.description,orientation:r,overflow:a}):(0,C.tZ)(Cu,{dataMaskSelected:e,filter:s,focusedFilterId:t,onFilterSelectionChange:n,inView:!1,orientation:r,overflow:a})}),[o,e,t,n]),filtersWithValues:o}})(n,t,i),f=(0,s.useMemo)((()=>{const e=new Array(m.length);for(let t=0;t<m.length;t+=1)e[t]=yd();return e}),[m.length]),v=new Set(m.map((e=>e.id))),[b,y]=function(e){const t=ir(),n=function(){const e=(0,r.v9)((e=>{var t;return null==(t=e.dashboardState)?void 0:t.activeTabs})),t=function(){const e=nr();return t=>{const n=Object.values(e).find((e=>{var n;return(null==(n=e.meta)?void 0:n.chartId)===t}));return null==n?void 0:n.parents.filter((t=>e[t].type===g.gn))}}();return n=>{var i;return(0,Xi.nY)(n)||"chartsInScope"in n&&(null==(i=n.chartsInScope)?void 0:i.some((n=>{const i=t(n);return 0===(null==i?void 0:i.length)||(null==i?void 0:i.every((t=>a()(e).call(e,t))))})))}}();return(0,s.useMemo)((()=>{let i=[];const r=[];return t?e.forEach((e=>{n(e)?i.push(e):r.push(e)})):i=e,[i,r]}),[e,t,n])}(m),x=ir()&&m.length>0,S=(0,s.useCallback)(((e,t)=>{let{id:n}=e;const i=m.findIndex((e=>e.id===n)),r=null!=t?t:n;return(0,C.tZ)(s.Fragment,{key:r},"",(0,C.tZ)(bd,{node:f[i],inView:!0}))}),[m,f]),Z=(0,s.useMemo)((()=>b.map(((e,t)=>({id:e.id,element:(0,C.tZ)("div",{className:"filter-item-wrapper",css:C.iv`
              flex-shrink: 0;
            `},S(e,t))})))),[b,S]),w=(0,s.useMemo)((()=>b.filter((e=>{let{id:t}=e;return null==l?void 0:a()(l).call(l,t)}))),[b,l]),R=(0,s.useMemo)((()=>w.filter((e=>(0,Xi.S0)(e)))),[w]),k=(0,s.useMemo)((()=>{const e=new Set(y.map((e=>{let{id:t}=e;return t}))),t=new Set(w.map((e=>{let{id:t}=e;return t})));return m.map((n=>e.has(n.id)||t.has(n.id)))}),[y,m,w]);return(0,s.useEffect)((()=>{var e;t&&a()(l).call(l,t)&&(null==h||null==(e=h.current)||e.open())}),[t,h,l]),(0,C.tZ)(s.Fragment,null,f.filter(((e,t)=>v.has(m[t].id))).map(((e,t)=>(0,C.tZ)(vd,{node:e,key:m[t].id},p(t,o,k[t])))),o===Yl.B.VERTICAL&&(0,C.tZ)(s.Fragment,null,b.map(S),x&&(0,C.tZ)(wd,{filtersOutOfScope:y,hasTopMargin:b.length>0,renderer:S})),o===Yl.B.HORIZONTAL&&(0,C.tZ)("div",{css:e=>C.iv`
          padding: 0 ${4*e.gridUnit}px;
          min-width: 0;
          flex: 1;
        `},(0,C.tZ)(Zd,{items:Z,dropdownTriggerIcon:(0,C.tZ)(B.Z.FilterSmall,{css:C.iv`
              && {
                margin-right: -4px;
                display: flex;
              }
            `}),dropdownTriggerText:(0,c.t)("More filters"),dropdownTriggerCount:R.length,dropdownTriggerTooltip:0===R.length?(0,c.t)("No applied filters"):(0,c.t)("Applied filters: %s",R.map((e=>e.name)).join(", ")),dropdownContent:w.length||y.length&&x?()=>(0,C.tZ)(Ru,{filtersInScope:w,filtersOutOfScope:y,renderer:S,showCollapsePanel:x}):void 0,ref:h,onOverflowingStateChange:e=>{let{overflowed:t}=e;(t.length!==l.length||l.reduce(((e,n,i)=>e||n!==t[i]),!1))&&d(t)}})))},Tu=s.memo(ku),Du=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    padding: ${3*t.gridUnit}px ${2*t.gridUnit}px ${3*t.gridUnit}px ${4*t.gridUnit}px;\n    background: ${t.colors.grayscale.light5};\n    box-shadow: inset 0px -2px 2px -1px ${t.colors.grayscale.light2};\n  `}}
`,Iu=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    display: flex;\n    flex-direction: row;\n    flex-wrap: nowrap;\n    align-items: center;\n    justify-content: flex-start;\n    line-height: 0;\n\n    .loading {\n      margin: ${2*t.gridUnit}px auto ${2*t.gridUnit}px;\n      padding: 0;\n    }\n  `}}
`,_u=y.iK.div`
  ${e=>{let{theme:t}=e;return`\n    font-weight: ${t.typography.weights.bold};\n    color: ${t.colors.grayscale.base};\n    font-size: ${t.typography.sizes.s}px;\n  `}}
`,$u=y.iK.div`
  ${e=>{let{theme:t,hasFilters:n}=e;return`\n    height: 24px;\n    display: flex;\n    align-items: center;\n    padding: 0 ${4*t.gridUnit}px 0 ${4*t.gridUnit}px;\n    border-right: ${n?`1px solid ${t.colors.grayscale.light2}`:0};\n\n    button {\n      display: flex;\n      align-items: center;\n      > .anticon {\n        height: 24px;\n        padding-right: ${t.gridUnit}px;\n      }\n      > .anticon + span, > .anticon {\n          margin-right: 0;\n          margin-left: 0;\n        }\n    }\n  `}}
`,Fu=e=>{let{actions:t,canEdit:n,dashboardId:i,dataMaskSelected:r,filterValues:o,isInitialized:a,focusedFilterId:l,onSelectionChange:d}=e;const u=o.length>0;return(0,C.tZ)(Du,td(),(0,C.tZ)(Iu,null,a?(0,C.tZ)(s.Fragment,null,(0,C.tZ)(Uc,null),n&&(0,C.tZ)($u,{hasFilters:u},(0,C.tZ)(ec,{dashboardId:i,createNewOnOpen:0===o.length},(0,C.tZ)(B.Z.PlusSmall,null)," ",(0,c.t)("Add/Edit Filters"))),!u&&(0,C.tZ)(_u,null,(0,c.t)("No filters are currently added to this dashboard.")),u&&(0,C.tZ)(Tu,{dataMaskSelected:r,focusedFilterId:l,onFilterSelectionChange:d}),t):(0,C.tZ)(p.Z,{position:"inline-centered"})))},Mu=s.memo(Fu),Eu=[yt.KD.nativeFilters.name,yt.KD.permalinkKey.name],Ou=T()((async(e,t,n,i,r)=>{var o;const{location:s}=e,{search:l}=s,d=new URLSearchParams(l),c=new URLSearchParams;let u;d.forEach(((e,t)=>{a()(Eu).call(Eu,t)||c.append(t,e)}));const h=(0,St.eY)(yt.KD.nativeFiltersKey),p=JSON.stringify(i);u=n&&h&&await(0,od.TZ)(t,p,h,r)?h:await(0,od.u7)(t,p,r),u&&c.set(yt.KD.nativeFiltersKey.name,u),a()(o=window.location.pathname).call(o,"/superset/dashboard")&&(e.location.pathname=window.location.pathname,e.replace({search:c.toString()}))}),Gi.M),zu=e=>{let{focusedFilterId:t,orientation:n=Yl.B.VERTICAL,verticalConfig:i}=e;const o=(0,ci.k6)(),a=rd(),[l,d]=(0,Jl.x)(a),c=(0,r.I0)(),[u,h]=(0,s.useState)(0),p=(0,Ql.z)(),m=id(),g=(0,Ao.D)(m),f=Object.values(m),v=f.filter(Xi.kI),b=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return null==t?void 0:t.id})),y=(0,Ao.D)(b),x=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm})),S=(0,s.useCallback)(((e,t)=>{d((n=>{var i,r,o;void 0!==(null==(i=t.filterState)?void 0:i.value)&&void 0===(null==(r=l[e.id])||null==(o=r.filterState)?void 0:o.value)&&e.requiredFirst&&c((0,lt.eG)(e.id,t)),n[e.id]={...(0,Gl.H)(e.id),...t}}))}),[l,c,d]);(0,s.useEffect)((()=>{if(g&&b===y){const e={};Object.values(m).forEach((t=>{const n=null==g?void 0:g[t.id];if(!n)return;const i=t.filterType,r=t.targets,o=t.defaultDataMask,a=null==n?void 0:n.filterType,s=null==n?void 0:n.targets,l=null==n?void 0:n.defaultDataMask,d=i!==a,c=!di()(r,s),u=!di()(o,l);(d||c||u)&&(e[t.id]=(0,Gl.H)(t.id))})),Bi()(e)||(d((t=>({...t,...e}))),Object.keys(e).forEach((e=>c((0,lt.ze)(e)))))}}),[JSON.stringify(m),JSON.stringify(g),y]);const Z=JSON.stringify(a);(0,s.useEffect)((()=>{d((()=>a))}),[Z,d]),(0,s.useEffect)((()=>{Ou(o,b,u,a,p)}),[b,Z,o,u,p]);const w=(0,s.useCallback)((()=>{const e=Object.keys(l);h(1),e.forEach((e=>{l[e]&&c((0,lt.eG)(e,l[e]))}))}),[l,c]),R=(0,s.useCallback)((()=>{Object.keys(l).forEach((e=>{l[e]&&(c((0,lt.ze)(e)),d((t=>{var n;void 0!==(null==(n=t[e].filterState)?void 0:n.value)&&(t[e].filterState.value=void 0)})))}))}),[l,c,d]);((e,t)=>{const n=id(),i=rd();(0,s.useEffect)((()=>{Object.keys(e).forEach((e=>{n[e]||t((t=>{delete t[e]}))}))}),[i,e,n,t])})(l,d);const k=((e,t,n)=>{const i=Object.values(e),r=Object.values(t);return(0,pi.JB)(Xl(e),Xl(t),{ignoreUndefined:!0})||i.length!==r.length||n.some((t=>{var n;return ed(t,null==e||null==(n=e[null==t?void 0:t.id])?void 0:n.filterState)}))})(l,a,v),T=(()=>{const[e,t]=(0,s.useState)(!1),n=id(),i=(0,r.v9)((e=>e.charts));let o=0;return e||(o=document.querySelectorAll('[data-ui-anchor="chart"]').length),(0,s.useEffect)((()=>{if(e)return;if(Object.values(n).find((e=>{let{requiredFirst:t}=e;return t})))return void t(!0);let r;0===o&&(r=setTimeout((()=>{t(!0)}),1e3)),o>0&&void 0!==r&&clearTimeout(r);const a=Object.values(i).filter((e=>{let{chartStatus:t}=e;return"loading"!==t})).length;o>0&&a>=o&&t(!0)}),[i,e,o]),e})(),D=(0,C.tZ)(cd,{filterBarOrientation:n,width:null==i?void 0:i.width,onApply:w,onClearAll:R,dataMaskSelected:l,dataMaskApplied:a,isApplyDisabled:k});return n===Yl.B.HORIZONTAL?(0,C.tZ)(Mu,{actions:D,canEdit:x,dashboardId:b,dataMaskSelected:l,focusedFilterId:t,filterValues:f,isInitialized:T,onSelectionChange:S}):i?(0,C.tZ)(tu,{actions:D,canEdit:x,dataMaskSelected:l,focusedFilterId:t,filtersOpen:i.filtersOpen,filterValues:f,isInitialized:T,isDisabled:k,height:i.height,offset:i.offset,onSelectionChange:S,toggleFiltersBar:i.toggleFiltersBar,width:i.width}):null},Pu=s.memo(zu);var Uu=n(61337);const Nu=y.iK.div`
  position: absolute;
  height: 100%;

  :hover .sidebar-resizer::after {
    background-color: ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  }

  .sidebar-resizer {
    // @z-index-above-sticky-header (100) + 1 = 101
    z-index: 101;
  }

  .sidebar-resizer::after {
    display: block;
    content: '';
    width: 1px;
    height: 100%;
    margin: 0 auto;
  }
`,qu=e=>{let{id:t,initialWidth:n,minWidth:i,maxWidth:r,enable:o,children:a}=e;const[l,d]=function(e,t){const n=(0,s.useRef)(),[i,r]=(0,s.useState)(t);return(0,s.useEffect)((()=>{var t;n.current=null!=(t=n.current)?t:(0,Uu.rV)(Uu.dR.common__resizable_sidebar_widths,{}),n.current[e]&&r(n.current[e])}),[e]),[i,function(t){r(t),(0,Uu.LS)(Uu.dR.common__resizable_sidebar_widths,{...n.current,[e]:t})}]}(t,n);return(0,C.tZ)(s.Fragment,null,(0,C.tZ)(Nu,null,(0,C.tZ)(Rs.e,{enable:{right:o},handleClasses:{right:"sidebar-resizer"},size:{width:l,height:"100%"},minWidth:i,maxWidth:r,onResizeStop:(e,t,n,i)=>d(l+i.width)})),a(l))},Au=e=>{const t=e[H._4],n=null==t?void 0:t.children[0];return n===H.PV?e[H._4]:e[n]},Lu=(e,t)=>"ant-tabs-nav-wrap"===e.target.className||t.contains(e.target);var ju=n(81545),Vu=["className","children","debounceTime","ignoreDimensions","parentSizeStyles","enableDebounceLeadingCall","resizeObserverPolyfill"];function Ku(){return Ku=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)Object.prototype.hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},Ku.apply(this,arguments)}var Bu=[],Hu={width:"100%",height:"100%"};function Wu(e){var t=e.className,n=e.children,i=e.debounceTime,r=void 0===i?300:i,o=e.ignoreDimensions,a=void 0===o?Bu:o,l=e.parentSizeStyles,d=void 0===l?Hu:l,c=e.enableDebounceLeadingCall,u=void 0===c||c,h=e.resizeObserverPolyfill,p=function(e,t){if(null==e)return{};var n,i,r={},o=Object.keys(e);for(i=0;i<o.length;i++)n=o[i],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,Vu),m=(0,s.useRef)(null),g=(0,s.useRef)(0),f=(0,s.useState)({width:0,height:0,top:0,left:0}),v=f[0],b=f[1],y=(0,s.useMemo)((function(){var e=Array.isArray(a)?a:[a];return T()((function(t){b((function(n){return Object.keys(n).filter((function(e){return n[e]!==t[e]})).every((function(t){return e.includes(t)}))?n:t}))}),r,{leading:u})}),[r,u,a]);return(0,s.useEffect)((function(){var e=new(h||window.ResizeObserver)((function(e){e.forEach((function(e){var t,n=null!=(t=null==e?void 0:e.contentRect)?t:{},i=n.left,r=n.top,o=n.width,a=n.height;g.current=window.requestAnimationFrame((function(){y({width:o,height:a,top:r,left:i})}))}))}));return m.current&&e.observe(m.current),function(){window.cancelAnimationFrame(g.current),e.disconnect(),y.cancel()}}),[y,h]),s.createElement("div",Ku({style:d,ref:m,className:t},p),n(Ku({},v,{ref:m.current,resize:y})))}Wu.propTypes={className:d().string,debounceTime:d().number,enableDebounceLeadingCall:d().bool,ignoreDimensions:d().oneOfType([d().any,d().arrayOf(d().any)]),children:d().func.isRequired};var Yu=n(78718),Ju=n.n(Yu);const Gu={depth:d().number.isRequired,editMode:d().bool,gridComponent:W.cP,handleComponentDrop:d().func.isRequired,isComponentVisible:d().bool.isRequired,resizeComponent:d().func.isRequired,setDirectPathToChild:d().func.isRequired,width:d().number.isRequired,dashboardId:d().number},Qu=e=>e.dropIndicatorProps&&(0,C.tZ)("div",{className:"drop-indicator drop-indicator--bottom"}),Xu=e=>e.dropIndicatorProps&&(0,C.tZ)("div",{className:"drop-indicator drop-indicator--top"}),eh=y.iK.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`,th=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: flex;
    flex-direction: column;

    /* gutters between rows */
    & > div:not(:last-child):not(.empty-droptarget) {
      margin-bottom: ${4*t.gridUnit}px;
    }

    & > .empty-droptarget {
      width: 100%;
      height: 100%;
    }

    & > .empty-droptarget:first-child {
      height: ${12*t.gridUnit}px;
      margin-top: ${-6*t.gridUnit}px;
      margin-bottom: ${-6*t.gridUnit}px;
    }

    & > .empty-droptarget:only-child {
      height: 80vh;
    }
  `}}
`,nh=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    // /* Editing guides */
    &.grid-column-guide {
      position: absolute;
      top: 0;
      min-height: 100%;
      background-color: ${(0,x.Zf)(t.colors.primary.base,parseFloat(t.opacity.light)/100)};
      pointer-events: none;
      box-shadow: inset 0 0 0 1px
        ${(0,x.Zf)(t.colors.primary.base,parseFloat(t.opacity.mediumHeavy)/100)};
    }
  `}};
`;class ih extends s.PureComponent{constructor(e){super(e),this.state={isResizing:!1},this.handleResizeStart=this.handleResizeStart.bind(this),this.handleResizeStop=this.handleResizeStop.bind(this),this.handleTopDropTargetDrop=this.handleTopDropTargetDrop.bind(this),this.getRowGuidePosition=this.getRowGuidePosition.bind(this),this.setGridRef=this.setGridRef.bind(this),this.handleChangeTab=this.handleChangeTab.bind(this)}getRowGuidePosition(e){return e&&this.grid?e.getBoundingClientRect().bottom-this.grid.getBoundingClientRect().top-2:null}setGridRef(e){this.grid=e}handleResizeStart(){this.setState((()=>({isResizing:!0})))}handleResizeStop(e){let{id:t,widthMultiple:n,heightMultiple:i}=e;this.props.resizeComponent({id:t,width:n,height:i}),this.setState((()=>({isResizing:!1})))}handleTopDropTargetDrop(e){e&&this.props.handleComponentDrop({...e,destination:{...e.destination,index:0}})}handleChangeTab(e){let{pathToTabIndex:t}=e;this.props.setDirectPathToChild(t)}render(){var e,t,n;const{gridComponent:i,handleComponentDrop:r,depth:o,width:a,isComponentVisible:l,editMode:d,canEdit:u,setEditMode:h,dashboardId:p}=this.props,m=(a+H.es)/H.cz-H.es,{isResizing:f}=this.state,v=0===(null==i||null==(e=i.children)?void 0:e.length),b=v&&i.type===g.gn,y=d&&(0,C.tZ)(kl.XJ,{title:(0,c.t)("Drag and drop components and charts to the dashboard"),description:(0,c.t)("You can create a new chart or use existing ones from the panel on the right"),buttonText:(0,C.tZ)(s.Fragment,null,(0,C.tZ)("i",{className:"fa fa-plus"}),(0,c.t)("Create a new chart")),buttonAction:()=>{window.open(`/chart/add?dashboard_id=${p}`,"_blank","noopener noreferrer")},image:"chart.svg"}),x=d?(0,C.tZ)(kl.XJ,{title:(0,c.t)("Drag and drop components to this tab"),description:(0,c.t)("You can create a new chart or use existing ones from the panel on the right"),buttonText:(0,C.tZ)(s.Fragment,null,(0,C.tZ)("i",{className:"fa fa-plus"}),(0,c.t)("Create a new chart")),buttonAction:()=>{window.open(`/chart/add?dashboard_id=${p}`,"_blank","noopener noreferrer")},image:"chart.svg"}):(0,C.tZ)(kl.XJ,{title:(0,c.t)("There are no components added to this tab"),description:u&&(0,c.t)("You can add the components in the edit mode."),buttonText:u&&(0,c.t)("Edit the dashboard"),buttonAction:u&&(()=>{h(!0)}),image:"chart.svg"});return a<100?null:(0,C.tZ)(s.Fragment,null,v&&(0,C.tZ)(eh,null,b?x:y),(0,C.tZ)("div",{className:"dashboard-grid",ref:this.setGridRef},(0,C.tZ)(th,{className:"grid-content"},d&&(0,C.tZ)(Ee,{component:i,depth:o,parentComponent:null,index:0,orientation:"column",onDrop:this.handleTopDropTargetDrop,className:"empty-droptarget",editMode:!0},Qu),null==i||null==(t=i.children)?void 0:t.map(((e,t)=>(0,C.tZ)(Wl,{key:e,id:e,parentId:i.id,depth:o+1,index:t,availableColumnCount:H.cz,columnWidth:m,isComponentVisible:l,onResizeStart:this.handleResizeStart,onResize:this.handleResize,onResizeStop:this.handleResizeStop,onChangeTab:this.handleChangeTab}))),d&&(null==i||null==(n=i.children)?void 0:n.length)>0&&(0,C.tZ)(Ee,{component:i,depth:o,parentComponent:null,index:i.children.length,orientation:"column",onDrop:r,className:"empty-droptarget",editMode:!0},Xu),f&&Array(H.cz).fill(null).map(((e,t)=>(0,C.tZ)(nh,{key:`grid-column-${t}`,className:"grid-column-guide",style:{left:t*H.es+t*m,width:m}}))))))}}ih.propTypes=Gu,ih.defaultProps={};const rh=ih,oh=(0,r.$j)((function(e){let{dashboardState:t,dashboardInfo:n}=e;return{editMode:t.editMode,canEdit:n.dash_edit_perm,dashboardId:n.id}}),(function(e){return(0,i.DE)({handleComponentDrop:Vn._p,resizeComponent:Vn.iO,setDirectPathToChild:jn.E2,setEditMode:jn.Mb},e)}))(rh);var ah=n(51127),sh=n.n(ah);const lh=e=>{let{topLevelTabs:t}=e;const n=(()=>{const e=(0,r.v9)((e=>{var t;return null==(t=e.nativeFilters)?void 0:t.filters}));return(0,s.useMemo)((()=>e?Object.values(e).map((e=>Ju()(e,["id","scope","type"]))):[]),[JSON.stringify(e)])})(),i=(0,r.I0)(),o=(0,r.v9)((e=>e.dashboardLayout.present)),a=(0,r.v9)((e=>e.dashboardInfo)),l=(0,r.v9)((e=>e.dashboardState.directPathToChild)),d=(0,r.v9)((e=>e.charts)),c=(0,s.useMemo)((()=>{const e=zl({currentComponent:Au(o),directPathToChild:l});return e>-1?e:((e,t)=>Math.max(0,zl({currentComponent:Au(e),directPathToChild:t})))(o,l)}),[o,l]);(0,s.useEffect)((()=>{if(!(0,u.c)(u.T.DASHBOARD_NATIVE_FILTERS)||0===n.length)return;const e=n.map((e=>{if(e.id.startsWith(Lo.Ky))return{filterId:e.id,tabsInScope:[],chartsInScope:[]};const t=(0,xi.Q)(e.scope,d,o),n=(0,Nr.Rz)(o,t);return{filterId:e.id,tabsInScope:Array.from(n),chartsInScope:t}}));i((0,wa.xk)(e))}),[n,o,i]);const h=(0,s.useCallback)((()=>{const e=a.metadata;if(null!=e&&e.color_scheme){const n={...e},r=null==n?void 0:n.color_scheme,o=(null==n?void 0:n.color_scheme_domain)||[],s=(0,ju.Z)(),l=s.get(r,!0)||void 0,d=(null==l?void 0:l.colors)||[],c=s.defaultKey,u=!!l,h=()=>{vt.Z.put({endpoint:`/api/v1/dashboard/${a.id}`,headers:{"Content-Type":"application/json"},body:JSON.stringify({json_metadata:sh()(n)})}).catch((e=>console.log(e)))},p=e=>{i((0,jn.uW)(e))},m=()=>{i((0,Ln.a8)({metadata:n})),h()};if(u)u&&!o.length&&(n.color_scheme_domain=d,m()),u&&o.length&&d.toString()!==o.toString()&&(n.color_scheme_domain=d,n.shared_label_colors={},p(r),m());else{var t;const e=(null==c?void 0:c.toString())||"supersetColors";n.color_scheme=e,n.color_scheme_domain=(null==(t=s.get(c))?void 0:t.colors)||[],n.shared_label_colors={},p(e),m()}}}),[d]);(0,Si.d)(h);const p=t?t.children:[H.PV],m=Math.min(c,p.length-1),g=0===m?H.PV:m.toString();return(0,C.tZ)("div",{className:"grid-container"},(0,C.tZ)(Wu,null,(e=>{let{width:t}=e;return(0,C.tZ)(w.ZP,{id:H.PV,activeKey:g,renderTabBar:()=>(0,C.tZ)(s.Fragment,null),fullWidth:!1,animated:!1,allowOverflow:!0},p.map(((e,n)=>(0,C.tZ)(w.ZP.TabPane,{key:0===n?H.PV:n.toString()},(0,C.tZ)(oh,{gridComponent:o[e],depth:H.Mu+1,width:t,isComponentVisible:n===c})))))})))},dh=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 1fr;
    flex: 1;
    /* Special cases */

    /* A row within a column has inset hover menu */
    .dragdroppable-column .dragdroppable-row .hover-menu--left {
      left: ${-3*t.gridUnit}px;
      background: ${t.colors.grayscale.light5};
      border: 1px solid ${t.colors.grayscale.light2};
    }

    .dashboard-component-tabs {
      position: relative;
    }

    /* A column within a column or tabs has inset hover menu */
    .dragdroppable-column .dragdroppable-column .hover-menu--top,
    .dashboard-component-tabs .dragdroppable-column .hover-menu--top {
      top: ${-3*t.gridUnit}px;
      background: ${t.colors.grayscale.light5};
      border: 1px solid ${t.colors.grayscale.light2};
    }

    /* move Tabs hover menu to top near actual Tabs */
    .dashboard-component-tabs > .hover-menu-container > .hover-menu--left {
      top: 0;
      transform: unset;
      background: transparent;
    }

    /* push Chart actions to upper right */
    .dragdroppable-column .dashboard-component-chart-holder .hover-menu--top,
    .dragdroppable .dashboard-component-header .hover-menu--top {
      right: ${2*t.gridUnit}px;
      top: ${2*t.gridUnit}px;
      background: transparent;
      border: none;
      transform: unset;
      left: unset;
    }
    div:hover > .hover-menu-container .hover-menu,
    .hover-menu-container .hover-menu:hover {
      opacity: 1;
    }

    p {
      margin: 0 0 ${2*t.gridUnit}px 0;
    }

    i.danger {
      color: ${t.colors.error.base};
    }

    i.warning {
      color: ${t.colors.alert.base};
    }
  `}}
`,ch=y.iK.div`
  grid-column: 1;
  grid-row: 1 / span 2;
  z-index: 11;
  width: ${e=>{let{width:t}=e;return t}}px;
`,uh=y.iK.div`
  position: sticky;
  top: -1px;
  width: ${e=>{let{width:t}=e;return t}}px;
  flex: 0 0 ${e=>{let{width:t}=e;return t}}px;
`,hh=y.iK.div`
  grid-column: 2;
  grid-row: 1;
  position: sticky;
  top: 0;
  z-index: 100;
  max-width: 100vw;
`,ph=y.iK.div`
  grid-column: 2;
  grid-row: 2;
  // @z-index-above-dashboard-header (100) + 1 = 101
  ${e=>{let{fullSizeChartId:t}=e;return t&&"z-index: 101;"}}
`,mh=y.iK.div`
  ${e=>{let{theme:t}=e;return C.iv`
    &.dashboard {
      position: relative;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      height: 100%;

      /* drop shadow for top-level tabs only */
      & .dashboard-component-tabs {
        box-shadow: 0 ${t.gridUnit}px ${t.gridUnit}px 0
          ${(0,x.Zf)(t.colors.grayscale.dark2,parseFloat(t.opacity.light)/100)};
        padding-left: ${2*t.gridUnit}px; /* note this is added to tab-level padding, to match header */
      }

      .dropdown-toggle.btn.btn-primary .caret {
        color: ${t.colors.grayscale.light5};
      }

      .background--transparent {
        background-color: transparent;
      }

      .background--white {
        background-color: ${t.colors.grayscale.light5};
      }
    }
    &.dashboard--editing {
      .grid-row:after,
      .dashboard-component-tabs > .hover-menu:hover + div:after {
        border: 1px dashed transparent;
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        z-index: 1;
        pointer-events: none;
      }

      .resizable-container {
        & .dashboard-component-chart-holder {
          .dashboard-chart {
            .chart-container {
              cursor: move;
              opacity: 0.2;
            }

            .slice_container {
              /* disable chart interactions in edit mode */
              pointer-events: none;
            }
          }

          &:hover .dashboard-chart .chart-container {
            opacity: 0.7;
          }
        }

        &:hover,
        &.resizable-container--resizing:hover {
          & > .dashboard-component-chart-holder:after {
            border: 1px dashed ${t.colors.primary.base};
          }
        }
      }

      .resizable-container--resizing:hover > .grid-row:after,
      .hover-menu:hover + .grid-row:after,
      .dashboard-component-tabs > .hover-menu:hover + div:after {
        border: 1px dashed ${t.colors.primary.base};
        z-index: 2;
      }

      .grid-row:after,
      .dashboard-component-tabs > .hover-menu + div:after {
        border: 1px dashed ${t.colors.grayscale.light2};
      }

      /* provide hit area in case row contents is edge to edge */
      .dashboard-component-tabs-content {
        .dragdroppable-row {
          padding-top: ${4*t.gridUnit}px;
        }

        & > div:not(:last-child):not(.empty-droptarget) {
          margin-bottom: ${4*t.gridUnit}px;
        }
      }

      .dashboard-component-chart-holder {
        &:after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          z-index: 1;
          pointer-events: none;
          border: 1px solid transparent;
        }

        &:hover:after {
          border: 1px dashed ${t.colors.primary.base};
          z-index: 2;
        }
      }

      .contract-trigger:before {
        display: none;
      }
    }

    & .dashboard-component-tabs-content {
      & > div:not(:last-child):not(.empty-droptarget) {
        margin-bottom: ${4*t.gridUnit}px;
      }

      & > .empty-droptarget {
        position: absolute;
        width: 100%;
      }

      & > .empty-droptarget:first-child {
        height: ${4*t.gridUnit}px;
        top: -2px;
        z-index: 10;
      }

      & > .empty-droptarget:last-child {
        height: ${3*t.gridUnit}px;
        bottom: 0;
      }
    }

    .empty-droptarget:first-child .drop-indicator--bottom {
      top: ${6*t.gridUnit}px;
    }
  `}}
`,gh=y.iK.div`
  ${e=>{let{theme:t,editMode:n,marginLeft:i}=e;return C.iv`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    height: auto;
    flex: 1;

    .grid-container .dashboard-component-tabs {
      box-shadow: none;
      padding-left: 0;
    }

    .grid-container {
      /* without this, the grid will not get smaller upon toggling the builder panel on */
      width: 0;
      flex: 1;
      position: relative;
      margin-top: ${6*t.gridUnit}px;
      margin-right: ${8*t.gridUnit}px;
      margin-bottom: ${6*t.gridUnit}px;
      margin-left: ${i}px;

      ${n&&`\n      max-width: calc(100% - ${ys.XX+16*t.gridUnit}px);\n    `}

      /* this is the ParentSize wrapper */
    & > div:first-child {
        height: inherit !important;
      }
    }

    .dashboard-builder-sidepane {
      width: ${ys.XX}px;
      z-index: 1;
    }

    .dashboard-component-chart-holder {
      width: 100%;
      height: 100%;
      background-color: ${t.colors.grayscale.light5};
      position: relative;
      padding: ${4*t.gridUnit}px;
      overflow-y: visible;

      // transitionable traits to show filter relevance
      transition: opacity ${t.transitionTiming}s ease-in-out,
        border-color ${t.transitionTiming}s ease-in-out,
        box-shadow ${t.transitionTiming}s ease-in-out;

      &.fade-in {
        border-radius: ${t.borderRadius}px;
        box-shadow: inset 0 0 0 2px ${t.colors.primary.base},
          0 0 0 3px
            ${(0,x.Zf)(t.colors.primary.base,parseFloat(t.opacity.light)/100)};
      }

      &.fade-out {
        border-radius: ${t.borderRadius}px;
        box-shadow: none;
      }

      & .missing-chart-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow-y: auto;
        justify-content: center;

        .missing-chart-body {
          font-size: ${t.typography.sizes.s}px;
          position: relative;
          display: flex;
        }
      }
    }
  `}}
`,fh=()=>{var e,t;const i=(0,r.I0)(),o=(0,gi.fG)(),a=(0,y.Fg)(),l=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return`${t.id}`})),d=(0,r.v9)((e=>e.dashboardLayout.present)),h=(0,r.v9)((e=>e.dashboardState.editMode)),m=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm})),g=(0,r.v9)((e=>{let{dashboardState:t}=e;return t.dashboardIsSaving})),f=(0,r.v9)((e=>e.nativeFilters)),v=null==f?void 0:f.focusedFilterId,x=(0,r.v9)((e=>e.dashboardState.fullSizeChartId)),Z=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return(0,pt.cr)(u.T.HORIZONTAL_FILTER_BAR)?t.filterBarOrientation:Yl.B.VERTICAL})),w=(0,s.useCallback)((e=>{let{pathToTabIndex:t}=e;i((0,jn.E2)(t))}),[i]),R=(0,s.useCallback)((()=>{i((0,Vn.g3)());const e=Pl(Au(d),0);i((0,jn.E2)(e))}),[d,i]),k=(0,s.useCallback)((e=>i((0,Vn._p)(e))),[i]),T=s.useRef(null),D=d[H._4],I=null==D?void 0:D.children[0],_=I!==H.PV?d[I]:void 0,$=(0,St.eY)(yt.KD.standalone),F=$===H._B.REPORT,M=o.hideTitle||$===H._B.HIDE_NAV_AND_TITLE||F,[E,O]=(0,s.useState)(0);(0,s.useEffect)((()=>{var e,t;let i;return O((null==(e=T.current)||null==(t=e.getBoundingClientRect())?void 0:t.height)||0),n.g.hasOwnProperty("ResizeObserver")&&T.current&&(i=new ResizeObserver((e=>{O((t=>{var n,i;return(null==e||null==(n=e[0])||null==(i=n.contentRect)?void 0:i.height)||t}))})),i.observe(T.current)),()=>{var e;null==(e=i)||e.disconnect()}}),[]);const{showDashboard:z,dashboardFiltersOpen:P,toggleDashboardFiltersOpen:U,nativeFiltersEnabled:N}=(()=>{const[e,t]=(0,s.useState)(!1),n=(0,r.v9)((e=>{var t,n;return(null==(t=(0,St.eY)(yt.KD.showFilters))||t)&&(null==(n=e.dashboardInfo.metadata)?void 0:n.show_native_filters)})),i=(0,r.v9)((e=>{let{dashboardInfo:t}=e;return t.dash_edit_perm})),o=id(),a=Object.values(o),l=(0,St.eY)(yt.KD.expandFilters),[d,c]=(0,s.useState)(null!=l?l:!!a.length),h=n&&(0,pt.cr)(u.T.DASHBOARD_NATIVE_FILTERS)&&(i||!i&&0!==a.length),p=a.filter((e=>e.requiredFirst)),m=rd(),g=e||!h||!(h&&p.length&&p.find((e=>{var t,n;let{id:i}=e;return void 0===(null==(t=m[i])||null==(n=t.filterState)?void 0:n.value)}))),f=(0,s.useCallback)((e=>{c(null!=e?e:!d)}),[d]);return(0,s.useEffect)((()=>{!1===l||0===a.length&&h?f(!1):f(!0)}),[a.length]),(0,s.useEffect)((()=>{g&&t(!0)}),[g]),{showDashboard:g,dashboardFiltersOpen:d,toggleDashboardFiltersOpen:f,nativeFiltersEnabled:h}})(),[q,A]=function(e){const t=(0,s.useRef)(null),[n,i]=(0,s.useState)(!1),r=e=>{const[t]=e;i(t.intersectionRatio<1)};return(0,s.useEffect)((()=>{const n=new IntersectionObserver(r,e),i=t.current;return i&&n.observe(i),()=>{i&&n.unobserve(i)}}),[t,e]),[t,n]}({threshold:[1]}),L=(0,pt.cr)(u.T.DASHBOARD_NATIVE_FILTERS_SET),j=N&&!h,V=`calc(100vh - ${ys.UN+(A||$?0:ys.Ky)+(L?ys.a7:0)}px)`,K=P?0:E+20,W=(0,s.useMemo)((()=>({marginLeft:P||h||!N||Z===Yl.B.HORIZONTAL?0:-32})),[P,h,Z,N]),Y=(0,s.useRef)(_);(0,s.useEffect)((()=>{var e,t,n;const r=null==(e=Y.current)||null==(t=e.children)?void 0:t.length,o=null==_||null==(n=_.children)?void 0:n.length;if(void 0!==r&&void 0!==o&&o>r){const e=Pl(Au(d),o-1);i((0,jn.E2)(e))}Y.current=_}),[_]);const J=(0,s.useCallback)((e=>{let{dropIndicatorProps:t}=e;return(0,C.tZ)("div",null,!M&&(0,C.tZ)(Wn,null),j&&Z===Yl.B.HORIZONTAL&&(0,C.tZ)(Pu,{focusedFilterId:v,orientation:Yl.B.HORIZONTAL}),t&&(0,C.tZ)("div",t),!F&&_&&!o.hideNav&&(0,C.tZ)(Bs,{shouldFocus:Lu,menuItems:[(0,C.tZ)(Gn,{icon:(0,C.tZ)(B.Z.FallOutlined,{iconSize:"xl"}),label:(0,c.t)("Collapse tab content"),onClick:R})],editMode:h},(0,C.tZ)(Wl,{id:null==_?void 0:_.id,parentId:H._4,depth:H.Mu+1,index:0,renderTabContent:!1,renderHoverMenu:!1,onChangeTab:w})))}),[v,N,Z,h,w,R,M,F,_,o.hideNav]),G=P||h||!N||Z===Yl.B.HORIZONTAL?8*a.gridUnit:0;return(0,C.tZ)(dh,null,j&&Z===Yl.B.VERTICAL&&(0,C.tZ)(s.Fragment,null,(0,C.tZ)(qu,{id:`dashboard:${l}`,enable:P,minWidth:ys.I6,maxWidth:ys.aF,initialWidth:ys.I6},(e=>{const t=P?e:ys.gz;return(0,C.tZ)(ch,{width:t},(0,C.tZ)(uh,{ref:q,width:t},(0,C.tZ)(S.Z,null,!F&&(0,C.tZ)(Pu,{focusedFilterId:v,orientation:Yl.B.VERTICAL,verticalConfig:{filtersOpen:P,toggleFiltersBar:U,width:t,height:V,offset:K}}))))}))),(0,C.tZ)(hh,{ref:T},(0,C.tZ)(Ee,{component:D,parentComponent:null,depth:H.Mu,index:0,orientation:"column",onDrop:k,editMode:h,disableDragDrop:!!_,style:W},J)),(0,C.tZ)(ph,{fullSizeChartId:x},(0,C.tZ)(C.xB,{styles:C.iv`
            // @z-index-above-dashboard-header (100) + 1 = 101
            ${x&&"div > .filterStatusPopover.ant-popover{z-index: 101}"}
          `}),!h&&!_&&0===(null==(e=d[H.PV])||null==(t=e.children)?void 0:t.length)&&(0,C.tZ)(kl.XJ,{title:(0,c.t)("There are no charts added to this dashboard"),description:m&&(0,c.t)("Go to the edit mode to configure the dashboard and add charts"),buttonText:m&&(0,c.t)("Edit the dashboard"),buttonAction:()=>i((0,jn.Mb)(!0)),image:"dashboard.svg"}),(0,C.tZ)(mh,{className:b()("dashboard",h&&"dashboard--editing")},(0,C.tZ)(gh,{className:"dashboard-content",editMode:h,marginLeft:G},z?(0,C.tZ)(lh,{topLevelTabs:_}):(0,C.tZ)(p.Z,null),h&&(0,C.tZ)(st,{topOffset:E})))),g&&(0,C.tZ)(p.Z,{css:C.iv`
            && {
              position: fixed;
            }
          `}))},vh=[g.dW,g.xh,g.t];function bh(e){return!Object.values(e).some((e=>{let{type:t}=e;return t&&a()(vh).call(vh,t)}))}const yh={actions:d().shape({addSliceToDashboard:d().func.isRequired,removeSliceFromDashboard:d().func.isRequired,triggerQuery:d().func.isRequired,logEvent:d().func.isRequired,clearDataMaskState:d().func.isRequired}).isRequired,dashboardInfo:W.$X.isRequired,dashboardState:W.DZ.isRequired,charts:d().objectOf(W.$6).isRequired,slices:d().objectOf(W.Rw).isRequired,activeFilters:d().object.isRequired,chartConfiguration:d().object,datasources:d().object.isRequired,ownDataCharts:d().object.isRequired,layout:d().object.isRequired,impressionId:d().string.isRequired,initMessages:d().array,timeout:d().number,userId:d().string};class Ch extends s.PureComponent{static onBeforeUnload(e){e?window.addEventListener("beforeunload",Ch.unload):window.removeEventListener("beforeunload",Ch.unload)}static unload(){const e=(0,c.t)("You have unsaved changes.");return window.event.returnValue=e,e}constructor(e){var t,n;super(e),this.appliedFilters=null!=(t=e.activeFilters)?t:{},this.appliedOwnDataCharts=null!=(n=e.ownDataCharts)?n:{},this.onVisibilityChange=this.onVisibilityChange.bind(this)}componentDidMount(){const e=(0,m.Z)(),{dashboardState:t,layout:n}=this.props,i={is_soft_navigation:mt.Yd.timeOriginOffset>0,is_edit_mode:t.editMode,mount_duration:mt.Yd.getTimestamp(),is_empty:bh(n),is_published:t.isPublished,bootstrap_data_length:e.length},r=(0,ni.Z)();r&&(i.target_id=r),this.props.actions.logEvent(mt.Wl,i),"hidden"===document.visibilityState&&(this.visibilityEventData={start_offset:mt.Yd.getTimestamp(),ts:(new Date).getTime()}),window.addEventListener("visibilitychange",this.onVisibilityChange),this.applyCharts()}componentDidUpdate(){this.applyCharts()}UNSAFE_componentWillReceiveProps(e){const t=f(this.props.layout),n=f(e.layout);this.props.dashboardInfo.id===e.dashboardInfo.id&&(t.length<n.length?n.filter((e=>-1===t.indexOf(e))).forEach((t=>{return this.props.actions.addSliceToDashboard(t,(n=e.layout,i=t,Object.values(n).find((e=>e&&e.type===g.dW&&e.meta&&e.meta.chartId===i))));var n,i})):t.length>n.length&&t.filter((e=>-1===n.indexOf(e))).forEach((e=>this.props.actions.removeSliceFromDashboard(e))))}applyCharts(){const{hasUnsavedChanges:e,editMode:t}=this.props.dashboardState,{appliedFilters:n,appliedOwnDataCharts:i}=this,{activeFilters:r,ownDataCharts:o,chartConfiguration:a}=this.props;(0,u.c)(u.T.DASHBOARD_CROSS_FILTERS)&&!a||(t||(0,pi.JB)(i,o,{ignoreUndefined:!0})&&(0,pi.JB)(n,r,{ignoreUndefined:!0})||this.applyFilters(),e?Ch.onBeforeUnload(!0):Ch.onBeforeUnload(!1))}componentWillUnmount(){window.removeEventListener("visibilitychange",this.onVisibilityChange),this.props.actions.clearDataMaskState()}onVisibilityChange(){if("hidden"===document.visibilityState)this.visibilityEventData={start_offset:mt.Yd.getTimestamp(),ts:(new Date).getTime()};else if("visible"===document.visibilityState){const e=this.visibilityEventData.start_offset;this.props.actions.logEvent(mt.Ev,{...this.visibilityEventData,duration:mt.Yd.getTimestamp()-e})}}getAllCharts(){return Object.values(this.props.charts)}applyFilters(){const{appliedFilters:e}=this,{activeFilters:t,ownDataCharts:n}=this.props,i=Object.keys(t),r=Object.keys(e),o=new Set(i.concat(r)),s=((e,t)=>{const n=Object.keys(e),i=Object.keys(t),r=(o=n,s=i,[...o.filter((e=>!a()(s).call(s,e))),...s.filter((e=>!a()(o).call(o,e)))]).filter((n=>e[n]||t[n]));var o,s;return new Set([...n,...i]).forEach((n=>{(0,pi.JB)(e[n],t[n])||r.push(n)})),[...new Set(r)]})(n,this.appliedOwnDataCharts);[...o].forEach((n=>{if(!a()(i).call(i,n)&&a()(r).call(r,n))s.push(...e[n].scope);else if(a()(r).call(r,n)){if((0,pi.JB)(e[n].values,t[n].values,{ignoreUndefined:!0})||s.push(...t[n].scope),!(0,pi.JB)(e[n].scope,t[n].scope)){const i=(t[n].scope||[]).concat(e[n].scope||[]);s.push(...i)}}else s.push(...t[n].scope)})),this.refreshCharts([...new Set(s)]),this.appliedFilters=t,this.appliedOwnDataCharts=n}refreshCharts(e){e.forEach((e=>{this.props.actions.triggerQuery(!0,e)}))}render(){return this.context.loading?(0,C.tZ)(p.Z,null):(0,C.tZ)(s.Fragment,null,(0,C.tZ)(fh,null))}}Ch.contextType=h.Zn,Ch.propTypes=yh,Ch.defaultProps={initMessages:[],timeout:60,userId:""};const xh=Ch;var Sh=n(50810),Zh=n(87915);const wh=(0,r.$j)((function(e){var t,n,i,r,o;const{datasources:a,sliceEntities:s,charts:l,dataMask:d,dashboardInfo:c,dashboardState:u,dashboardLayout:h,impressionId:p,nativeFilters:m}=e;return{initMessages:null==(t=c.common)?void 0:t.flash_messages,timeout:null==(n=c.common)||null==(i=n.conf)?void 0:i.SUPERSET_WEBSERVER_TIMEOUT,userId:c.userId,dashboardInfo:c,dashboardState:u,charts:l,datasources:a,activeFilters:{...(0,Yt.De)(),...(0,Zh.g)({chartConfiguration:null==(r=c.metadata)?void 0:r.chart_configuration,nativeFilters:m.filters,dataMask:d,allSliceIds:u.sliceIds})},chartConfiguration:null==(o=c.metadata)?void 0:o.chart_configuration,ownDataCharts:(0,Zh.U)(d,"ownState"),slices:s.slices,layout:h.present,impressionId:p}}),(function(e){return{actions:(0,i.DE)({setDatasources:Sh.Fy,clearDataMaskState:lt.sh,addSliceToDashboard:jn.Pi,removeSliceFromDashboard:jn.rL,triggerQuery:ai.triggerQuery,logEvent:Bn.logEvent},e)}}))(xh)},90057:(e,t,n)=>{"use strict";n.d(t,{x:()=>o,C:()=>a});var i=n(18172),r=n(67294);function o(e){var t=(0,r.useState)((function(){return(0,i.vV)("function"==typeof e?e():e,!0)})),n=t[1];return[t[0],(0,r.useCallback)((function(e){n("function"==typeof e?(0,i.ZP)(e):(0,i.vV)(e))}),[])]}function a(e,t,n){var o=(0,r.useMemo)((function(){return(0,i.ZP)(e)}),[e]);return(0,r.useReducer)(o,t,n)}}}]);
//# sourceMappingURL=8c87dc94d6c3382d35a6.chunk.js.map
