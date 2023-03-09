"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[8782],{18782:(e,t,l)=>{l.d(t,{p:()=>ie,Z:()=>ne});var a=l(5872),r=l.n(a),n=l(51995),i=l(55867),o=l(67294),s=l(29487),d=l(94184),u=l.n(d),c=l(35932),g=l(70163),p=l(49576),h=l(64158),m=l(97754),f=l(11965);const v=n.iK.div`
  ${e=>{let{theme:t,showThumbnails:l}=e;return`\n    display: grid;\n    grid-gap: ${12*t.gridUnit}px ${4*t.gridUnit}px;\n    grid-template-columns: repeat(auto-fit, 300px);\n    margin-top: ${-6*t.gridUnit}px;\n    padding: ${l?`${8*t.gridUnit+3}px ${9*t.gridUnit}px`:`${8*t.gridUnit+1}px ${9*t.gridUnit}px`};\n  `}}
`,b=n.iK.div`
  border: 2px solid transparent;
  &.card-selected {
    border: 2px solid ${e=>{let{theme:t}=e;return t.colors.primary.base}};
  }
  &.bulk-select {
    cursor: pointer;
  }
`;function y(e){let{bulkSelectEnabled:t,loading:l,prepareRow:a,renderCard:r,rows:n,showThumbnails:i}=e;return r?(0,f.tZ)(v,{showThumbnails:i},l&&0===n.length&&[...new Array(25)].map(((e,t)=>(0,f.tZ)("div",{key:t},r({loading:l})))),n.length>0&&n.map((e=>r?(a(e),(0,f.tZ)(b,{className:u()({"card-selected":t&&e.isSelected,"bulk-select":t}),key:e.id,onClick:l=>{return a=l,r=e.toggleRowSelected,void(t&&(a.preventDefault(),a.stopPropagation(),r()));var a,r},role:"none"},r({...e.original,loading:l}))):null))):null}var x=l(68135),w=l(4715),S=l(18446),Z=l.n(S),C=l(79521),$=l(35755),k=l(15926),_=l.n(k);const F={encode:e=>void 0===e?void 0:_().encode(e).replace(/%/g,"%25").replace(/&/g,"%26").replace(/\+/g,"%2B").replace(/#/g,"%23"),decode:e=>void 0===e||Array.isArray(e)?void 0:_().decode(e)};class I extends Error{constructor(){super(...arguments),this.name="ListViewError"}}function T(e,t){return e.map((e=>{let{id:l,urlDisplay:a,operator:r}=e;return{id:l,urlDisplay:a,operator:r,value:t[a||l]}}))}function P(e,t){const l=[],a={};return Object.keys(e).forEach((t=>{const r={id:t,value:e[t]};a[t]=r,l.push(r)})),t.forEach((e=>{const t=e.urlDisplay||e.id,l=a[t];l&&(l.operator=e.operator,l.id=e.id)})),l}var U=l(49238);const R=n.iK.div`
  width: ${200}px;
`,M=(0,n.iK)(g.Z.Search)`
  color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light1}};
`,B=(0,n.iK)(w.oc)`
  border-radius: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
`;function A(e,t){let{Header:l,name:a,initialValue:r,onSubmit:n}=e;const[s,d]=(0,o.useState)(r||""),u=()=>{s&&n(s.trim())};return(0,o.useImperativeHandle)(t,(()=>({clearFilter:()=>{d(""),n("")}}))),(0,f.tZ)(R,null,(0,f.tZ)(U.lX,null,l),(0,f.tZ)(B,{allowClear:!0,placeholder:(0,i.t)("Type a value"),name:a,value:s,onChange:e=>{d(e.currentTarget.value),""===e.currentTarget.value&&n("")},onPressEnter:u,onBlur:u,prefix:(0,f.tZ)(M,{iconSize:"l"})}))}const V=(0,o.forwardRef)(A);var E=l(84101);const N=n.iK.div`
  display: inline-flex;
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  align-items: center;
  width: ${200}px;
