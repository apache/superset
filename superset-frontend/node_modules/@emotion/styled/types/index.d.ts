// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.8

import {
  CreateStyled as BaseCreateStyled,
  CreateStyledComponentIntrinsic
} from '@emotion/styled-base'

export {
  ArrayInterpolation,
  ComponentSelector,
  CreateStyledComponentBase,
  CreateStyledComponentExtrinsic,
  CreateStyledComponentIntrinsic,
  CSSObject,
  FunctionInterpolation,
  Interpolation,
  ObjectInterpolation,
  StyledComponent,
  StyledOptions,
  WithTheme
} from '@emotion/styled-base'

export interface StyledTags<Theme extends object> {
  /**
   * @desc
   * HTML tags
   */
  a: CreateStyledComponentIntrinsic<'a', {}, Theme>
  abbr: CreateStyledComponentIntrinsic<'abbr', {}, Theme>
  address: CreateStyledComponentIntrinsic<'address', {}, Theme>
  area: CreateStyledComponentIntrinsic<'area', {}, Theme>
  article: CreateStyledComponentIntrinsic<'article', {}, Theme>
  aside: CreateStyledComponentIntrinsic<'aside', {}, Theme>
  audio: CreateStyledComponentIntrinsic<'audio', {}, Theme>
  b: CreateStyledComponentIntrinsic<'b', {}, Theme>
  base: CreateStyledComponentIntrinsic<'base', {}, Theme>
  bdi: CreateStyledComponentIntrinsic<'bdi', {}, Theme>
  bdo: CreateStyledComponentIntrinsic<'bdo', {}, Theme>
  big: CreateStyledComponentIntrinsic<'big', {}, Theme>
  blockquote: CreateStyledComponentIntrinsic<'blockquote', {}, Theme>
  body: CreateStyledComponentIntrinsic<'body', {}, Theme>
  br: CreateStyledComponentIntrinsic<'br', {}, Theme>
  button: CreateStyledComponentIntrinsic<'button', {}, Theme>
  canvas: CreateStyledComponentIntrinsic<'canvas', {}, Theme>
  caption: CreateStyledComponentIntrinsic<'caption', {}, Theme>
  cite: CreateStyledComponentIntrinsic<'cite', {}, Theme>
  code: CreateStyledComponentIntrinsic<'code', {}, Theme>
  col: CreateStyledComponentIntrinsic<'col', {}, Theme>
  colgroup: CreateStyledComponentIntrinsic<'colgroup', {}, Theme>
  data: CreateStyledComponentIntrinsic<'data', {}, Theme>
  datalist: CreateStyledComponentIntrinsic<'datalist', {}, Theme>
  dd: CreateStyledComponentIntrinsic<'dd', {}, Theme>
  del: CreateStyledComponentIntrinsic<'del', {}, Theme>
  details: CreateStyledComponentIntrinsic<'details', {}, Theme>
  dfn: CreateStyledComponentIntrinsic<'dfn', {}, Theme>
  dialog: CreateStyledComponentIntrinsic<'dialog', {}, Theme>
  div: CreateStyledComponentIntrinsic<'div', {}, Theme>
  dl: CreateStyledComponentIntrinsic<'dl', {}, Theme>
  dt: CreateStyledComponentIntrinsic<'dt', {}, Theme>
  em: CreateStyledComponentIntrinsic<'em', {}, Theme>
  embed: CreateStyledComponentIntrinsic<'embed', {}, Theme>
  fieldset: CreateStyledComponentIntrinsic<'fieldset', {}, Theme>
  figcaption: CreateStyledComponentIntrinsic<'figcaption', {}, Theme>
  figure: CreateStyledComponentIntrinsic<'figure', {}, Theme>
  footer: CreateStyledComponentIntrinsic<'footer', {}, Theme>
  form: CreateStyledComponentIntrinsic<'form', {}, Theme>
  h1: CreateStyledComponentIntrinsic<'h1', {}, Theme>
  h2: CreateStyledComponentIntrinsic<'h2', {}, Theme>
  h3: CreateStyledComponentIntrinsic<'h3', {}, Theme>
  h4: CreateStyledComponentIntrinsic<'h4', {}, Theme>
  h5: CreateStyledComponentIntrinsic<'h5', {}, Theme>
  h6: CreateStyledComponentIntrinsic<'h6', {}, Theme>
  head: CreateStyledComponentIntrinsic<'head', {}, Theme>
  header: CreateStyledComponentIntrinsic<'header', {}, Theme>
  hgroup: CreateStyledComponentIntrinsic<'hgroup', {}, Theme>
  hr: CreateStyledComponentIntrinsic<'hr', {}, Theme>
  html: CreateStyledComponentIntrinsic<'html', {}, Theme>
  i: CreateStyledComponentIntrinsic<'i', {}, Theme>
  iframe: CreateStyledComponentIntrinsic<'iframe', {}, Theme>
  img: CreateStyledComponentIntrinsic<'img', {}, Theme>
  input: CreateStyledComponentIntrinsic<'input', {}, Theme>
  ins: CreateStyledComponentIntrinsic<'ins', {}, Theme>
  kbd: CreateStyledComponentIntrinsic<'kbd', {}, Theme>
  keygen: CreateStyledComponentIntrinsic<'keygen', {}, Theme>
  label: CreateStyledComponentIntrinsic<'label', {}, Theme>
  legend: CreateStyledComponentIntrinsic<'legend', {}, Theme>
  li: CreateStyledComponentIntrinsic<'li', {}, Theme>
  link: CreateStyledComponentIntrinsic<'link', {}, Theme>
  main: CreateStyledComponentIntrinsic<'main', {}, Theme>
  map: CreateStyledComponentIntrinsic<'map', {}, Theme>
  mark: CreateStyledComponentIntrinsic<'mark', {}, Theme>
  /**
   * @desc
   * marquee tag is not supported by @types/react
   */
  // 'marquee': CreateStyledComponentIntrinsic<'marquee', {}, Theme>;
  menu: CreateStyledComponentIntrinsic<'menu', {}, Theme>
  menuitem: CreateStyledComponentIntrinsic<'menuitem', {}, Theme>
  meta: CreateStyledComponentIntrinsic<'meta', {}, Theme>
  meter: CreateStyledComponentIntrinsic<'meter', {}, Theme>
  nav: CreateStyledComponentIntrinsic<'nav', {}, Theme>
  noscript: CreateStyledComponentIntrinsic<'noscript', {}, Theme>
  object: CreateStyledComponentIntrinsic<'object', {}, Theme>
  ol: CreateStyledComponentIntrinsic<'ol', {}, Theme>
  optgroup: CreateStyledComponentIntrinsic<'optgroup', {}, Theme>
  option: CreateStyledComponentIntrinsic<'option', {}, Theme>
  output: CreateStyledComponentIntrinsic<'output', {}, Theme>
  p: CreateStyledComponentIntrinsic<'p', {}, Theme>
  param: CreateStyledComponentIntrinsic<'param', {}, Theme>
  picture: CreateStyledComponentIntrinsic<'picture', {}, Theme>
  pre: CreateStyledComponentIntrinsic<'pre', {}, Theme>
  progress: CreateStyledComponentIntrinsic<'progress', {}, Theme>
  q: CreateStyledComponentIntrinsic<'q', {}, Theme>
  rp: CreateStyledComponentIntrinsic<'rp', {}, Theme>
  rt: CreateStyledComponentIntrinsic<'rt', {}, Theme>
  ruby: CreateStyledComponentIntrinsic<'ruby', {}, Theme>
  s: CreateStyledComponentIntrinsic<'s', {}, Theme>
  samp: CreateStyledComponentIntrinsic<'samp', {}, Theme>
  script: CreateStyledComponentIntrinsic<'script', {}, Theme>
  section: CreateStyledComponentIntrinsic<'section', {}, Theme>
  select: CreateStyledComponentIntrinsic<'select', {}, Theme>
  small: CreateStyledComponentIntrinsic<'small', {}, Theme>
  source: CreateStyledComponentIntrinsic<'source', {}, Theme>
  span: CreateStyledComponentIntrinsic<'span', {}, Theme>
  strong: CreateStyledComponentIntrinsic<'strong', {}, Theme>
  style: CreateStyledComponentIntrinsic<'style', {}, Theme>
  sub: CreateStyledComponentIntrinsic<'sub', {}, Theme>
  summary: CreateStyledComponentIntrinsic<'summary', {}, Theme>
  sup: CreateStyledComponentIntrinsic<'sup', {}, Theme>
  table: CreateStyledComponentIntrinsic<'table', {}, Theme>
  tbody: CreateStyledComponentIntrinsic<'tbody', {}, Theme>
  td: CreateStyledComponentIntrinsic<'td', {}, Theme>
  textarea: CreateStyledComponentIntrinsic<'textarea', {}, Theme>
  tfoot: CreateStyledComponentIntrinsic<'tfoot', {}, Theme>
  th: CreateStyledComponentIntrinsic<'th', {}, Theme>
  thead: CreateStyledComponentIntrinsic<'thead', {}, Theme>
  time: CreateStyledComponentIntrinsic<'time', {}, Theme>
  title: CreateStyledComponentIntrinsic<'title', {}, Theme>
  tr: CreateStyledComponentIntrinsic<'tr', {}, Theme>
  track: CreateStyledComponentIntrinsic<'track', {}, Theme>
  u: CreateStyledComponentIntrinsic<'u', {}, Theme>
  ul: CreateStyledComponentIntrinsic<'ul', {}, Theme>
  var: CreateStyledComponentIntrinsic<'var', {}, Theme>
  video: CreateStyledComponentIntrinsic<'video', {}, Theme>
  wbr: CreateStyledComponentIntrinsic<'wbr', {}, Theme>

