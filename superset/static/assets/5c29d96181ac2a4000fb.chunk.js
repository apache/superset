"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[9483],{89483:(e,t,r)=>{r.r(t),r.d(t,{default:()=>d});var i=r(51995),a=r(5364),l=r(67294),o=r(1090),n=r(74448),s=r(11965);const u=(0,i.iK)(n.un)`
  display: flex;
  align-items: center;
  overflow-x: auto;

  & .ant-tag {
    margin-right: 0;
  }
`,v=i.iK.div`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;
  & > div,
  & > div:hover {
    ${e=>{var t;let{validateStatus:r,theme:i}=e;return r&&`border-color: ${null==(t=i.colors[r])?void 0:t.base}`}}
  }
`;function d(e){var t;const{setDataMask:r,setHoveredFilter:i,unsetHoveredFilter:n,setFocusedFilter:d,unsetFocusedFilter:h,setFilterActive:c,width:g,height:f,filterState:m,inputRef:p,isOverflowingFilterBar:w=!1}=e,F=(0,l.useCallback)((e=>{const t=e&&e!==a.vM;r({extraFormData:t?{time_range:e}:{},filterState:{value:t?e:void 0}})}),[r]);return(0,l.useEffect)((()=>{F(m.value)}),[m.value]),null!=(t=e.formData)&&t.inView?(0,s.tZ)(u,{width:g,height:f},(0,s.tZ)(v,{ref:p,validateStatus:m.validateStatus,onFocus:d,onBlur:h,onMouseEnter:i,onMouseLeave:n},(0,s.tZ)(o.ZP,{value:m.value||a.vM,name:"time_range",onChange:F,onOpenPopover:()=>c(!0),onClosePopover:()=>{c(!1),n(),h()},isOverflowingFilterBar:w}))):null}},74448:(e,t,r)=>{r.d(t,{un:()=>l,jp:()=>o,Am:()=>n});var i=r(51995),a=r(4591);const l=i.iK.div`
  min-height: ${e=>{let{height:t}=e;return t}}px;
  width: ${e=>{let{width:t}=e;return t}}px;
`,o=(0,i.iK)(a.Z)`
  &.ant-row.ant-form-item {
    margin: 0;
  }
`,n=i.iK.div`
  color: ${e=>{var t;let{theme:r,status:i="error"}=e;return null==(t=r.colors[i])?void 0:t.base}};
`}}]);
//# sourceMappingURL=5c29d96181ac2a4000fb.chunk.js.map