`;function z(e,t){let{Header:l,name:a,fetchSelects:r,initialValue:n,onSelect:s,selects:d=[]}=e;const[u,c]=(0,o.useState)(n),g=e=>{s(e?{label:e.label,value:e.value}:void 0),c(e)},p=()=>{s(void 0,!0),c(void 0)};(0,o.useImperativeHandle)(t,(()=>({clearFilter:()=>{p()}})));const h=(0,o.useMemo)((()=>async(e,t,l)=>{if(r){const a=await r(e,t,l);return{data:a.data,totalCount:a.totalCount}}return{data:[],totalCount:0}}),[r]);return(0,f.tZ)(N,null,r?(0,f.tZ)(E.Z,{allowClear:!0,ariaLabel:"string"==typeof l?l:a||(0,i.t)("Filter"),header:(0,f.tZ)(U.lX,null,l),onChange:g,onClear:p,options:h,placeholder:(0,i.t)("Select or type a value"),showSearch:!0,value:u}):(0,f.tZ)(w.Ph,{allowClear:!0,ariaLabel:"string"==typeof l?l:a||(0,i.t)("Filter"),header:(0,f.tZ)(U.lX,null,l),labelInValue:!0,onChange:g,onClear:p,options:d,placeholder:(0,i.t)("Select or type a value"),showSearch:!0,value:u}))}const H=(0,o.forwardRef)(z);var O=l(30381),K=l.n(O),D=l(62276);const q=n.iK.div`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  width: 360px;
`;function L(e,t){let{Header:l,initialValue:a,onSubmit:r}=e;const[n,s]=(0,o.useState)(null!=a?a:null),d=(0,o.useMemo)((()=>!n||Array.isArray(n)&&!n.length?null:[K()(n[0]),K()(n[1])]),[n]);return(0,o.useImperativeHandle)(t,(()=>({clearFilter:()=>{s(null),r([])}}))),(0,f.tZ)(q,null,(0,f.tZ)(U.lX,null,l),(0,f.tZ)(D.S,{placeholder:[(0,i.t)("Start date"),(0,i.t)("End date")],showTime:!0,value:d,onChange:e=>{var t,l,a,n;if(!e)return s(null),void r([]);const i=[null!=(t=null==(l=e[0])?void 0:l.valueOf())?t:0,null!=(a=null==(n=e[1])?void 0:n.valueOf())?a:0];s(i),r(i)}}))}const X=(0,o.forwardRef)(L);function j(e,t){let{filters:l,internalFilters:a=[],updateFilterValue:r}=e;const n=(0,o.useMemo)((()=>Array.from({length:l.length},(()=>(0,o.createRef)()))),[l.length]);return(0,o.useImperativeHandle)(t,(()=>({clearFilters:()=>{n.forEach((e=>{var t;null==(t=e.current)||null==t.clearFilter||t.clearFilter()}))}}))),(0,f.tZ)(o.Fragment,null,l.map(((e,t)=>{var l;let{Header:i,fetchSelects:o,key:s,id:d,input:u,paginate:c,selects:g,onFilterUpdate:p}=e;const h=null==a||null==(l=a[t])?void 0:l.value;return"select"===u?(0,f.tZ)(H,{ref:n[t],Header:i,fetchSelects:o,initialValue:h,key:s,name:d,onSelect:(e,l)=>{p&&(l||p(e)),r(t,e)},paginate:c,selects:g}):"search"===u&&"string"==typeof i?(0,f.tZ)(V,{ref:n[t],Header:i,initialValue:h,key:s,name:d,onSubmit:e=>{p&&p(e),r(t,e)}}):"datetime_range"===u?(0,f.tZ)(X,{ref:n[t],Header:i,initialValue:h,key:s,name:d,onSubmit:e=>r(t,e)}):null})))}const G=(0,x.b)((0,o.forwardRef)(j)),W=n.iK.div`
  display: inline-flex;
  font-size: ${e=>{let{theme:t}=e;return t.typography.sizes.s}}px;
  align-items: center;
  text-align: left;
  width: ${200}px;
`,J=e=>{let{initialSort:t,onChange:l,options:a,pageIndex:r,pageSize:n}=e;const s=t&&a.find((e=>{let{id:l}=e;return l===t[0].id}))||a[0],[d,u]=(0,o.useState)({label:s.label,value:s.value}),c=(0,o.useMemo)((()=>a.map((e=>({label:e.label,value:e.value})))),[a]);return(0,f.tZ)(W,null,(0,f.tZ)(w.Ph,{ariaLabel:(0,i.t)("Sort"),header:(0,f.tZ)(U.lX,null,(0,i.t)("Sort")),labelInValue:!0,onChange:e=>(e=>{u(e);const t=a.find((t=>{let{value:l}=t;return l===e.value}));if(t){const e=[{id:t.id,desc:t.desc}];l({pageIndex:r,pageSize:n,sortBy:e,filters:[]})}})(e),options:c,showSearch:!0,value:d}))};var Q=l(94301);const Y=n.iK.div`
  text-align: center;

  .superset-list-view {
    text-align: left;
    border-radius: 4px 0;
    margin: 0 ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;

    .header {
      display: flex;
      padding-bottom: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;

      & .controls {
        display: flex;
        flex-wrap: wrap;
        column-gap: ${e=>{let{theme:t}=e;return 6*t.gridUnit}}px;
        row-gap: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
      }
    }

    .body.empty table {
      margin-bottom: 0;
    }

    .body {
      overflow-x: auto;
    }

    .ant-empty {
      .ant-empty-image {
        height: auto;
      }
    }
  }

  .pagination-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  }

  .row-count-container {
    margin-top: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
  }
