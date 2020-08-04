import {gringortenRaw} from "../gringorten.js";
import quincuncial from "./index.js";

export default function() {
  return quincuncial(gringortenRaw)
      .scale(176.423);
}
