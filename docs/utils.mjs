import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const COLOR_COOL = d3.interpolateRgb("#00FFFF", "#FF00FF");
const COLOR_WARM = d3.interpolateRgb("#E4FF7A", "#FC7F00");

// "A", " B (50k)", "M*"
const COOL_RE = /^.(\*| \(.*\))?$/;

const add_spinner = function (selection) {
  /*
   * Use this form if you need to delete the spinner later.
   * const spinner = add_spinner(selection);
   * selection.call(add_spinner) does NOT return the newly add progress
   * [source](https://d3js.org/d3-selection/control-flow#selection_call)
   * The only difference is that selection.call always returns the selection
   * and not the return value of the called function, name.
   */
  selection
    .selectAll("*")
    .remove();
  selection
    .append("div")
    .classed("progress", true)
    .classed("spinner-border", true)
    .classed("text-primary", true)
    .property("role", "status")
    .append("span")
    .classed("visually-hidden", true)
    .text("Loading data and generating graph...")
    ;

  return selection.selectAll("div.progress");
}

const is_cool = (system_id) => COOL_RE.test(system_id);

const partition = (all_system_id, fn) =>
  // Partition the systems into cool and warm colors.
  all_system_id.reduce(
    (acc, val, i, arr) => {
      acc[fn(val, i, arr) ? 0 : 1].add(val);
      return acc;
    },
    [new Set(), new Set()]
  );


export { add_spinner, is_cool, partition, COLOR_COOL, COLOR_WARM, COOL_RE };
