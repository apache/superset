"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[4572],{24572:(t,e,a)=>{a.r(e),a.d(e,{default:()=>c});var l=a(5872),n=a.n(l),s=a(55786),r=a(88889),u=a(55867),i=a(67294),o=a(4715),h=a(74448),d=a(11965);function c(t){const{data:e,formData:a,height:l,width:c,setDataMask:v,setHoveredFilter:g,unsetHoveredFilter:p,setFocusedFilter:f,unsetFocusedFilter:m,setFilterActive:w,filterState:F,inputRef:b}=t,{defaultValue:S}=a,[Z,M]=(0,i.useState)(null!=S?S:[]),k=t=>{const e=(0,s.Z)(t);M(e);const a={};e.length&&(a.granularity_sqla=e[0]),v({extraFormData:a,filterState:{value:e.length?e:null}})};(0,i.useEffect)((()=>{k(null!=S?S:null)}),[JSON.stringify(S)]),(0,i.useEffect)((()=>{var t;k(null!=(t=F.value)?t:null)}),[JSON.stringify(F.value)]);const C=(e||[]).filter((t=>t.dtype===r.Z.TEMPORAL)),x=0===C.length?(0,u.t)("No time columns"):(0,u.tn)("%s option","%s options",C.length,C.length),y={};F.validateMessage&&(y.extra=(0,d.tZ)(h.Am,{status:F.validateStatus},F.validateMessage));const A=C.map((t=>{const{column_name:e,verbose_name:a}=t;return{label:null!=a?a:e,value:e}}));return(0,d.tZ)(h.un,{height:l,width:c},(0,d.tZ)(h.jp,n()({validateStatus:F.validateStatus},y),(0,d.tZ)(o.Ph,{allowClear:!0,value:Z,placeholder:x,onChange:k,onBlur:m,onFocus:f,onMouseEnter:g,onMouseLeave:p,ref:b,options:A,onDropdownVisibleChange:w})))}},74448:(t,e,a)=>{a.d(e,{un:()=>s,jp:()=>r,Am:()=>u});var l=a(51995),n=a(4591);const s=l.iK.div`
  min-height: ${t=>{let{height:e}=t;return e}}px;
  width: ${t=>{let{width:e}=t;return e}}px;
`,r=(0,l.iK)(n.Z)`
  &.ant-row.ant-form-item {
    margin: 0;
  }
`,u=l.iK.div`
  color: ${t=>{var e;let{theme:a,status:l="error"}=t;return null==(e=a.colors[l])?void 0:e.base}};
`}}]);
//# sourceMappingURL=90202c9e154dcdec5895.chunk.js.map
