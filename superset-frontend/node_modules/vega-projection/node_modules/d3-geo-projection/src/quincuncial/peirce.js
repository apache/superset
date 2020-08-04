import {guyouRaw} from "../guyou.js";
import quincuncial from "./index.js";

export default function() {
  return quincuncial(guyouRaw)
      .scale(111.48);
}
