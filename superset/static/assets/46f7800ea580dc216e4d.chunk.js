(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[9541],{90233:(e,t,a)=>{"use strict";a.d(t,{Lu:()=>l,tL:()=>s});var r=a(87462),o=a(76826),n=a.n(o),s={CASE_SENSITIVE_EQUAL:7,EQUAL:6,STARTS_WITH:5,WORD_STARTS_WITH:4,CONTAINS:3,ACRONYM:2,MATCHES:1,NO_MATCH:0};l.rankings=s;var i=function(e,t){return String(e.rankedValue).localeCompare(String(t.rankedValue))};function l(e,t,a){void 0===a&&(a={});var o=a,n=o.keys,l=o.threshold,d=void 0===l?s.MATCHES:l,h=o.baseSort,m=void 0===h?i:h,g=o.sorter,v=void 0===g?function(e){return e.sort((function(e,t){return function(e,t,a){var r=e.rank,o=e.keyIndex,n=t.rank,s=t.keyIndex;return r===n?o===s?a(e,t):o<s?-1:1:r>n?-1:1}(e,t,m)}))}:g,f=e.reduce((function(e,o,i){var l=function(e,t,a,r){return t?function(e,t){for(var a=[],r=0,o=t.length;r<o;r++)for(var n=t[r],s=p(n),i=u(e,n),l=0,c=i.length;l<c;l++)a.push({itemValue:i[l],attributes:s});return a}(e,t).reduce((function(e,t,o){var n=e.rank,i=e.rankedValue,l=e.keyIndex,d=e.keyThreshold,u=t.itemValue,h=t.attributes,p=c(u,a,r),m=i,g=h.minRanking,v=h.maxRanking,f=h.threshold;return p<g&&p>=s.MATCHES?p=g:p>v&&(p=v),p>n&&(n=p,l=o,d=f,m=u),{rankedValue:m,rank:n,keyIndex:l,keyThreshold:d}}),{rankedValue:e,rank:s.NO_MATCH,keyIndex:-1,keyThreshold:r.threshold}):{rankedValue:e,rank:c(e,a,r),keyIndex:-1,keyThreshold:r.threshold}}(o,n,t,a),h=l.rank,m=l.keyThreshold;return h>=(void 0===m?d:m)&&e.push((0,r.Z)({},l,{item:o,index:i})),e}),[]);return v(f).map((function(e){return e.item}))}function c(e,t,a){return e=d(e,a),(t=d(t,a)).length>e.length?s.NO_MATCH:e===t?s.CASE_SENSITIVE_EQUAL:(e=e.toLowerCase())===(t=t.toLowerCase())?s.EQUAL:e.startsWith(t)?s.STARTS_WITH:e.includes(" "+t)?s.WORD_STARTS_WITH:e.includes(t)?s.CONTAINS:1===t.length?s.NO_MATCH:(r=e,o="",r.split(" ").forEach((function(e){e.split("-").forEach((function(e){o+=e.substr(0,1)}))})),o).includes(t)?s.ACRONYM:function(e,t){var a=0,r=0;function o(e,t,r){for(var o=r,n=t.length;o<n;o++)if(t[o]===e)return a+=1,o+1;return-1}var n,i,l=o(t[0],e,0);if(l<0)return s.NO_MATCH;r=l;for(var c=1,d=t.length;c<d;c++)if(!((r=o(t[c],e,r))>-1))return s.NO_MATCH;return n=1/(r-l),i=a/t.length,s.MATCHES+i*n}(e,t);var r,o}function d(e,t){return e=""+e,t.keepDiacritics||(e=n()(e)),e}function u(e,t){var a;if("object"==typeof t&&(t=t.key),"function"==typeof t)a=t(e);else if(null==e)a=null;else if(Object.hasOwnProperty.call(e,t))a=e[t];else{if(t.includes("."))return function(e,t){for(var a=e.split("."),r=[t],o=0,n=a.length;o<n;o++){for(var s=a[o],i=[],l=0,c=r.length;l<c;l++){var d=r[l];if(null!=d)if(Object.hasOwnProperty.call(d,s)){var u=d[s];null!=u&&i.push(u)}else"*"===s&&(i=i.concat(d))}r=i}if(Array.isArray(r[0])){var h=[];return h.concat.apply(h,r)}return r}(t,e);a=null}return null==a?[]:Array.isArray(a)?a:[String(a)]}var h={maxRanking:1/0,minRanking:-1/0};function p(e){return"string"==typeof e?h:(0,r.Z)({},h,e)}},76826:e=>{var t={À:"A",Á:"A",Â:"A",Ã:"A",Ä:"A",Å:"A",Ấ:"A",Ắ:"A",Ẳ:"A",Ẵ:"A",Ặ:"A",Æ:"AE",Ầ:"A",Ằ:"A",Ȃ:"A",Ç:"C",Ḉ:"C",È:"E",É:"E",Ê:"E",Ë:"E",Ế:"E",Ḗ:"E",Ề:"E",Ḕ:"E",Ḝ:"E",Ȇ:"E",Ì:"I",Í:"I",Î:"I",Ï:"I",Ḯ:"I",Ȋ:"I",Ð:"D",Ñ:"N",Ò:"O",Ó:"O",Ô:"O",Õ:"O",Ö:"O",Ø:"O",Ố:"O",Ṍ:"O",Ṓ:"O",Ȏ:"O",Ù:"U",Ú:"U",Û:"U",Ü:"U",Ý:"Y",à:"a",á:"a",â:"a",ã:"a",ä:"a",å:"a",ấ:"a",ắ:"a",ẳ:"a",ẵ:"a",ặ:"a",æ:"ae",ầ:"a",ằ:"a",ȃ:"a",ç:"c",ḉ:"c",è:"e",é:"e",ê:"e",ë:"e",ế:"e",ḗ:"e",ề:"e",ḕ:"e",ḝ:"e",ȇ:"e",ì:"i",í:"i",î:"i",ï:"i",ḯ:"i",ȋ:"i",ð:"d",ñ:"n",ò:"o",ó:"o",ô:"o",õ:"o",ö:"o",ø:"o",ố:"o",ṍ:"o",ṓ:"o",ȏ:"o",ù:"u",ú:"u",û:"u",ü:"u",ý:"y",ÿ:"y",Ā:"A",ā:"a",Ă:"A",ă:"a",Ą:"A",ą:"a",Ć:"C",ć:"c",Ĉ:"C",ĉ:"c",Ċ:"C",ċ:"c",Č:"C",č:"c",C̆:"C",c̆:"c",Ď:"D",ď:"d",Đ:"D",đ:"d",Ē:"E",ē:"e",Ĕ:"E",ĕ:"e",Ė:"E",ė:"e",Ę:"E",ę:"e",Ě:"E",ě:"e",Ĝ:"G",Ǵ:"G",ĝ:"g",ǵ:"g",Ğ:"G",ğ:"g",Ġ:"G",ġ:"g",Ģ:"G",ģ:"g",Ĥ:"H",ĥ:"h",Ħ:"H",ħ:"h",Ḫ:"H",ḫ:"h",Ĩ:"I",ĩ:"i",Ī:"I",ī:"i",Ĭ:"I",ĭ:"i",Į:"I",į:"i",İ:"I",ı:"i",Ĳ:"IJ",ĳ:"ij",Ĵ:"J",ĵ:"j",Ķ:"K",ķ:"k",Ḱ:"K",ḱ:"k",K̆:"K",k̆:"k",Ĺ:"L",ĺ:"l",Ļ:"L",ļ:"l",Ľ:"L",ľ:"l",Ŀ:"L",ŀ:"l",Ł:"l",ł:"l",Ḿ:"M",ḿ:"m",M̆:"M",m̆:"m",Ń:"N",ń:"n",Ņ:"N",ņ:"n",Ň:"N",ň:"n",ŉ:"n",N̆:"N",n̆:"n",Ō:"O",ō:"o",Ŏ:"O",ŏ:"o",Ő:"O",ő:"o",Œ:"OE",œ:"oe",P̆:"P",p̆:"p",Ŕ:"R",ŕ:"r",Ŗ:"R",ŗ:"r",Ř:"R",ř:"r",R̆:"R",r̆:"r",Ȓ:"R",ȓ:"r",Ś:"S",ś:"s",Ŝ:"S",ŝ:"s",Ş:"S",Ș:"S",ș:"s",ş:"s",Š:"S",š:"s",Ţ:"T",ţ:"t",ț:"t",Ț:"T",Ť:"T",ť:"t",Ŧ:"T",ŧ:"t",T̆:"T",t̆:"t",Ũ:"U",ũ:"u",Ū:"U",ū:"u",Ŭ:"U",ŭ:"u",Ů:"U",ů:"u",Ű:"U",ű:"u",Ų:"U",ų:"u",Ȗ:"U",ȗ:"u",V̆:"V",v̆:"v",Ŵ:"W",ŵ:"w",Ẃ:"W",ẃ:"w",X̆:"X",x̆:"x",Ŷ:"Y",ŷ:"y",Ÿ:"Y",Y̆:"Y",y̆:"y",Ź:"Z",ź:"z",Ż:"Z",ż:"z",Ž:"Z",ž:"z",ſ:"s",ƒ:"f",Ơ:"O",ơ:"o",Ư:"U",ư:"u",Ǎ:"A",ǎ:"a",Ǐ:"I",ǐ:"i",Ǒ:"O",ǒ:"o",Ǔ:"U",ǔ:"u",Ǖ:"U",ǖ:"u",Ǘ:"U",ǘ:"u",Ǚ:"U",ǚ:"u",Ǜ:"U",ǜ:"u",Ứ:"U",ứ:"u",Ṹ:"U",ṹ:"u",Ǻ:"A",ǻ:"a",Ǽ:"AE",ǽ:"ae",Ǿ:"O",ǿ:"o",Þ:"TH",þ:"th",Ṕ:"P",ṕ:"p",Ṥ:"S",ṥ:"s",X́:"X",x́:"x",Ѓ:"Г",ѓ:"г",Ќ:"К",ќ:"к",A̋:"A",a̋:"a",E̋:"E",e̋:"e",I̋:"I",i̋:"i",Ǹ:"N",ǹ:"n",Ồ:"O",ồ:"o",Ṑ:"O",ṑ:"o",Ừ:"U",ừ:"u",Ẁ:"W",ẁ:"w",Ỳ:"Y",ỳ:"y",Ȁ:"A",ȁ:"a",Ȅ:"E",ȅ:"e",Ȉ:"I",ȉ:"i",Ȍ:"O",ȍ:"o",Ȑ:"R",ȑ:"r",Ȕ:"U",ȕ:"u",B̌:"B",b̌:"b",Č̣:"C",č̣:"c",Ê̌:"E",ê̌:"e",F̌:"F",f̌:"f",Ǧ:"G",ǧ:"g",Ȟ:"H",ȟ:"h",J̌:"J",ǰ:"j",Ǩ:"K",ǩ:"k",M̌:"M",m̌:"m",P̌:"P",p̌:"p",Q̌:"Q",q̌:"q",Ř̩:"R",ř̩:"r",Ṧ:"S",ṧ:"s",V̌:"V",v̌:"v",W̌:"W",w̌:"w",X̌:"X",x̌:"x",Y̌:"Y",y̌:"y",A̧:"A",a̧:"a",B̧:"B",b̧:"b",Ḑ:"D",ḑ:"d",Ȩ:"E",ȩ:"e",Ɛ̧:"E",ɛ̧:"e",Ḩ:"H",ḩ:"h",I̧:"I",i̧:"i",Ɨ̧:"I",ɨ̧:"i",M̧:"M",m̧:"m",O̧:"O",o̧:"o",Q̧:"Q",q̧:"q",U̧:"U",u̧:"u",X̧:"X",x̧:"x",Z̧:"Z",z̧:"z"},a=Object.keys(t).join("|"),r=new RegExp(a,"g"),o=new RegExp(a,""),n=function(e){return e.replace(r,(function(e){return t[e]}))};e.exports=n,e.exports.has=function(e){return!!e.match(o)},e.exports.remove=n},53880:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>wa});var r=a(67294),o=a(28216),n=a(16550),s=a(37731),i=a(22102),l=a(55867),c=a(78161),d=a(38703),u=a(72570),h=a(23525),p=a(27600),m=a(98286),g=a(91914),v=a(43399);const f={form_data:{name:"form_data",parser:e=>{const t=JSON.parse(e);if(t.datasource){const[e,a]=t.datasource.split("__");t.datasource_id=e,t.datasource_type=a,delete t.datasource}return t}},slice_id:{name:"slice_id"},datasource_id:{name:"datasource_id"},datasource_type:{name:"datasource_type"},datasource:{name:"datasource",parser:e=>{const[t,a]=e.split("__");return{datasource_id:t,datasource_type:a}}},form_data_key:{name:"form_data_key"},permalink_key:{name:"permalink_key"},viz_type:{name:"viz_type"},dashboard_id:{name:"dashboard_id"}},b={p:"permalink_key",table:"datasource_id"},y=e=>{const t=new URLSearchParams(e);return Array.from(t.keys()).reduce(((e,a)=>{var r;const o=t.get(a);if(null===o)return e;let n;try{var s,i,l;n=null!=(s=null==(i=(l=f[a]).parser)?void 0:i.call(l,o))?s:o}catch{n=o}if("object"==typeof n)return{...e,...n};const c=(null==(r=f[a])?void 0:r.name)||a;return{...e,[c]:n}}),{})};var S=a(76445),w=a(5872),_=a.n(w),x=a(78718),Z=a.n(x),C=a(23279),k=a.n(C),T=a(78580),E=a.n(T),N=a(45697),D=a.n(N),A=a(14890),I=a(51995),$=a(11965),O=a(68492),R=a(29119),M=a(28615),U=a(14278),z=a(58593),j=a(60812),L=a(33626),q=a(70163),F=a(61337),P=a(99543),Q=a(97381),V=a(3741),K=a(94184),B=a.n(K),H=a(52256),W=a(50810),Y=a(2275),G=a(1510),J=a(40219),X=a(99068),ee=a(12515),te=a(10331),ae=a(651),re=a(19485),oe=a(6954),ne=a(14114),se=a(40323),ie=a(11064),le=a(46078),ce=a(55786),de=a(31069),ue=a(99612),he=a(32657),pe=a(91877),me=a(93185),ge=a(29487),ve=a(47710),fe=a(79217),be=a(95345),ye=a(89555),Se=a(37921),we=a(30381),_e=a.n(we);const xe=e=>{let{cachedTimestamp:t}=e;const a=t?(0,$.tZ)("span",null,(0,l.t)("Loaded data cached"),(0,$.tZ)("b",null," ",_e().utc(t).fromNow())):(0,l.t)("Loaded from cache");return(0,$.tZ)("span",null,a,". ",(0,l.t)("Click to force-refresh"))},Ze=e=>{let{className:t,onClick:a,cachedTimestamp:o}=e;const[n,s]=(0,r.useState)(!1),i=n?"primary":"default";return(0,$.tZ)(z.u,{title:(0,$.tZ)(xe,{cachedTimestamp:o}),id:"cache-desc-tooltip"},(0,$.tZ)(Se.Z,{className:`${t}`,type:i,onClick:a,onMouseOver:()=>s(!0),onMouseOut:()=>s(!1)},(0,l.t)("Cached")," ",(0,$.tZ)("i",{className:"fa fa-refresh"})))};var Ce=a(44814);const ke=(0,I.iK)(Se.Z)`
  text-align: left;
  font-family: ${e=>{let{theme:t}=e;return t.typography.families.monospace}};
`;function Te(e){let{endTime:t,isRunning:a,startTime:o,status:n="success"}=e;const[s,i]=(0,r.useState)("00:00:00.00"),l=(0,r.useRef)();return(0,r.useEffect)((()=>{const e=()=>{l.current&&(clearInterval(l.current),l.current=void 0)};return a&&(l.current=setInterval((()=>{if(o){const r=t||(0,Ce.zO)();o<r&&i((0,Ce.zQ)(o,r)),a||e()}}),30)),e}),[t,a,o]),(0,$.tZ)(ke,{type:n,role:"timer"},s)}var Ee;!function(e){e.failed="danger",e.loading="warning",e.success="success"}(Ee||(Ee={}));const Ne=(0,r.forwardRef)(((e,t)=>{let{queriesResponse:a,chartStatus:r,chartUpdateStartTime:o,chartUpdateEndTime:n,refreshCachedQuery:s,rowLimit:i}=e;const l="loading"===r,c=null==a?void 0:a[0];return(0,$.tZ)("div",{ref:t},(0,$.tZ)("div",{css:e=>$.iv`
            display: flex;
            justify-content: flex-end;
            padding-bottom: ${4*e.gridUnit}px;
            & .ant-tag:last-of-type {
              margin: 0;
            }
          `},!l&&c&&(0,$.tZ)(ye.Z,{rowcount:Number(c.rowcount)||0,limit:Number(i)||0}),!l&&(null==c?void 0:c.is_cached)&&(0,$.tZ)(Ze,{onClick:s,cachedTimestamp:c.cached_dttm}),(0,$.tZ)(Te,{startTime:o,endTime:n,isRunning:l,status:Ee[r]})))}));var De=a(35932);const Ae=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    margin: ${4*t.gridUnit}px;
    padding: ${4*t.gridUnit}px;

    border: 1px solid ${t.colors.info.base};
    background-color: ${t.colors.info.light2};
    border-radius: 2px;

    color: ${t.colors.info.dark2};
    font-size: ${t.typography.sizes.m}px;

    p {
      margin-bottom: ${t.gridUnit}px;
    }

    & a,
    & span[role='button'] {
      color: inherit;
      text-decoration: underline;
      &:hover {
        color: ${t.colors.info.dark1};
      }
    }

    &.alert-type-warning {
      border-color: ${t.colors.alert.base};
      background-color: ${t.colors.alert.light2};

      p {
        color: ${t.colors.alert.dark2};
      }

      & a:hover,
      & span[role='button']:hover {
        color: ${t.colors.alert.dark1};
      }
    }
  `}}
`,Ie=I.iK.div`
  display: flex;
  justify-content: flex-end;
  button {
    line-height: 1;
  }
`,$e=I.iK.p`
  font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
`,Oe={warning:"warning",danger:"danger"},Re=(0,r.forwardRef)(((e,t)=>{let{title:a,bodyText:r,primaryButtonAction:o,secondaryButtonAction:n,primaryButtonText:s,secondaryButtonText:i,type:l="info",className:c=""}=e;return(0,$.tZ)(Ae,{className:`alert-type-${l} ${c}`,ref:t},(0,$.tZ)($e,null,a),(0,$.tZ)("p",null,r),s&&o&&(0,$.tZ)(Ie,null,n&&i&&(0,$.tZ)(De.Z,{buttonStyle:"link",buttonSize:"small",onClick:n},i),(0,$.tZ)(De.Z,{buttonStyle:l in Oe?Oe[l]:"primary",buttonSize:"small",onClick:o},s)))}));var Me=a(75701);const Ue={actions:D().object.isRequired,onQuery:D().func,can_overwrite:D().bool.isRequired,can_download:D().bool.isRequired,datasource:D().object,dashboardId:D().number,column_formats:D().object,containerId:D().string.isRequired,isStarred:D().bool.isRequired,slice:D().object,sliceName:D().string,table_name:D().string,vizType:D().string.isRequired,form_data:D().object,ownState:D().object,standalone:D().bool,force:D().bool,timeout:D().number,chartIsStale:D().bool,chart:Y.$6,errorMessage:D().node,triggerRender:D().bool},ze=1.25,je=[100,0],Le=[300,65],qe=I.iK.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  align-content: stretch;
  overflow: auto;
  box-shadow: none;
  height: 100%;

  & > div {
    height: 100%;
  }

  .gutter {
    border-top: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    border-bottom: 1px solid ${e=>{let{theme:t}=e;return t.colors.grayscale.light2}};
    width: ${e=>{let{theme:t}=e;return 9*t.gridUnit}}px;
    margin: ${e=>{let{theme:t}=e;return t.gridUnit*ze}}px auto;
  }

  .gutter.gutter-vertical {
    display: ${e=>{let{showSplite:t}=e;return t?"block":"none"}};
    cursor: row-resize;
  }

  .ant-collapse {
    .ant-tabs {
      height: 100%;
      .ant-tabs-nav {
        padding-left: ${e=>{let{theme:t}=e;return 5*t.gridUnit}}px;
        margin: 0;
      }
      .ant-tabs-content-holder {
        overflow: hidden;
        .ant-tabs-content {
          height: 100%;
        }
      }
    }
  }
