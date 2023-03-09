"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[1948],{81948:(t,e,a)=>{a.r(e),a.d(e,{default:()=>h});var n=a(5872),l=a.n(n),r=a(55786),s=a(55867),i=a(67294),u=a(4715),o=a(74448),d=a(11965);function h(t){const{data:e,formData:a,height:n,width:h,setDataMask:v,setHoveredFilter:c,unsetHoveredFilter:g,setFocusedFilter:f,unsetFocusedFilter:p,setFilterActive:m,filterState:w,inputRef:F}=t,{defaultValue:S}=a,[b,M]=(0,i.useState)(null!=S?S:[]),Z=(0,i.useMemo)((()=>e.reduce(((t,e)=>{let{duration:a,name:n}=e;return{...t,[a]:n}}),{})),[JSON.stringify(e)]),k=t=>{const e=(0,r.Z)(t),[a]=e,n=a?Z[a]:void 0,l={};a&&(l.time_grain_sqla=a),M(e),v({extraFormData:l,filterState:{label:n,value:e.length?e:null}})};(0,i.useEffect)((()=>{k(null!=S?S:[])}),[JSON.stringify(S)]),(0,i.useEffect)((()=>{var t;k(null!=(t=w.value)?t:[])}),[JSON.stringify(w.value)]);const C=0===(e||[]).length?(0,s.t)("No data"):(0,s.tn)("%s option","%s options",e.length,e.length),x={};w.validateMessage&&(x.extra=(0,d.tZ)(o.Am,{status:w.validateStatus},w.validateMessage));const D=(e||[]).map((t=>{const{name:e,duration:a}=t;return{label:e,value:a}}));return(0,d.tZ)(o.un,{height:n,width:h},(0,d.tZ)(o.jp,l()({validateStatus:w.validateStatus},x),(0,d.tZ)(u.Ph,{allowClear:!0,value:b,placeholder:C,onChange:k,onBlur:p,onFocus:f,onMouseEnter:c,onMouseLeave:g,ref:F,options:D,onDropdownVisibleChange:m})))}},74448:(t,e,a)=>{a.d(e,{un:()=>r,jp:()=>s,Am:()=>i});var n=a(51995),l=a(4591);const r=n.iK.div`
  min-height: ${t=>{let{height:e}=t;return e}}px;
  width: ${t=>{let{width:e}=t;return e}}px;
`,s=(0,n.iK)(l.Z)`
  &.ant-row.ant-form-item {
    margin: 0;
  }
`,i=n.iK.div`
  color: ${t=>{var e;let{theme:a,status:n="error"}=t;return null==(e=a.colors[n])?void 0:e.base}};
`}}]);
//# sourceMappingURL=d807b0db7d2f582d56fb.chunk.js.map
