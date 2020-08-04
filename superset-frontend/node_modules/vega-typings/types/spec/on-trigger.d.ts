import { Expr } from '.';

export interface OnTrigger {
  trigger: Expr;
  insert?: Expr;
  remove?: boolean | Expr;
  toggle?: Expr;
  modify?: Expr;
  values?: Expr;
}
export interface OnMarkTrigger {
  trigger: Expr;
  modify?: Expr;
  values?: Expr;
}