`,ee=(0,n.iK)(s.Z)`
  ${e=>{let{theme:t}=e;return`\n    border-radius: 0;\n    margin-bottom: 0;\n    color: ${t.colors.grayscale.dark1};\n    background-color: ${t.colors.primary.light4};\n\n    .selectedCopy {\n      display: inline-block;\n      padding: ${2*t.gridUnit}px 0;\n    }\n\n    .deselect-all {\n      color: ${t.colors.primary.base};\n      margin-left: ${4*t.gridUnit}px;\n    }\n\n    .divider {\n      margin: ${2*-t.gridUnit}px 0 ${2*-t.gridUnit}px ${4*t.gridUnit}px;\n      width: 1px;\n      height: ${8*t.gridUnit}px;\n      box-shadow: inset -1px 0px 0px ${t.colors.grayscale.light2};\n      display: inline-flex;\n      vertical-align: middle;\n      position: relative;\n    }\n\n    .ant-alert-close-icon {\n      margin-top: ${1.5*t.gridUnit}px;\n    }\n  `}}
`,te={Cell:e=>{let{row:t}=e;return(0,f.tZ)(p.Z,r()({},t.getToggleRowSelectedProps(),{id:t.id}))},Header:e=>{let{getToggleAllRowsSelectedProps:t}=e;return(0,f.tZ)(p.Z,r()({},t(),{id:"header-toggle-all"}))},id:"selection",size:"sm"},le=n.iK.div`
  padding-right: ${e=>{let{theme:t}=e;return 4*t.gridUnit}}px;
  margin-top: ${e=>{let{theme:t}=e;return 5*t.gridUnit+1}}px;
  white-space: nowrap;
  display: inline-block;

  .toggle-button {
    display: inline-block;
    border-radius: ${e=>{let{theme:t}=e;return t.gridUnit/2}}px;
    padding: ${e=>{let{theme:t}=e;return t.gridUnit}}px;
    padding-bottom: ${e=>{let{theme:t}=e;return.5*t.gridUnit}}px;

    &:first-of-type {
      margin-right: ${e=>{let{theme:t}=e;return 2*t.gridUnit}}px;
    }
  }

  .active {
    background-color: ${e=>{let{theme:t}=e;return t.colors.grayscale.base}};
    svg {
      color: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
    }
  }
`,ae=n.iK.div`
  padding: ${e=>{let{theme:t}=e;return 40*t.gridUnit}}px 0;

  &.table {
    background: ${e=>{let{theme:t}=e;return t.colors.grayscale.light5}};
  }