`;var Fe={name:"1wbll7q",styles:"text-decoration:underline"};const Pe=e=>{var t;let{chart:a,slice:o,vizType:n,ownState:s,triggerRender:i,force:c,datasource:d,errorMessage:u,form_data:h,onQuery:p,actions:m,timeout:g,standalone:v,chartIsStale:f,chartAlert:b}=e;const y=(0,I.Fg)(),S=y.gridUnit*ze,w=y.gridUnit*ze,{width:_,height:x,ref:Z}=(0,ue.NB)({refreshMode:"debounce",refreshRate:300}),[C,k]=(0,r.useState)((0,pe.cr)(me.T.DATAPANEL_CLOSED_BY_DEFAULT)?je:(0,F.rV)(F.dR.chart_split_sizes,je)),[T,N]=(0,r.useState)(!(0,pe.cr)(me.T.DATAPANEL_CLOSED_BY_DEFAULT)&&(0,F.rV)(F.dR.is_datapanel_open,!1)),[D,A]=(0,r.useState)(!1),O=(0,ie.Z)(),{useLegacyApi:R}=null!=(t=O.get(n))?t:{},M=R&&d.type!==le.i9.Table,U=!b&&f&&!M&&"failed"!==a.chartStatus&&(0,ce.Z)(a.queriesResponse).length>0,z=(0,r.useCallback)((async function(){if(o&&null===o.query_context){const e=(0,ee.u)({formData:o.form_data,force:c,resultFormat:"json",resultType:"full",setDataMask:null,ownState:null});await de.Z.put({endpoint:`/api/v1/chart/${o.slice_id}`,headers:{"Content-Type":"application/json"},body:JSON.stringify({query_context:JSON.stringify(e),query_context_generation:!0})})}}),[o]);(0,r.useEffect)((()=>{z()}),[z]),(0,r.useEffect)((()=>{(0,F.LS)(F.dR.chart_split_sizes,C)}),[C]);const j=(0,r.useCallback)((e=>{k(e)}),[]),L=(0,r.useCallback)((()=>{m.setForceQuery(!0),m.postChartFormData(h,!0,g,a.id,void 0,s),m.updateQueryFormData(h,a.id)}),[m,a.id,h,s,g]),q=(0,r.useCallback)((e=>{let t;t=e?[60,40]:je,k(t),N(e)}),[]),P=(0,r.useCallback)((()=>(0,$.tZ)("div",{css:$.iv`
          min-height: 0;
          flex: 1;
          overflow: auto;
        `,ref:Z},_&&x&&(0,$.tZ)(he.Z,{width:Math.floor(_),height:x,ownState:s,annotationData:a.annotationData,chartAlert:a.chartAlert,chartStackTrace:a.chartStackTrace,chartId:a.id,chartStatus:a.chartStatus,triggerRender:i,force:c,datasource:d,errorMessage:u,formData:h,latestQueryFormData:a.latestQueryFormData,onQuery:p,queriesResponse:a.queriesResponse,chartIsStale:f,setControlValue:m.setControlValue,timeout:g,triggerQuery:a.triggerQuery,vizType:n}))),[m.setControlValue,a.annotationData,a.chartAlert,a.chartStackTrace,a.chartStatus,a.id,a.latestQueryFormData,a.queriesResponse,a.triggerQuery,f,x,Z,_,d,u,c,h,p,s,g,i,n]),Q=(0,r.useMemo)((()=>(0,$.tZ)("div",{className:"panel-body",css:$.iv`
          display: flex;
          flex-direction: column;
        `},M&&(0,$.tZ)(ge.Z,{message:(0,l.t)("Chart type requires a dataset"),type:"error",css:e=>$.iv`
              margin: 0 0 ${4*e.gridUnit}px 0;
            `,description:(0,$.tZ)(r.Fragment,null,(0,l.t)("This chart type is not supported when using an unsaved query as a chart source. "),(0,$.tZ)("span",{role:"button",tabIndex:0,onClick:()=>A(!0),css:Fe},(0,l.t)("Create a dataset")),(0,l.t)(" to visualize your data."))}),U&&(0,$.tZ)(Re,{title:u?(0,l.t)("Required control values have been removed"):(0,l.t)("Your chart is not up to date"),bodyText:u?(0,Me.J)(!1):(0,$.tZ)("span",null,(0,l.t)('You updated the values in the control panel, but the chart was not updated automatically. Run the query by clicking on the "Update chart" button or')," ",(0,$.tZ)("span",{role:"button",tabIndex:0,onClick:p},(0,l.t)("click here")),"."),type:"warning",css:e=>$.iv`
              margin: 0 0 ${4*e.gridUnit}px 0;
            `}),(0,$.tZ)(Ne,{queriesResponse:a.queriesResponse,chartStatus:a.chartStatus,chartUpdateStartTime:a.chartUpdateStartTime,chartUpdateEndTime:a.chartUpdateEndTime,refreshCachedQuery:L,rowLimit:null==h?void 0:h.row_limit}),P())),[U,u,p,a.queriesResponse,a.chartStatus,a.chartUpdateStartTime,a.chartUpdateEndTime,L,null==h?void 0:h.row_limit,P]),V=(0,r.useMemo)((()=>P()),[P]),[K,B]=(0,r.useState)(a.latestQueryFormData);(0,r.useEffect)((()=>{i||B(a.latestQueryFormData)}),[a.latestQueryFormData]);const H=(0,r.useCallback)(((e,t,a)=>({[e]:`calc(${t}% - ${a+S}px)`})),[S]);if(v){const e="background-transparent",t=document.body.className.split(" ");return E()(t).call(t,e)||(document.body.className+=` ${e}`),V}return(0,$.tZ)(qe,{className:"panel panel-default chart-container",showSplite:T},"filter_box"===n?Q:(0,$.tZ)(se.Z,{sizes:C,minSize:Le,direction:"vertical",gutterSize:w,onDragEnd:j,elementStyle:H,expandToMin:!0},Q,(0,$.tZ)(be.c9,{ownState:s,queryFormData:K,datasource:d,queryForce:c,onCollapseChange:q,chartStatus:a.chartStatus,errorMessage:u,actions:m})),D&&(0,$.tZ)(ve.W,{visible:D,onHide:()=>A(!1),buttonTextOnSave:(0,l.t)("Save"),buttonTextOnOverwrite:(0,l.t)("Overwrite"),datasource:(0,fe.z)(d),openWindow:!1,formData:h}))};Pe.propTypes=Ue;const Qe=Pe;var Ve=a(21804),Ke=a.n(Ve),Be=a(5364),He=a(37687),We=a(48989),Ye=a(45211),Ge=a(49484),Je=a(43700),Xe=a(71262),et=a(74069),tt=a(61357),at=a(10488);const rt=e=>{let{loading:t,onQuery:a,onStop:r,errorMessage:o,isNewChart:n,canStopQuery:s,chartIsStale:i}=e;return t?(0,$.tZ)(De.Z,{onClick:r,buttonStyle:"warning",disabled:!s},(0,$.tZ)("i",{className:"fa fa-stop-circle-o"})," ",(0,l.t)("Stop")):(0,$.tZ)(De.Z,{onClick:a,buttonStyle:i?"primary":"secondary",disabled:!!o},n?(0,l.t)("Create chart"):(0,l.t)("Update chart"))};var ot=a(69856);const{confirm:nt}=et.Z,st=$.iv`
  &.anticon {
    font-size: unset;
    .anticon {
      line-height: unset;
      vertical-align: unset;
    }
  }
