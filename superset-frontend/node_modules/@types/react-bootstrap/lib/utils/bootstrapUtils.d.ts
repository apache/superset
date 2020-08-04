interface BSProps {
  bsClass: any;
  bsSize: any;
  bsStyle: any;
  bsRole: any;
}

export function prefix(props: { bsClass?: any }, variant?: string): string;
export function bsClass(defaultClass: any, Component: any): any;
export function bsStyles(styles: any, defaultStyle: any, Component: any): any;
export function bsSizes(sizes: any, defaultSize: any, Component: any): any;
export function getClassSet(props: any): any;
export function getBsProps(props: any): BSProps;
export function isBsProp(propName: string): boolean;
export function splitBsProps(props: any): [BSProps, any];
export function splitBsPropsAndOmit(props: any, omittedPropNames: any): [BSProps, any];
export function addStyle(Component: any, ...styleVariant: any[]): any;
// TODO: export function _curry