`,re=e=>{let{mode:t,setMode:l}=e;return(0,f.tZ)(le,null,(0,f.tZ)("div",{role:"button",tabIndex:0,onClick:e=>{e.currentTarget.blur(),l("card")},className:u()("toggle-button",{active:"card"===t})},(0,f.tZ)(g.Z.CardView,null)),(0,f.tZ)("div",{role:"button",tabIndex:0,onClick:e=>{e.currentTarget.blur(),l("table")},className:u()("toggle-button",{active:"table"===t})},(0,f.tZ)(g.Z.ListView,null)))},ne=function(e){let{columns:t,data:l,count:a,pageSize:n,fetchData:s,loading:d,initialSort:u=[],className:g="",filters:p=[],bulkActions:v=[],bulkSelectEnabled:b=!1,disableBulkSelect:x=(()=>{}),renderBulkSelectCopy:w=(e=>(0,i.t)("%s Selected",e.length)),renderCard:S,showThumbnails:k,cardSortSelectOptions:_,defaultViewMode:U="card",highlightRowId:R,emptyState:M}=e;const{getTableProps:B,getTableBodyProps:A,headerGroups:V,rows:E,prepareRow:N,pageCount:z=1,gotoPage:H,applyFilterValue:O,selectedFlatRows:K,toggleAllRowsSelected:D,setViewMode:q,state:{pageIndex:L,pageSize:X,internalFilters:j,viewMode:W},query:le}=function(e){let{fetchData:t,columns:l,data:a,count:r,initialPageSize:n,initialFilters:i=[],initialSort:s=[],bulkSelectMode:d=!1,bulkSelectColumnConfig:u,renderCard:c=!1,defaultViewMode:g="card"}=e;const[p,h]=(0,$.Kx)({filters:F,pageIndex:$.yz,sortColumn:$.Zp,sortOrder:$.Zp,viewMode:$.Zp}),m=(0,o.useMemo)((()=>p.sortColumn&&p.sortOrder?[{id:p.sortColumn,desc:"desc"===p.sortOrder}]:s),[p.sortColumn,p.sortOrder]),f={filters:p.filters?P(p.filters,i):[],pageIndex:p.pageIndex||0,pageSize:n,sortBy:m},[v,b]=(0,o.useState)(p.viewMode||(c?g:"table")),y=(0,o.useMemo)((()=>{const e=l.map((e=>({...e,filter:"exact"})));return d?[u,...e]:e}),[d,l]),{getTableProps:x,getTableBodyProps:w,headerGroups:S,rows:k,prepareRow:_,canPreviousPage:I,canNextPage:U,pageCount:R,gotoPage:M,setAllFilters:B,selectedFlatRows:A,toggleAllRowsSelected:V,state:{pageIndex:E,pageSize:N,sortBy:z,filters:H}}=(0,C.useTable)({columns:y,count:r,data:a,disableFilters:!0,disableSortRemove:!0,initialState:f,manualFilters:!0,manualPagination:!0,manualSortBy:!0,autoResetFilters:!1,pageCount:Math.ceil(r/n)},C.useFilters,C.useSortBy,C.usePagination,C.useRowState,C.useRowSelect),[O,K]=(0,o.useState)(p.filters&&i.length?T(i,p.filters):[]);return(0,o.useEffect)((()=>{i.length&&K(T(i,p.filters?p.filters:{}))}),[i]),(0,o.useEffect)((()=>{const e={};O.forEach((t=>{if(void 0!==t.value&&("string"!=typeof t.value||t.value.length>0)){const l=t.urlDisplay||t.id;e[l]=t.value}}));const l={filters:Object.keys(e).length?e:void 0,pageIndex:E};z[0]&&(l.sortColumn=z[0].id,l.sortOrder=z[0].desc?"desc":"asc"),c&&(l.viewMode=v);const a=void 0!==p.pageIndex&&l.pageIndex!==p.pageIndex?"push":"replace";h(l,a),t({pageIndex:E,pageSize:N,sortBy:z,filters:H})}),[t,E,N,z,H]),(0,o.useEffect)((()=>{Z()(f.pageIndex,E)||M(f.pageIndex)}),[p]),{canNextPage:U,canPreviousPage:I,getTableBodyProps:w,getTableProps:x,gotoPage:M,headerGroups:S,pageCount:R,prepareRow:_,rows:k,selectedFlatRows:A,setAllFilters:B,state:{pageIndex:E,pageSize:N,sortBy:z,filters:H,internalFilters:O,viewMode:v},toggleAllRowsSelected:V,applyFilterValue:(e,t)=>{K((l=>{if(l[e].value===t)return l;const a={...l[e],value:t},r=function(e,t,l){const a=e.find(((e,l)=>t===l));return[...e.slice(0,t),{...a,...l},...e.slice(t+1)]}(l,e,a);return B(r.filter((e=>!(void 0===e.value||Array.isArray(e.value)&&!e.value.length))).map((e=>{let{value:t,operator:l,id:a}=e;return"between"===l&&Array.isArray(t)?[{value:t[0],operator:"gt",id:a},{value:t[1],operator:"lt",id:a}]:{value:t,operator:l,id:a}})).flat()),M(0),r}))},setViewMode:b,query:p}}({bulkSelectColumnConfig:te,bulkSelectMode:b&&Boolean(v.length),columns:t,count:a,data:l,fetchData:s,initialPageSize:n,initialSort:u,initialFilters:p,renderCard:Boolean(S),defaultViewMode:U}),ne=Boolean(p.length);if(ne){const e=t.reduce(((e,t)=>({...e,[t.id||t.accessor]:!0})),{});p.forEach((t=>{if(!e[t.id])throw new I(`Invalid filter config, ${t.id} is not present in columns`)}))}const ie=(0,o.useRef)(null),oe=(0,o.useCallback)((()=>{var e;le.filters&&(null==(e=ie.current)||e.clearFilters())}),[le.filters]),se=Boolean(S);return(0,o.useEffect)((()=>{b||D(!1)}),[b,D]),(0,f.tZ)(Y,null,(0,f.tZ)("div",{className:`superset-list-view ${g}`},(0,f.tZ)("div",{className:"header"},se&&(0,f.tZ)(re,{mode:W,setMode:q}),(0,f.tZ)("div",{className:"controls"},ne&&(0,f.tZ)(G,{ref:ie,filters:p,internalFilters:j,updateFilterValue:O}),"card"===W&&_&&(0,f.tZ)(J,{initialSort:u,onChange:s,options:_,pageIndex:L,pageSize:X}))),(0,f.tZ)("div",{className:"body "+(0===E.length?"empty":"")},b&&(0,f.tZ)(ee,{type:"info",closable:!0,showIcon:!1,onClose:x,message:(0,f.tZ)(o.Fragment,null,(0,f.tZ)("div",{className:"selectedCopy"},w(K)),Boolean(K.length)&&(0,f.tZ)(o.Fragment,null,(0,f.tZ)("span",{role:"button",tabIndex:0,className:"deselect-all",onClick:()=>D(!1)},(0,i.t)("Deselect all")),(0,f.tZ)("div",{className:"divider"}),v.map((e=>(0,f.tZ)(c.Z,{key:e.key,buttonStyle:e.type,cta:!0,onClick:()=>e.onSelect(K.map((e=>e.original)))},e.name)))))}),"card"===W&&(0,f.tZ)(y,{bulkSelectEnabled:b,prepareRow:N,renderCard:S,rows:E,loading:d,showThumbnails:k}),"table"===W&&(0,f.tZ)(m.Z,{getTableProps:B,getTableBodyProps:A,prepareRow:N,headerGroups:V,rows:E,columns:t,loading:d,highlightRowId:R}),!d&&0===E.length&&(0,f.tZ)(ae,{className:W},le.filters?(0,f.tZ)(Q.XJ,{title:(0,i.t)("No results match your filter criteria"),description:(0,i.t)("Try different criteria to display results."),image:"filter-results.svg",buttonAction:()=>oe(),buttonText:(0,i.t)("clear all filters")}):(0,f.tZ)(Q.XJ,r()({},M,{title:(null==M?void 0:M.title)||(0,i.t)("No Data"),image:(null==M?void 0:M.image)||"filter-results.svg"}))))),E.length>0&&(0,f.tZ)("div",{className:"pagination-container"},(0,f.tZ)(h.Z,{totalPages:z||0,currentPage:z?L+1:0,onChange:e=>H(e-1),hideFirstAndLastPageLinks:!0}),(0,f.tZ)("div",{className:"row-count-container"},!d&&(0,i.t)("%s-%s of %s",X*L+(E.length&&1),X*L+E.length,a))))};var ie;!function(e){e.startsWith="sw",e.endsWith="ew",e.contains="ct",e.equals="eq",e.notStartsWith="nsw",e.notEndsWith="new",e.notContains="nct",e.notEquals="neq",e.greaterThan="gt",e.lessThan="lt",e.relationManyMany="rel_m_m",e.relationOneMany="rel_o_m",e.titleOrSlug="title_or_slug",e.nameOrDescription="name_or_description",e.allText="all_text",e.chartAllText="chart_all_text",e.datasetIsNullOrEmpty="dataset_is_null_or_empty",e.between="between",e.dashboardIsFav="dashboard_is_favorite",e.chartIsFav="chart_is_favorite",e.chartIsCertified="chart_is_certified",e.dashboardIsCertified="dashboard_is_certified",e.datasetIsCertified="dataset_is_certified",e.dashboardHasCreatedBy="dashboard_has_created_by",e.chartHasCreatedBy="chart_has_created_by",e.dashboardTags="dashboard_tags",e.chartTags="chart_tags",e.savedQueryTags="saved_query_tags"}(ie||(ie={}))}}]);
//# sourceMappingURL=29da2bf2c8e41938e71e.chunk.js.map
