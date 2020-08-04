export declare type Item = any;
export declare type Comparator<Item> = (a: Item, b: Item) => number;

export default class TinyQueue<Item> {
  public data : Item[];
  public length : number;
  constructor (items? : Item[], compare? : Comparator<Item>);
  peek () : Item | undefined;
  pop () : Item | undefined;
  push (item: Item) : void;
}