  /**
   * @desc
   * SVG tags
   */
  circle: CreateStyledComponentIntrinsic<'circle', {}, Theme>
  clipPath: CreateStyledComponentIntrinsic<'clipPath', {}, Theme>
  defs: CreateStyledComponentIntrinsic<'defs', {}, Theme>
  ellipse: CreateStyledComponentIntrinsic<'ellipse', {}, Theme>
  foreignObject: CreateStyledComponentIntrinsic<'foreignObject', {}, Theme>
  g: CreateStyledComponentIntrinsic<'g', {}, Theme>
  image: CreateStyledComponentIntrinsic<'image', {}, Theme>
  line: CreateStyledComponentIntrinsic<'line', {}, Theme>
  linearGradient: CreateStyledComponentIntrinsic<'linearGradient', {}, Theme>
  mask: CreateStyledComponentIntrinsic<'mask', {}, Theme>
  path: CreateStyledComponentIntrinsic<'path', {}, Theme>
  pattern: CreateStyledComponentIntrinsic<'pattern', {}, Theme>
  polygon: CreateStyledComponentIntrinsic<'polygon', {}, Theme>
  polyline: CreateStyledComponentIntrinsic<'polyline', {}, Theme>
  radialGradient: CreateStyledComponentIntrinsic<'radialGradient', {}, Theme>
  rect: CreateStyledComponentIntrinsic<'rect', {}, Theme>
  stop: CreateStyledComponentIntrinsic<'stop', {}, Theme>
  svg: CreateStyledComponentIntrinsic<'svg', {}, Theme>
  text: CreateStyledComponentIntrinsic<'text', {}, Theme>
  tspan: CreateStyledComponentIntrinsic<'tspan', {}, Theme>
}

export interface CreateStyled<Theme extends object = any>
  extends BaseCreateStyled<Theme>,
    StyledTags<Theme> {}

declare const styled: CreateStyled
export default styled