`,it=e=>$.iv`
  display: flex;
  position: sticky;
  bottom: 0;
  flex-direction: column;
  align-items: center;
  padding: ${4*e.gridUnit}px;
  z-index: 999;
  background: linear-gradient(
    ${(0,Ge.rgba)(e.colors.grayscale.light5,0)},
    ${e.colors.grayscale.light5} ${e.opacity.mediumLight}
  );

  & > button {
    min-width: 156px;
  }
`,lt=I.iK.div`
  position: relative;
  height: 100%;
  width: 100%;

  // Resizable add overflow-y: auto as a style to this div
  // To override it, we need to use !important
  overflow: visible !important;
  #controlSections {
    height: 100%;
    overflow: visible;
  }
  .nav-tabs {
    flex: 0 0 1;
  }
  .tab-content {
    overflow: auto;
    flex: 1 1 100%;
  }
  .Select__menu {
    max-width: 100%;
  }
  .type-label {
    margin-right: ${e=>{let{theme:t}=e;return 3*t.gridUnit}}px;
    width: ${e=>{let{theme:t}=e;return 7*t.gridUnit}}px;
    display: inline-block;
    text-align: center;
    font-weight: ${e=>{let{theme:t}=e;return t.typography.weights.bold}};
  }
`,ct=(0,I.iK)(Xe.ZP)`
  ${e=>{let{theme:t,fullWidth:a}=e;return $.iv`
    height: 100%;
    overflow: visible;
    .ant-tabs-nav {
      margin-bottom: 0;
    }
    .ant-tabs-nav-list {
      width: ${a?"100%":"50%"};
    }
    .ant-tabs-tabpane {
      height: 100%;
    }
    .ant-tabs-content-holder {
      padding-top: ${4*t.gridUnit}px;
    }

    .ant-collapse-ghost > .ant-collapse-item {
      &:not(:last-child) {
        border-bottom: 1px solid ${t.colors.grayscale.light3};
      }

      & > .ant-collapse-header {
        font-size: ${t.typography.sizes.s}px;
      }

      & > .ant-collapse-content > .ant-collapse-content-box {
        padding-bottom: 0;
        font-size: ${t.typography.sizes.s}px;
      }
    }
  `}}
