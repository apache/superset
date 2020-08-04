/** @deprecated since v0.30.0, should use <Pager.Item> instead of <PageItem>*/
import PagerItem = require('./PagerItem');
import { PagerItemProps } from './PagerItem';
declare namespace PageItem {
    export type PageItemProps = PagerItemProps;
}
declare class PageItem extends PagerItem { }
export = PageItem;
