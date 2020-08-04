import sparse from "./sparse";
import {Selection} from "./index";

export default function() {
  return new Selection(this._exit || this._groups.map(sparse), this._parents);
}