`,dt=(e,t)=>e.reduce(((e,a)=>!a.expanded&&a.label||(e=>!!e.label&&(We.sections.legacyRegularTime.label===e.label||We.sections.legacyTimeseriesTime.label===e.label))(a)&&!(e=>{var t;return null==e||null==(t=e.columns)?void 0:t.some((e=>e.is_dttm))})(t)?e:[...e,String(a.label)]),[]);function ut(e,t){const a=(0,r.useRef)(e()),o=(0,r.useRef)(t);return o.current!==t&&(a.current=e(),o.current=t),a}const ht=e=>{var t,a;const{colors:n}=(0,I.Fg)(),i=(0,r.useContext)(U.Zn),c=(0,j.D)(e.exploreState),u=(0,j.D)(e.exploreState.datasource),h=(0,j.D)(e.chart.chartStatus),[p,m]=(0,r.useState)(!1),g=(0,r.useRef)(null),v=(0,o.v9)((e=>e.explore.controlsTransferred)),f=(0,o.v9)((e=>{var t,a;return null==(t=e.common)||null==(a=t.conf)?void 0:a.DEFAULT_TIME_FILTER})),{form_data:b,actions:y}=e,{setControlValue:S}=y,{x_axis:w,adhoc_filters:x}=b,Z=(0,j.D)(w);(0,r.useEffect)((()=>{w&&w!==Z&&(0,Ye.x)(w,e.exploreState.datasource)&&(!x||!x.find((e=>"SIMPLE"===e.expressionType&&e.operator===ot.d.TEMPORAL_RANGE&&e.subject===w)))&&nt({title:(0,l.t)("The X-axis is not on the filters list"),content:(0,l.t)("The X-axis is not on the filters list which will prevent it from being used in\n            time range filters in dashboards. Would you like to add it to the filters list?"),onOk:()=>{S("adhoc_filters",[...x||[],{clause:"WHERE",subject:w,operator:ot.d.TEMPORAL_RANGE,comparator:f||Be.vM,expressionType:"SIMPLE"}])}})}),[w,x,S,f,Z,e.exploreState.datasource]),(0,r.useEffect)((()=>{let t=!1;const a=e=>"object"==typeof e&&(0,s.Z)(e)&&"datasourceWarning"in e&&!0===e.datasourceWarning?(t=!0,{...e,datasourceWarning:!1}):e;"success"===e.chart.chartStatus&&"success"!==h&&(null==v||v.forEach((r=>{var o;if(t=!1,!(0,s.Z)(e.controls[r]))return;const n=Array.isArray(e.controls[r].value)?null==(o=(0,ce.Z)(e.controls[r].value))?void 0:o.map(a):a(e.controls[r].value);t&&e.actions.setControlValue(r,n)})))}),[v,h,e.actions,e.chart.chartStatus,e.controls]),(0,r.useEffect)((()=>{var t,a,r;!u||u.type===le.i9.Query||(null==(t=e.exploreState.datasource)?void 0:t.id)===u.id&&(null==(a=e.exploreState.datasource)?void 0:a.type)===u.type||(m(!0),null==(r=g.current)||r.scrollTo(0,0))}),[null==(t=e.exploreState.datasource)?void 0:t.id,null==(a=e.exploreState.datasource)?void 0:a.type,u]);const{expandedQuerySections:C,expandedCustomizeSections:k,querySections:T,customizeSections:E}=(0,r.useMemo)((()=>function(e,t,a){const r=[],o=[];return(0,te.Bq)(e,a).forEach((e=>{"data"===e.tabOverride||e.controlSetRows.some((e=>e.some((e=>e&&"object"==typeof e&&"config"in e&&e.config&&(!e.config.renderTrigger||"data"===e.config.tabOverride)))))?r.push(e):o.push(e)})),{expandedQuerySections:dt(r,t),expandedCustomizeSections:dt(o,t),querySections:r,customizeSections:o}}(b.viz_type,e.exploreState.datasource,e.datasource_type)),[e.exploreState.datasource,b.viz_type,e.datasource_type]),N=(0,r.useCallback)((()=>{(0,ce.Z)(e.exploreState.controlsTransferred).forEach((t=>e.actions.setControlValue(t,e.controls[t].default)))}),[e.actions,e.exploreState.controlsTransferred,e.controls]),D=(0,r.useCallback)((()=>{N(),m(!1)}),[N]),A=(0,r.useCallback)((()=>{m(!1)}),[]),O=t=>{let{name:a,config:r}=t;const{controls:o,chart:n,exploreState:s}=e;return Boolean(null==r.shouldMapStateToProps?void 0:r.shouldMapStateToProps(c||s,s,o[a],n))},R=ut((()=>({})),b.viz_type),M=t=>{const{controls:a}=e,{label:o,description:s}=t,i=String(o),c=t.controlSetRows.some((e=>e.some((e=>{const t="string"==typeof e?e:e&&"name"in e?e.name:null;return t&&t in a&&a[t].validationErrors&&a[t].validationErrors.length>0}))));c||(R.current[i]=!0);const d=R.current[i]?n.error.base:n.alert.base;return(0,$.tZ)(Je.Z.Panel,{css:e=>$.iv`
          margin-bottom: 0;
          box-shadow: none;

          &:last-child {
            padding-bottom: ${16*e.gridUnit}px;
            border-bottom: 0;
          }

          .panel-body {
            margin-left: ${4*e.gridUnit}px;
            padding-bottom: 0;
          }

          span.label {
            display: inline-block;
          }
          ${!t.label&&"\n            .ant-collapse-header {\n              display: none;\n            }\n          "}
        `,header:(0,$.tZ)((()=>(0,$.tZ)("span",null,(0,$.tZ)("span",{css:e=>$.iv`
            font-size: ${e.typography.sizes.m}px;
            line-height: 1.3;
          `},o)," ",s&&(0,$.tZ)(z.u,{id:i,title:s},(0,$.tZ)(q.Z.InfoCircleOutlined,{css:st})),c&&(0,$.tZ)(z.u,{id:`${Ke()("validation-errors")}-tooltip`,title:(0,l.t)("This section contains validation errors")},(0,$.tZ)(q.Z.InfoCircleOutlined,{css:$.iv`
                ${st};
                color: ${d};
              `})))),null),key:i},t.controlSetRows.map(((t,a)=>{const o=t.map((t=>t?r.isValidElement(t)?t:t.name&&t.config&&"datasource"!==t.name?(t=>{let{name:a,config:r}=t;const{controls:o,chart:n,exploreState:s}=e,{visibility:i}=r,c={...r,...o[a],...O({name:a,config:r})?null==r||null==r.mapStateToProps?void 0:r.mapStateToProps(s,o[a],n):void 0,name:a},{validationErrors:d,label:u,description:h,...p}=c,m=i?i.call(r,e,c):void 0,g="function"==typeof u?u(s,o[a],n):u,v="function"==typeof h?h(s,o[a],n):h;return"adhoc_filters"===a&&(p.canDelete=(e,t)=>{const a=e=>e.operator===ot.d.TEMPORAL_RANGE;return!a(e)||1!==t.filter(a).length||(0,l.t)("You cannot delete the last temporal filter as it's used for time range filters in dashboards.")}),(0,$.tZ)(at.Z,_()({key:`control-${a}`,name:a,label:g,description:v,validationErrors:d,actions:e.actions,isVisible:m},p))})(t):null:null)).filter((e=>null!==e));return 0===o.length?null:(0,$.tZ)(tt.Z,{key:`controlsetrow-${a}`,controls:o})})))},L=(0,ce.Z)(e.exploreState.controlsTransferred).length>0,F=(0,r.useCallback)((()=>L?(0,$.tZ)(Re,{title:(0,l.t)("Keep control settings?"),bodyText:(0,l.t)("You've changed datasets. Any controls with data (columns, metrics) that match this new dataset have been retained."),primaryButtonAction:A,secondaryButtonAction:D,primaryButtonText:(0,l.t)("Continue"),secondaryButtonText:(0,l.t)("Clear form"),type:"info"}):(0,$.tZ)(Re,{title:(0,l.t)("No form settings were maintained"),bodyText:(0,l.t)("We were unable to carry over any controls when switching to this new dataset."),primaryButtonAction:A,primaryButtonText:(0,l.t)("Continue"),type:"warning"})),[D,A,L]),P=ut((()=>!1),b.viz_type),Q=(0,r.useMemo)((()=>{e.errorMessage||(P.current=!0);const t=P.current?n.error.base:n.alert.base;return(0,$.tZ)(r.Fragment,null,(0,$.tZ)("span",null,(0,l.t)("Data")),e.errorMessage&&(0,$.tZ)("span",{css:e=>$.iv`
              margin-left: ${2*e.gridUnit}px;
            `}," ",(0,$.tZ)(z.u,{id:"query-error-tooltip",placement:"right",title:e.errorMessage},(0,$.tZ)(q.Z.ExclamationCircleOutlined,{css:$.iv`
                  ${st};
                  color: ${t};
                `}))))}),[n.error.base,n.alert.base,P,e.errorMessage]);if(!(0,He.Z)().has(b.viz_type)&&i.loading)return(0,$.tZ)(d.Z,null);const V=E.length>0;return(0,$.tZ)(lt,{ref:g},(0,$.tZ)(ct,{id:"controlSections",fullWidth:V,allowOverflow:!1},(0,$.tZ)(Xe.ZP.TabPane,{key:"query",tab:Q},(0,$.tZ)(Je.Z,{defaultActiveKey:C,expandIconPosition:"right",ghost:!0},p&&(0,$.tZ)(F,null),T.map(M))),V&&(0,$.tZ)(Xe.ZP.TabPane,{key:"display",tab:(0,l.t)("Customize")},(0,$.tZ)(Je.Z,{defaultActiveKey:k,expandIconPosition:"right",ghost:!0},E.map(M)))),(0,$.tZ)("div",{css:it},(0,$.tZ)(rt,{onQuery:e.onQuery,onStop:e.onStop,errorMessage:e.errorMessage,loading:"loading"===e.chart.chartStatus,isNewChart:!e.chart.queriesResponse,canStopQuery:e.canStopQuery,chartIsStale:e.chartIsStale})))};var pt=a(9882),mt=a(9875),gt=a(49238),vt=a(87183),ft=a(4715);const bt="save_chart_recent_dashboard",yt=(0,I.iK)(et.Z)`
  .ant-modal-body {
    overflow: visible;
  }
  i {
    position: absolute;
    top: -${e=>{let{theme:t}=e;return 5.25*t.gridUnit}}px;
    left: ${e=>{let{theme:t}=e;return 26.75*t.gridUnit}}px;
  }
