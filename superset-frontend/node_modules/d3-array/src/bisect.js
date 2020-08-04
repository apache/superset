import ascending from "./ascending";
import bisector from "./bisector";

var ascendingBisect = bisector(ascending);
export var bisectRight = ascendingBisect.right;
export var bisectLeft = ascendingBisect.left;
export default bisectRight;
