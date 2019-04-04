import {selection} from "d3-selection";
import selection_interrupt from "./interrupt";
import selection_transition from "./transition";

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;