`;class St extends r.Component{constructor(e){var t;super(e),this.handleDatasetNameChange=e=>{this.setState({datasetName:e.target.value})},this.renderSaveChartModal=()=>{var e;const t=this.state.saveToDashboardId||this.state.newDashboardName;return(0,$.tZ)(gt.l0,{layout:"vertical"},(this.state.alert||this.props.alert)&&(0,$.tZ)(ge.Z,{type:"warning",message:this.state.alert||this.props.alert,onClose:this.removeAlert}),(0,$.tZ)(gt.xJ,null,(0,$.tZ)(vt.Y,{id:"overwrite-radio",disabled:!this.canOverwriteSlice(),checked:"overwrite"===this.state.action,onChange:()=>this.changeAction("overwrite")},(0,l.t)("Save (Overwrite)")),(0,$.tZ)(vt.Y,{id:"saveas-radio",checked:"saveas"===this.state.action,onChange:()=>this.changeAction("saveas")},(0,l.t)("Save as..."))),(0,$.tZ)("hr",null),(0,$.tZ)(gt.xJ,{label:(0,l.t)("Chart name"),required:!0},(0,$.tZ)(mt.II,{name:"new_slice_name",type:"text",placeholder:"Name",value:this.state.newSliceName,onChange:this.onSliceNameChange})),"query"===(null==(e=this.props.datasource)?void 0:e.type)&&(0,$.tZ)(gt.xJ,{label:(0,l.t)("Dataset Name"),required:!0},(0,$.tZ)(pt.V,{tooltip:(0,l.t)("A reusable dataset will be saved with your chart."),placement:"right"}),(0,$.tZ)(mt.II,{name:"dataset_name",type:"text",placeholder:"Dataset Name",value:this.state.datasetName,onChange:this.handleDatasetNameChange})),(0,$.tZ)(gt.xJ,{label:(0,l.t)("Add to dashboard")},(0,$.tZ)(ft.Ph,{allowClear:!0,allowNewOptions:!0,ariaLabel:(0,l.t)("Select a dashboard"),options:this.props.dashboards,onChange:this.onDashboardSelectChange,value:t||void 0,placeholder:(0,$.tZ)("div",null,(0,$.tZ)("b",null,(0,l.t)("Select")),(0,l.t)(" a dashboard OR "),(0,$.tZ)("b",null,(0,l.t)("create")),(0,l.t)(" a new one"))})))},this.renderFooter=()=>{var e,t;return(0,$.tZ)("div",null,(0,$.tZ)(De.Z,{id:"btn_cancel",buttonSize:"small",onClick:this.onHide},(0,l.t)("Cancel")),(0,$.tZ)(De.Z,{id:"btn_modal_save_goto_dash",buttonSize:"small",disabled:!this.state.newSliceName||!this.state.saveToDashboardId&&!this.state.newDashboardName||(null==(e=this.props.datasource)?void 0:e.type)!==le.i9.Table&&!this.state.datasetName,onClick:()=>this.saveOrOverwrite(!0)},this.isNewDashboard()?(0,l.t)("Save & go to new dashboard"):(0,l.t)("Save & go to dashboard")),(0,$.tZ)(De.Z,{id:"btn_modal_save",buttonSize:"small",buttonStyle:"primary",onClick:()=>this.saveOrOverwrite(!1),disabled:this.state.isLoading||!this.state.newSliceName||(null==(t=this.props.datasource)?void 0:t.type)!==le.i9.Table&&!this.state.datasetName},!this.canOverwriteSlice()&&this.props.slice?(0,l.t)("Save as new chart"):this.isNewDashboard()?(0,l.t)("Save to new dashboard"):(0,l.t)("Save")))},this.state={saveToDashboardId:null,newSliceName:e.sliceName,datasetName:null==(t=e.datasource)?void 0:t.name,alert:null,action:this.canOverwriteSlice()?"overwrite":"saveas",isLoading:!1},this.onDashboardSelectChange=this.onDashboardSelectChange.bind(this),this.onSliceNameChange=this.onSliceNameChange.bind(this),this.changeAction=this.changeAction.bind(this),this.saveOrOverwrite=this.saveOrOverwrite.bind(this),this.isNewDashboard=this.isNewDashboard.bind(this),this.removeAlert=this.removeAlert.bind(this),this.onHide=this.onHide.bind(this)}isNewDashboard(){return!(this.state.saveToDashboardId||!this.state.newDashboardName)}canOverwriteSlice(){var e,t,a;return(null==(e=this.props.slice)||null==(t=e.owners)?void 0:E()(t).call(t,this.props.userId))&&!(null!=(a=this.props.slice)&&a.is_managed_externally)}componentDidMount(){this.props.actions.fetchDashboards(this.props.userId).then((()=>{var e;if(0===(0,ce.Z)(this.props.dashboards).length)return;const t=null==(e=this.props.dashboards)?void 0:e.map((e=>e.value)),a=sessionStorage.getItem(bt);let r=a&&parseInt(a,10);this.props.dashboardId&&(r=this.props.dashboardId),null!==r&&-1!==t.indexOf(r)&&this.setState({saveToDashboardId:r})}))}onSliceNameChange(e){this.setState({newSliceName:e.target.value})}onDashboardSelectChange(e){const t=e?String(e):void 0,a=e&&"number"==typeof e?e:null;this.setState({saveToDashboardId:a,newDashboardName:t})}changeAction(e){this.setState({action:e})}onHide(){this.props.dispatch((0,re.setSaveChartModalVisibility)(!1))}async saveOrOverwrite(e){this.setState({alert:null,isLoading:!0}),this.props.actions.removeSaveModalAlert();try{var t;if((null==(t=this.props.datasource)?void 0:t.type)===le.i9.Query){var a;const{schema:e,sql:t,database:r}=this.props.datasource,{templateParams:o}=this.props.datasource,n=(null==(a=this.props.datasource)?void 0:a.columns)||[];await this.props.actions.saveDataset({schema:e,sql:t,database:r,templateParams:o,datasourceName:this.state.datasetName,columns:n})}let o=[];this.props.slice&&"overwrite"===this.state.action&&(o=await this.props.actions.getSliceDashboards(this.props.slice));const n=this.props.form_data||{};delete n.url_params;let i,l=null;if(this.state.newDashboardName||this.state.saveToDashboardId){var r;let e=this.state.saveToDashboardId||null;this.state.saveToDashboardId||(e=(await this.props.actions.createDashboard(this.state.newDashboardName)).id),l=(await this.props.actions.getDashboard(e)).result,(0,s.Z)(l)&&(0,s.Z)(null==(r=l)?void 0:r.id)&&(o=E()(o).call(o,l.id)?o:[...o,l.id],n.dashboards=o)}if(this.props.actions.setFormData({...n}),i="overwrite"===this.state.action?await this.props.actions.updateSlice(this.props.slice,this.state.newSliceName,o,l?{title:l.dashboard_title,new:!this.state.saveToDashboardId}:null):await this.props.actions.createSlice(this.state.newSliceName,o,l?{title:l.dashboard_title,new:!this.state.saveToDashboardId}:null),l?sessionStorage.setItem(bt,`${l.id}`):sessionStorage.removeItem(bt),e&&l)return void this.props.history.push(l.url);const c=new URLSearchParams(window.location.search);c.set("save_action",this.state.action),c.delete("form_data_key"),"saveas"===this.state.action&&c.set("slice_id",i.id.toString()),this.props.history.replace(`/explore/?${c.toString()}`),this.setState({isLoading:!1}),this.onHide()}finally{this.setState({isLoading:!1})}}removeAlert(){this.props.alert&&this.props.actions.removeSaveModalAlert(),this.setState({alert:null})}render(){return(0,$.tZ)(yt,{show:this.props.isVisible,onHide:this.onHide,title:(0,l.t)("Save chart"),footer:this.renderFooter()},this.state.isLoading?(0,$.tZ)("div",{css:$.iv`
              display: flex;
              justify-content: center;
            `},(0,$.tZ)(d.Z,{position:"normal"})):this.renderSaveChartModal())}}const wt=(0,n.EN)((0,o.$j)((function(e){let{explore:t,saveModal:a,user:r}=e;return{datasource:t.datasource,slice:t.slice,userId:null==r?void 0:r.userId,dashboards:a.dashboards,alert:a.saveModalAlert,isVisible:a.isVisible}}))(St));var _t=a(1469),xt=a.n(_t),Zt=a(90233),Ct=a(27034),kt=a(42753),Tt=a(99963);const Et=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: ${6*t.gridUnit}px;
    padding: 0 ${t.gridUnit}px;

    // hack to make the drag preview image corners rounded
    transform: translate(0, 0);
    background-color: inherit;
    border-radius: 4px;

    > div {
      min-width: 0;
      margin-right: ${2*t.gridUnit}px;
    }
  `}}
`;function Nt(e){const{labelRef:t,showTooltip:a,type:r,value:o}=e,[{isDragging:n},s]=(0,Ct.c)({item:{value:e.value,type:e.type},collect:e=>({isDragging:e.isDragging()})}),i={labelRef:t,showTooltip:!n&&a,showType:!0};return(0,$.tZ)(Et,{ref:s},r===kt.g.Column?(0,$.tZ)(Tt.l,_()({column:o},i)):(0,$.tZ)(Tt.B,_()({metric:o},i)),(0,$.tZ)(q.Z.Drag,null))}const Dt=(0,pe.cr)(me.T.ENABLE_EXPLORE_DRAG_AND_DROP),At=I.iK.button`
  background: none;
  border: none;
  text-decoration: underline;
  color: ${e=>{let{theme:t}=e;return t.colors.primary.dark1}};
`,It=I.iK.div`
  text-align: center;
  padding-top: 2px;
`,$t=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    background-color: ${t.colors.grayscale.light5};
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    .ant-collapse {
      height: auto;
    }
    .field-selections {
      padding: 0 0 ${4*t.gridUnit}px;
      overflow: auto;
    }
    .field-length {
      margin-bottom: ${2*t.gridUnit}px;
      font-size: ${t.typography.sizes.s}px;
      color: ${t.colors.grayscale.light1};
    }
    .form-control.input-md {
      width: calc(100% - ${8*t.gridUnit}px);
      height: ${8*t.gridUnit}px;
      margin: ${2*t.gridUnit}px auto;
    }
    .type-label {
      font-size: ${t.typography.sizes.s}px;
      color: ${t.colors.grayscale.base};
    }
    .Control {
      padding-bottom: 0;
    }
  `}};
`,Ot=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${t.typography.sizes.s}px;
    background-color: ${t.colors.grayscale.light4};
    margin: ${2*t.gridUnit}px 0;
    border-radius: 4px;
    padding: 0 ${t.gridUnit}px;

    &:first-of-type {
      margin-top: 0;
    }
    &:last-of-type {
      margin-bottom: 0;
    }

    ${Dt&&$.iv`
      padding: 0;
      cursor: pointer;
      &:hover {
        background-color: ${t.colors.grayscale.light3};
      }
    `}

    & > span {
      white-space: nowrap;
    }

    .option-label {
      display: inline;
    }

    .metric-option {
      & > svg {
        min-width: ${4*t.gridUnit}px;
      }
      & > .option-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `}}
`,Rt=I.iK.span`
  ${e=>{let{theme:t}=e;return`\n    font-size: ${t.typography.sizes.m}px;\n    line-height: 1.3;\n  `}}
`,Mt=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    margin: 0 ${2.5*t.gridUnit}px;

    span {
      text-decoration: underline;
    }
  `}}
