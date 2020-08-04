import ascending from "./ascending.js";
import bisector from "./bisector.js";

var ascendingBisect = bisector(ascending);
export var bisectRight = ascendingBisect.right;
export var bisectLeft = ascendingBisect.left;
export default bisectRight;