`,Ut=e=>{const t={labelRef:(0,r.useRef)(null)};return(0,$.tZ)(Ot,{className:e.className},r.cloneElement(e.children,t))};function zt(e){var t;let{datasource:a,formData:o,controls:{datasource:n},actions:s,shouldForceUpdate:i}=e;const{columns:c,metrics:d}=a,u=(0,r.useMemo)((()=>[...xt()(c)?c:[]].sort(((e,t)=>null==e||!e.is_dttm||null!=t&&t.is_dttm?null==t||!t.is_dttm||null!=e&&e.is_dttm?0:1:-1))),[c]),[h,m]=(0,r.useState)(!1),[g,v]=(0,r.useState)(""),[f,b]=(0,r.useState)({columns:u,metrics:d}),[y,S]=(0,r.useState)(!1),[w,x]=(0,r.useState)(!1),Z=(0,r.useMemo)((()=>k()((e=>{b(""!==e?{columns:(0,Zt.Lu)(u,e,{keys:[{key:"verbose_name",threshold:Zt.tL.CONTAINS},{key:"column_name",threshold:Zt.tL.CONTAINS},{key:e=>{var t,a;return[null!=(t=null==e?void 0:e.description)?t:"",null!=(a=null==e?void 0:e.expression)?a:""].map((e=>(null==e?void 0:e.replace(/[_\n\s]+/g," "))||""))},threshold:Zt.tL.CONTAINS,maxRanking:Zt.tL.CONTAINS}],keepDiacritics:!0}),metrics:(0,Zt.Lu)(d,e,{keys:[{key:"verbose_name",threshold:Zt.tL.CONTAINS},{key:"metric_name",threshold:Zt.tL.CONTAINS},{key:e=>{var t,a;return[null!=(t=null==e?void 0:e.description)?t:"",null!=(a=null==e?void 0:e.expression)?a:""].map((e=>(null==e?void 0:e.replace(/[_\n\s]+/g," "))||""))},threshold:Zt.tL.CONTAINS,maxRanking:Zt.tL.CONTAINS}],keepDiacritics:!0,baseSort:(e,t)=>{var a,r,o,n,s,i;return Number(null!=(a=null==t||null==(r=t.item)?void 0:r.is_certified)?a:0)-Number(null!=(o=null==e||null==(n=e.item)?void 0:n.is_certified)?o:0)||String(null!=(s=null==e?void 0:e.rankedValue)?s:"").localeCompare(null!=(i=null==t?void 0:t.rankedValue)?i:"")}})}:{columns:u,metrics:d})}),p.oP)),[u,d]);(0,r.useEffect)((()=>{b({columns:u,metrics:d}),v("")}),[u,a,d]);const C=(0,r.useMemo)((()=>{var e;return y?null==f?void 0:f.metrics:null==f||null==(e=f.metrics)||null==e.slice?void 0:e.slice(0,50)}),[null==f?void 0:f.metrics,y]),T=(0,r.useMemo)((()=>{var e;return(w?null==f?void 0:f.columns:null==f||null==(e=f.columns)||null==e.slice?void 0:e.slice(0,50)).sort(((e,t)=>{var a,r;return(null!=(a=null==t?void 0:t.is_certified)?a:0)-(null!=(r=null==e?void 0:e.is_certified)?r:0)}))}),[f.columns,w]),E={query:le.i9.Query,saved_query:le.i9.SavedQuery},N=a.type&&E[a.type],D=(0,r.useMemo)((()=>{var e;return(0,$.tZ)(r.Fragment,null,(0,$.tZ)(mt.II,{allowClear:!0,onChange:e=>{v(e.target.value),Z(e.target.value)},value:g,className:"form-control input-md",placeholder:(0,l.t)("Search Metrics & Columns")}),(0,$.tZ)("div",{className:"field-selections"},N&&"false"!==sessionStorage.getItem("showInfobox")&&(0,$.tZ)(Mt,null,(0,$.tZ)(ge.Z,{closable:!0,onClose:()=>sessionStorage.setItem("showInfobox","false"),type:"info",message:"",description:(0,$.tZ)(r.Fragment,null,(0,$.tZ)("span",{role:"button",tabIndex:0,onClick:()=>m(!0),className:"add-dataset-alert-description"},(0,l.t)("Create a dataset")),(0,l.t)(" to edit or add columns and metrics."))})),(0,$.tZ)(Je.Z,{defaultActiveKey:["metrics","column"],expandIconPosition:"right",ghost:!0},(null==d?void 0:d.length)&&(0,$.tZ)(Je.Z.Panel,{header:(0,$.tZ)(Rt,null,(0,l.t)("Metrics")),key:"metrics"},(0,$.tZ)("div",{className:"field-length"},(0,l.t)("Showing %s of %s",null==C?void 0:C.length,null==f?void 0:f.metrics.length)),null==C||null==C.map?void 0:C.map((e=>(0,$.tZ)(Ut,{key:e.metric_name+String(i),className:"column"},Dt?(0,$.tZ)(Nt,{value:e,type:kt.g.Metric}):(0,$.tZ)(Tt.B,{metric:e,showType:!0})))),(null==f||null==(e=f.metrics)?void 0:e.length)>50?(0,$.tZ)(It,null,(0,$.tZ)(At,{onClick:()=>S(!y)},y?(0,l.t)("Show less..."):(0,l.t)("Show all..."))):(0,$.tZ)(r.Fragment,null)),(0,$.tZ)(Je.Z.Panel,{header:(0,$.tZ)(Rt,null,(0,l.t)("Columns")),key:"column"},(0,$.tZ)("div",{className:"field-length"},(0,l.t)("Showing %s of %s",T.length,f.columns.length)),T.map((e=>(0,$.tZ)(Ut,{key:e.column_name+String(i),className:"column"},Dt?(0,$.tZ)(Nt,{value:e,type:kt.g.Column}):(0,$.tZ)(Tt.l,{column:e,showType:!0})))),f.columns.length>50?(0,$.tZ)(It,null,(0,$.tZ)(At,{onClick:()=>x(!w)},w?(0,l.t)("Show Less..."):(0,l.t)("Show all..."))):(0,$.tZ)(r.Fragment,null)))))}),[T,g,f.columns.length,null==f||null==(t=f.metrics)?void 0:t.length,C,Z,w,y,N,i]);return(0,$.tZ)($t,null,N&&h&&(0,$.tZ)(ve.W,{visible:h,onHide:()=>m(!1),buttonTextOnSave:(0,l.t)("Save"),buttonTextOnOverwrite:(0,l.t)("Overwrite"),datasource:(0,fe.z)(a),openWindow:!1,formData:o}),(0,$.tZ)(at.Z,_()({},n,{name:"datasource",actions:s})),null!=a.id&&D)}var jt=a(28062),Lt=a(41609),qt=a.n(Lt),Ft=a(18446),Pt=a.n(Ft),Qt=a(88306),Vt=a.n(Qt),Kt=a(38575),Bt=a(92252);const Ht=Vt()(((e,t)=>{const a={};return((null==t?void 0:t.controlPanelSections)||[]).filter(Kt.D_).forEach((e=>{e.controlSetRows.forEach((e=>{e.forEach((e=>{e&&("string"==typeof e?a[e]=Bt.ai[e]:e.name&&e.config&&(a[e.name]=e.config))}))}))})),a}));var Wt=a(9679),Yt=a(1304),Gt=a(76962);const Jt={origFormData:D().object.isRequired,currentFormData:D().object.isRequired},Xt=I.iK.span`
  ${e=>{let{theme:t}=e;return`\n    font-size: ${t.typography.sizes.s}px;\n    color: ${t.colors.grayscale.dark1};\n    background-color: ${t.colors.alert.base};\n\n    &: hover {\n      background-color: ${t.colors.alert.dark1};\n    }\n  `}}
`;function ea(e){if(null==e||""===e)return null;if("object"==typeof e){if(Array.isArray(e)&&0===e.length)return null;const t=Object.keys(e);if(t&&0===t.length)return null}return e}class ta extends r.Component{constructor(e){super(e);const t=this.getDiffs(e),a=(e=>{const t=(0,He.Z)().get(e);return Ht(e,t)})(this.props.origFormData.viz_type),r=this.getRowsFromDiffs(t,a);this.state={rows:r,hasDiffs:!qt()(t),controlsMap:a}}UNSAFE_componentWillReceiveProps(e){if(Pt()(this.props,e))return;const t=this.getDiffs(e);this.setState((e=>({rows:this.getRowsFromDiffs(t,e.controlsMap),hasDiffs:!qt()(t)})))}getRowsFromDiffs(e,t){return Object.entries(e).map((e=>{let[a,r]=e;return{control:t[a]&&t[a].label||a,before:this.formatValue(r.before,a,t),after:this.formatValue(r.after,a,t)}}))}getDiffs(e){const t=(0,J.BR)(e.origFormData),a=(0,J.BR)(e.currentFormData),r=Object.keys(a),o={};return r.forEach((e=>{var r;(t[e]||a[e])&&(E()(r=["filters","having","having_filters","where"]).call(r,e)||this.isEqualish(t[e],a[e])||(o[e]={before:t[e],after:a[e]}))})),o}isEqualish(e,t){return Pt()(ea(e),ea(t))}formatValue(e,t,a){var r,o,n,s;if(void 0===e)return"N/A";if(null===e)return"null";if("AdhocFilterControl"===(null==(r=a[t])?void 0:r.type))return e.length?e.map((e=>{const t=e.comparator&&e.comparator.constructor===Array?`[${e.comparator.join(", ")}]`:e.comparator;return`${e.subject} ${e.operator} ${t}`})).join(", "):"[]";if("BoundsControl"===(null==(o=a[t])?void 0:o.type))return`Min: ${e[0]}, Max: ${e[1]}`;if("CollectionControl"===(null==(n=a[t])?void 0:n.type))return e.map((e=>(0,Wt.o)(e))).join(", ");if("MetricsControl"===(null==(s=a[t])?void 0:s.type)&&e.constructor===Array){const t=e.map((e=>{var t;return null!=(t=null==e?void 0:e.label)?t:e}));return t.length?t.join(", "):"[]"}if("boolean"==typeof e)return e?"true":"false";if(e.constructor===Array){const t=e.map((e=>{var t;return null!=(t=null==e?void 0:e.label)?t:e}));return t.length?t.join(", "):"[]"}return"string"==typeof e||"number"==typeof e?e:(0,Wt.o)(e)}renderModalBody(){const e=[{accessor:"control",Header:(0,l.t)("Control")},{accessor:"before",Header:(0,l.t)("Before")},{accessor:"after",Header:(0,l.t)("After")}];return(0,$.tZ)(Gt.Z,{columns:e,data:this.state.rows,pageSize:50,className:"table-condensed",columnsForWrapText:["Control","Before","After"]})}renderTriggerNode(){return(0,$.tZ)(z.u,{id:"difference-tooltip",title:(0,l.t)("Click to see difference")},(0,$.tZ)(Xt,{className:"label"},(0,l.t)("Altered")))}render(){return this.state.hasDiffs?(0,$.tZ)(Yt.Z,{triggerNode:this.renderTriggerNode(),modalTitle:(0,l.t)("Chart changes"),modalBody:this.renderModalBody(),responsive:!0}):null}}ta.propTypes=Jt;var aa=a(83673),ra=a(52564),oa=a(59507),na=a(96022);const sa={actions:D().object.isRequired,canOverwrite:D().bool.isRequired,canDownload:D().bool.isRequired,dashboardId:D().number,isStarred:D().bool.isRequired,slice:D().object,sliceName:D().string,table_name:D().string,formData:D().object,ownState:D().object,timeout:D().number,chart:Y.$6,saveDisabled:D().bool},ia=e=>$.iv`
  color: ${e.colors.primary.dark2};
  & > span[role='img'] {
    margin-right: 0;
  }
`,la=e=>$.iv`
  display: flex;
  align-items: center;
  margin-left: ${e.gridUnit}px;
  & > span {
    margin-right: ${3*e.gridUnit}px;
  }
`,ca=e=>{var t;let{dashboardId:a,slice:n,actions:s,formData:i,ownState:c,chart:d,user:u,canOverwrite:h,canDownload:p,isStarred:m,sliceName:g,saveDisabled:v,metadata:f}=e;const b=(0,o.I0)(),{latestQueryFormData:y,sliceFormData:S}=d,[w,_]=(0,r.useState)(!1);(0,r.useEffect)((()=>{a&&(async()=>{const{dashboards:e}=f||{},t=a&&e&&e.find((e=>e.id===a));if(t)try{var r;const e=await de.Z.get({endpoint:`/api/v1/dashboard/${t.id}`}),a=null==e||null==(r=e.json)?void 0:r.result,o=JSON.parse(a.json_metadata),n=o.shared_label_colors||{},s=o.label_colors||{},i={...n,...s},l=jt.getNamespace();Object.keys(i).forEach((e=>{l.setColor(e,i[e],o.color_scheme)}))}catch(e){O.Z.info((0,l.t)("Unable to retrieve dashboard colors"))}})()}),[]);const x=(0,r.useCallback)((()=>{b((0,re.setSaveChartModalVisibility)(!0))}),[b]),Z=(0,r.useCallback)((e=>{b((0,ae.sliceUpdated)(e))}),[b]),[C,k,T]=(0,na.gT)(y,p,n,s.redirectSQLLab,(()=>{_(!0)}),c,null==f?void 0:f.dashboards),N=(0,r.useMemo)((()=>{if(!f)return null;const e=[];return e.push({type:oa.pG.DASHBOARDS,title:f.dashboards.length>0?(0,l.tn)("Added to 1 dashboard","Added to %s dashboards",f.dashboards.length,f.dashboards.length):(0,l.t)("Not added to any dashboard"),description:f.dashboards.length>0?(0,l.t)("You can preview the list of dashboards in the chart settings dropdown."):void 0}),e.push({type:oa.pG.LAST_MODIFIED,value:f.changed_on_humanized,modifiedBy:f.changed_by||(0,l.t)("Not available")}),e.push({type:oa.pG.OWNER,createdBy:f.created_by||(0,l.t)("Not available"),owners:f.owners.length>0?f.owners:(0,l.t)("None"),createdOn:f.created_on_humanized}),null!=n&&n.description&&e.push({type:oa.pG.DESCRIPTION,value:null==n?void 0:n.description}),(0,$.tZ)(oa.ZP,{items:e,tooltipPlacement:"bottom"})}),[f,null==n?void 0:n.description]),D=null==n?void 0:n.slice_name;return(0,$.tZ)(r.Fragment,null,(0,$.tZ)(ra.u,{editableTitleProps:{title:g,canEdit:!n||h||E()(t=(null==n?void 0:n.owners)||[]).call(t,null==u?void 0:u.userId),onSave:s.updateChartTitle,placeholder:(0,l.t)("Add the name of the chart"),label:(0,l.t)("Chart title")},showTitlePanelItems:!!n,certificatiedBadgeProps:{certifiedBy:null==n?void 0:n.certified_by,details:null==n?void 0:n.certification_details},showFaveStar:!(null==u||!u.userId),faveStarProps:{itemId:null==n?void 0:n.slice_id,fetchFaveStar:s.fetchFaveStar,saveFaveStar:s.saveFaveStar,isStarred:m,showTooltip:!0},titlePanelAdditionalItems:(0,$.tZ)("div",{css:la},S?(0,$.tZ)(ta,{className:"altered",origFormData:{...S,chartTitle:D},currentFormData:{...i,chartTitle:g}}):null,N),rightPanelAdditionalItems:(0,$.tZ)(z.u,{title:v?(0,l.t)("Add required control values to save chart"):null},(0,$.tZ)("div",null,(0,$.tZ)(De.Z,{buttonStyle:"secondary",onClick:x,disabled:v,css:ia},(0,$.tZ)(q.Z.SaveOutlined,{iconSize:"l"}),(0,l.t)("Save")))),additionalActionsMenu:C,menuDropdownProps:{visible:k,onVisibleChange:T}}),w&&(0,$.tZ)(aa.Z,{show:w,onHide:()=>{_(!1)},onSave:Z,slice:n}))};ca.propTypes=sa;const da=ca,ua={...Qe.propTypes,actions:D().object.isRequired,datasource_type:D().string.isRequired,dashboardId:D().number,isDatasourceMetaLoading:D().bool.isRequired,chart:Y.$6.isRequired,slice:D().object,sliceName:D().string,controls:D().object.isRequired,forcedHeight:D().string,form_data:D().object.isRequired,standalone:D().bool.isRequired,force:D().bool,timeout:D().number,impressionId:D().string,vizType:D().string,saveAction:D().string,isSaveModalVisible:D().bool},ha=I.iK.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`,pa=I.iK.div`
  ${e=>{let{theme:t}=e;return $.iv`
    background: ${t.colors.grayscale.light5};
    text-align: left;
    position: relative;
    width: 100%;
    max-height: 100%;
    min-height: 0;
    display: flex;
    flex: 1;
    flex-wrap: nowrap;
    border-top: 1px solid ${t.colors.grayscale.light2};
    .explore-column {
      display: flex;
      flex-direction: column;
      padding: ${2*t.gridUnit}px 0;
      max-height: 100%;
    }
    .data-source-selection {
      background-color: ${t.colors.grayscale.light5};
      padding: ${2*t.gridUnit}px 0;
      border-right: 1px solid ${t.colors.grayscale.light2};
    }
    .main-explore-content {
      flex: 1;
      min-width: ${128*t.gridUnit}px;
      border-left: 1px solid ${t.colors.grayscale.light2};
      padding: 0 ${4*t.gridUnit}px;
      .panel {
        margin-bottom: 0;
      }
    }
    .controls-column {
      align-self: flex-start;
      padding: 0;
    }
    .title-container {
      position: relative;
      display: flex;
      flex-direction: row;
      padding: 0 ${2*t.gridUnit}px 0 ${4*t.gridUnit}px;
      justify-content: space-between;
      .horizontal-text {
        font-size: ${t.typography.sizes.m}px;
      }
    }
    .no-show {
      display: none;
    }
    .vertical-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .sidebar {
      height: 100%;
      background-color: ${t.colors.grayscale.light4};
      padding: ${2*t.gridUnit}px;
      width: ${8*t.gridUnit}px;
    }
    .collapse-icon > svg {
      color: ${t.colors.primary.base};
    }
  `}};
`,ma=k()((async(e,t,a,r,o,n,s,i)=>{const l={...e},c=e.slice_id,d=new URLSearchParams(window.location.search),u=Object.fromEntries(d);c?u[p.KD.sliceId.name]=c:(u[p.KD.datasourceId.name]=t,u[p.KD.datasourceType.name]=a);const m=(null==l?void 0:l.url_params)||{};Object.entries(m).forEach((e=>{let[t,a]=e;E()(p.$O).call(p.$O,t)||(u[t]=a)}));try{let d,m;if(r?(d=await(0,J.nv)(t,a,e,c,i),m="replaceState"):(d=(0,h.eY)(p.KD.formDataKey),await(0,J.LW)(t,a,d,e,c,i),m="pushState"),window.location.pathname.startsWith("/explore")){const e=(0,ee.y8)(o?p.KD.standalone.name:null,{[p.KD.formDataKey.name]:d,...u},n);window.history[m](l,s,e)}}catch(e){O.Z.warn("Failed at altering browser history",e)}}),1e3);function ga(e){const t=(0,U.gp)().dynamicPlugins[e.vizType],a=t&&t.mounting,o=(0,j.D)(a),n=(0,j.D)(e.controls),[s,i]=(0,r.useState)(e.controls),[c,d]=(0,r.useState)(!1),[u,h]=(0,r.useState)(-1),p=(0,oe.z)(),m=(0,I.Fg)(),g={controls_width:320,datasource_width:300},v=(0,r.useCallback)((async function(t){let{isReplace:a=!1,title:r}=void 0===t?{}:t;const o=e.dashboardId?{...e.form_data,dashboardId:e.dashboardId}:e.form_data,{id:n,type:s}=e.datasource;ma(o,n,s,a,e.standalone,e.force,r,p)}),[e.dashboardId,e.form_data,e.datasource.id,e.datasource.type,e.standalone,e.force,p]),f=(0,r.useCallback)((()=>{const t=window.history.state;t&&Object.keys(t).length&&(e.actions.setExploreControls(t),e.actions.postChartFormData(t,e.force,e.timeout,e.chart.id))}),[e.actions,e.chart.id,e.timeout]),b=(0,r.useCallback)((()=>{e.actions.setForceQuery(!1),e.actions.triggerQuery(!0,e.chart.id),v(),i(e.controls)}),[e.controls,v,e.actions,e.chart.id]),y=(0,r.useCallback)((t=>{if(t.ctrlKey||t.metaKey){const a="Enter"===t.key||13===t.keyCode,r="s"===t.key||83===t.keyCode;a?b():r&&e.slice&&e.actions.saveSlice(e.form_data,{action:"overwrite",slice_id:e.slice.slice_id,slice_name:e.slice.slice_name,add_to_dash:"noSave",goto_dash:!1}).then((e=>{let{data:t}=e;window.location=t.slice.slice_url}))}}),[b,e.actions,e.form_data,e.slice]);function S(){d(!c)}(0,L.J)((()=>{e.actions.logEvent(V.$b)})),(0,M.S)(p,((e,t)=>{t&&v({isReplace:!0})}));const w=(0,j.D)(f);(0,r.useEffect)((()=>(w&&window.removeEventListener("popstate",w),window.addEventListener("popstate",f),()=>{window.removeEventListener("popstate",f)})),[f,w]);const x=(0,j.D)(y);(0,r.useEffect)((()=>(x&&window.removeEventListener("keydown",x),document.addEventListener("keydown",y),()=>{document.removeEventListener("keydown",y)})),[y,x]),(0,r.useEffect)((()=>{o&&!a&&e.actions.dynamicPluginControlsReady()}),[a]),(0,r.useEffect)((()=>{Object.values(e.controls).some((e=>e.validationErrors&&e.validationErrors.length>0))||e.actions.triggerQuery(!0,e.chart.id)}),[]);const C=(0,r.useCallback)((t=>{const a=t?{...e.chart.latestQueryFormData,...(0,te.Hu)(Z()(e.controls,t))}:(0,te.Hu)(e.controls);e.actions.updateQueryFormData(a,e.chart.id),e.actions.renderTriggered((new Date).getTime(),e.chart.id),v()}),[v,e.actions,e.chart.id,e.chart.latestQueryFormData,e.controls]);(0,r.useEffect)((()=>{if(n&&e.chart.latestQueryFormData.viz_type===e.controls.viz_type.value){!e.controls.datasource||null!=n.datasource&&e.controls.datasource.value===n.datasource.value||(0,W.QR)(e.form_data.datasource,!0);const t=Object.keys(e.controls).filter((t=>void 0!==n[t]&&!(0,P.JB)(e.controls[t].value,n[t].value))).filter((t=>e.controls[t].renderTrigger));t.length>0&&C(t)}}),[e.controls,e.ownState]);const k=(0,r.useMemo)((()=>!!s&&Object.keys(e.controls).filter((t=>void 0!==s[t]&&!(0,P.JB)(e.controls[t].value,s[t].value,{ignoreFields:["datasourceWarning"]}))).some((t=>!e.controls[t].renderTrigger&&!e.controls[t].dontRefreshOnChange))),[s,e.controls]);(0,M.S)(e.saveAction,(()=>{var t;E()(t=["saveas","overwrite"]).call(t,e.saveAction)&&(b(),v({isReplace:!0}),e.actions.setSaveAction(null))})),(0,r.useEffect)((()=>{void 0!==e.ownState&&(b(),C())}),[e.ownState]),k&&e.actions.logEvent(V.Ep);const T=(0,r.useMemo)((()=>{const t=Object.values(e.controls).filter((e=>e.validationErrors&&e.validationErrors.length>0));if(0===t.length)return null;const a=t.map((e=>e.validationErrors)),r=[...new Set(a.flat())].map((e=>[t.filter((t=>{var a;return null==(a=t.validationErrors)?void 0:E()(a).call(a,e)})).map((e=>e.label)),e])).map((e=>{let[t,a]=e;return(0,$.tZ)("div",{key:a},t.length>1?(0,l.t)("Controls labeled "):(0,l.t)("Control labeled "),(0,$.tZ)("strong",null,` ${t.join(", ")}`),(0,$.tZ)("span",null,": ",a))}));let o;return r.length>0&&(o=(0,$.tZ)("div",{style:{textAlign:"left"}},r)),o}),[e.controls]);function N(){return(0,$.tZ)(Qe,_()({},e,{errorMessage:T,chartIsStale:k,onQuery:b}))}function D(e){return(0,F.rV)(e,g[e])}function A(e,t){const a=Number(D(e))+t.width;(0,F.LS)(e,a)}return e.standalone?N():(0,$.tZ)(ha,null,(0,$.tZ)(da,{actions:e.actions,canOverwrite:e.can_overwrite,canDownload:e.can_download,dashboardId:e.dashboardId,isStarred:e.isStarred,slice:e.slice,sliceName:e.sliceName,table_name:e.table_name,formData:e.form_data,chart:e.chart,ownState:e.ownState,user:e.user,reports:e.reports,saveDisabled:T||"loading"===e.chart.chartStatus,metadata:e.metadata}),(0,$.tZ)(pa,{id:"explore-container"},(0,$.tZ)($.xB,{styles:$.iv`
            .navbar {
              margin-bottom: 0;
            }
            body {
              height: 100vh;
              max-height: 100vh;
              overflow: hidden;
            }
            #app-menu,
            #app {
              flex: 1 1 auto;
            }
            #app {
              flex-basis: 100%;
              overflow: hidden;
              height: 100%;
            }
            #app-menu {
              flex-shrink: 0;
            }
          `}),(0,$.tZ)(R.e,{onResizeStop:(e,t,a,r)=>{h(null==r?void 0:r.width),A(F.dR.datasource_width,r)},defaultSize:{width:D(F.dR.datasource_width),height:"100%"},minWidth:g[F.dR.datasource_width],maxWidth:"33%",enable:{right:!0},className:c?"no-show":"explore-column data-source-selection"},(0,$.tZ)("div",{className:"title-container"},(0,$.tZ)("span",{className:"horizontal-text"},(0,l.t)("Chart Source")),(0,$.tZ)("span",{role:"button",tabIndex:0,className:"action-button",onClick:S},(0,$.tZ)(q.Z.Expand,{className:"collapse-icon",iconColor:m.colors.primary.base,iconSize:"l"}))),(0,$.tZ)(zt,{formData:e.form_data,datasource:e.datasource,controls:e.controls,actions:e.actions,shouldForceUpdate:u,user:e.user})),c?(0,$.tZ)("div",{className:"sidebar",onClick:S,role:"button",tabIndex:0},(0,$.tZ)("span",{role:"button",tabIndex:0,className:"action-button"},(0,$.tZ)(z.u,{title:(0,l.t)("Open Datasource tab")},(0,$.tZ)(q.Z.Collapse,{className:"collapse-icon",iconColor:m.colors.primary.base,iconSize:"l"})))):null,(0,$.tZ)(R.e,{onResizeStop:(e,t,a,r)=>A(F.dR.controls_width,r),defaultSize:{width:D(F.dR.controls_width),height:"100%"},minWidth:g[F.dR.controls_width],maxWidth:"33%",enable:{right:!0},className:"col-sm-3 explore-column controls-column"},(0,$.tZ)(ht,{exploreState:e.exploreState,actions:e.actions,form_data:e.form_data,controls:e.controls,chart:e.chart,datasource_type:e.datasource_type,isDatasourceMetaLoading:e.isDatasourceMetaLoading,onQuery:b,onStop:function(){e.chart&&e.chart.queryController&&e.chart.queryController.abort()},canStopQuery:e.can_add||e.can_overwrite,errorMessage:T,chartIsStale:k})),(0,$.tZ)("div",{className:B()("main-explore-content",c?"col-sm-9":"col-sm-7")},N())),e.isSaveModalVisible&&(0,$.tZ)(wt,{addDangerToast:e.addDangerToast,actions:e.actions,form_data:e.form_data,sliceName:e.sliceName,dashboardId:e.dashboardId}))}ga.propTypes=ua;const va=(0,o.$j)((function(e){var t,a,r,o,n,s,i,l;const{explore:c,charts:d,common:u,impressionId:h,dataMask:p,reports:m,user:g,saveModal:v}=e,{controls:f,slice:b,datasource:y,metadata:S}=c,w=(0,te.Hu)(f),_=null!=(t=null!=(a=w.slice_id)?a:null==b?void 0:b.slice_id)?t:0;w.extra_form_data=(0,G.on)({...w.extra_form_data},{...null==(r=p[_])?void 0:r.ownState});const x=d[_];let Z=Number(null==(o=c.form_data)?void 0:o.dashboardId);return Number.isNaN(Z)&&(Z=void 0),{isDatasourceMetaLoading:c.isDatasourceMetaLoading,datasource:y,datasource_type:y.type,datasourceId:y.datasource_id,dashboardId:Z,controls:c.controls,can_add:!!c.can_add,can_download:!!c.can_download,can_overwrite:!!c.can_overwrite,column_formats:null!=(n=null==y?void 0:y.column_formats)?n:null,containerId:b?`slice-container-${b.slice_id}`:"slice-container",isStarred:c.isStarred,slice:b,sliceName:null!=(s=null!=(i=c.sliceName)?i:null==b?void 0:b.slice_name)?s:null,triggerRender:c.triggerRender,form_data:w,table_name:y.table_name,vizType:w.viz_type,standalone:!!c.standalone,force:!!c.force,chart:x,timeout:u.conf.SUPERSET_WEBSERVER_TIMEOUT,ownState:null==(l=p[_])?void 0:l.ownState,impressionId:h,user:g,exploreState:c,reports:m,metadata:S,saveAction:c.saveAction,isSaveModalVisible:v.isVisible}}),(function(e){const t={...ae,...X.yn,...re,...H,...Q};return{actions:(0,A.DE)(t,e)}}))((0,ne.ZP)(r.memo(ga)));a(65634);(0,l.t)("Chart Options"),(0,l.t)("Use Area Proportions"),(0,l.t)("Check if the Rose Chart should use segment area instead of segment radius for proportioning"),(0,l.t)("Stacked Style"),(0,l.t)("stack"),(0,l.t)("stream"),(0,l.t)("expand"),(0,l.t)("Chart Options"),(0,l.t)("Chart Options"),(0,l.t)("Columns"),(0,l.t)("Columns to display"),le.i9.Table;const fa={form_data:{datasource:"0__table",viz_type:"table"},dataset:{id:0,type:le.i9.Table,columns:[],metrics:[],column_format:{},verbose_map:{},main_dttm_col:"",owners:[],datasource_name:"missing_datasource",name:"missing_datasource",description:null},slice:null};var ba=a(46306);const ya=function(e,t){void 0===t&&(t="where");const a={clause:t.toUpperCase(),expressionType:"SIMPLE",operator:e.op,subject:e.col,comparator:"val"in e?e.val:void 0};return e.isExtra&&Object.assign(a,{isExtra:!0,filterOptionName:`filter_${Math.random().toString(36).substring(2,15)}_${Math.random().toString(36).substring(2,15)}`}),a},Sa=(e,t)=>{const a=e.extra_form_data||{};return"time_range"in a?t.map((e=>"TEMPORAL_RANGE"===e.operator?{...e,comparator:a.time_range,isExtra:!0}:e)):t};function wa(){const[e,t]=(0,r.useState)(!1),a=(0,r.useRef)(!1),f=(0,o.I0)(),w=(0,n.TH)();return(0,r.useEffect)((()=>{const e=function(e){return void 0===e&&(e=window.location),new URLSearchParams(Object.entries({...y(e.search),...(t=e.pathname,Object.keys(b).reduce(((e,a)=>{const r=new RegExp(`/(${a})/(\\w+)`),o=t.match(r);return null!=o&&o[2]?{...e,[b[a]]:o[2]}:e}),{}))}).map((e=>e.join("="))).join("&"));var t}(w),r=(0,h.eY)(p.KD.saveAction),o=(()=>{const e=(t=(0,h.eY)(p.KD.dashboardPageId))&&(0,F.rV)(F.dR.dashboard__explore_context,{})[t]||null;var t;if(e){const t=(0,h.eY)(p.KD.sliceId)||0,{labelColors:a,sharedLabelColors:r,colorScheme:o,chartConfiguration:n,nativeFilters:s,filterBoxFilters:i,dataMask:l,dashboardId:c}=e,d=(0,g.Z)({chart:{id:t},filters:(0,v._f)(t,i),nativeFilters:s,chartConfiguration:n,colorScheme:o,dataMask:l,labelColors:a,sharedLabelColors:r,sliceId:t,allSliceIds:[t],extraControls:{}});return Object.assign(d,{dashboardId:c}),d}return null})();a.current&&!r||(async e=>{try{var t;const a=await(0,i.Z)({method:"GET",endpoint:"api/v1/explore/"})(e);if((e=>{var t,a,r;return(null==e||null==(t=e.result)?void 0:t.form_data)&&(0,s.Z)(null==e||null==(a=e.result)||null==(r=a.dataset)?void 0:r.id)})(a))return a;let r=(0,l.t)("Failed to load chart data");const o=null==a||null==(t=a.result)?void 0:t.message;throw o&&(r=`${r}:\n${o}`),new Error(r)}catch(e){const t=await(0,m.O$)(e);throw new Error(t.message||t.error||(0,l.t)("Failed to load chart data."))}})(e).then((e=>{let{result:t}=e;const a=o?((e,t)=>{const a=((e,t)=>{const a={__time_range:"time_range",__time_col:"granularity_sqla",__time_grain:"time_grain_sqla",__granularity:"granularity"},r={},o={};return(0,ce.Z)(t.extra_filters).forEach((e=>{if(a[e.col])e.val!==Be.vM&&(o[a[e.col]]=e.val,r[e.col]=e.val);else{const t=ya({...e,isExtra:!0});o.adhoc_filters=[...(0,ce.Z)(o.adhoc_filters),t]}})),o.applied_time_extras=r,o})(0,t),r=((e,t)=>{const a={},r=t.extra_form_data||{};Object.entries(Be.gn).forEach((e=>{let[t,o]=e;const n=r[t];(0,s.Z)(n)&&(a[o]=n)})),"time_grain_sqla"in r&&(a.time_grain_sqla=r.time_grain_sqla),"granularity_sqla"in r&&(a.granularity_sqla=r.granularity_sqla);const o=t.extras||{};Be.fn.forEach((e=>{const t=r[e];(0,s.Z)(t)&&(o[e]=t)})),Object.keys(o).length&&(a.extras=o),a.adhoc_filters=(0,ce.Z)(r.adhoc_filters).map((e=>({...e,isExtra:!0})));const n=(0,ce.Z)(r.filters).map((e=>ya({...e,isExtra:!0})));return Object.keys(e).forEach((e=>{e.match(/adhoc_filter.*/)&&(a[e]=[...(0,ce.Z)(a[e]),...n])})),a})(e,t),o=[...Object.keys(e),...Object.keys(a),...Object.keys(r)].filter((e=>e.match(/adhoc_filter.*/))).reduce(((o,n)=>{return{...o,[n]:Sa(t,(s=[...(0,ce.Z)(e[n]),...(0,ce.Z)(a[n]),...(0,ce.Z)(r[n])],s.reduce(((e,t)=>{var a;return a=t,e.some((e=>(0,ba.jz)(e)&&(0,ba.jz)(a)&&e.clause===a.clause&&e.sqlExpression===a.sqlExpression||(0,ba.Ki)(e)&&(0,ba.Ki)(a)&&e.operator===a.operator&&e.subject===a.subject&&(!("comparator"in e)&&!("comparator"in a)||"comparator"in e&&"comparator"in a&&Pt()(e.comparator,a.comparator))))||e.push(t),e}),[])))};var s}),{});return{...e,...t,...a,...r,...o}})(t.form_data,o):t.form_data;f((0,S.u)({...t,form_data:a,saveAction:r}))})).catch((e=>{f((0,S.u)(fa)),f((0,u.Gb)(e.message))})).finally((()=>{t(!0),a.current=!0})),(0,c.ZP)().source=c.Ag.explore}),[f,w]),e?(0,$.tZ)(va,null):(0,$.tZ)(d.Z,null)}}}]);
//# sourceMappingURL=46f7800ea580dc216e4d.chunk.js.map
