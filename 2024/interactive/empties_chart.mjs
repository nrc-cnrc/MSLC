import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
import htl from "https://cdn.jsdelivr.net/npm/htl@0.3.1/+esm";
import { add_spinner } from "./utils.mjs"

const DOMAIN = ["punct", "word", "phrase", "sent",];
const RANGE = ["blue", "orange", "green", "red",];

function create_graph(datum) {
  const { metric: metric_name, lower, upper, values: data } = datum;

  const graph = Plot.plot({
    inset: 6,
    width: 512,
    height: 180,
    grid: false,
    marginBottom: 55,
    marginLeft: 55,
    // r: { range: [0, 8] },
    x: { label: "score", tickRotate: 90, },
    y: { label: null, domain: DOMAIN, },
    color: {
      domain: DOMAIN,
      range: RANGE,
    },
    // [Make the Axis labels bigger](https://talk.observablehq.com/t/changing-axis-label-size-while-using-plot/5913/5)
    style: { fontSize: "1.0em", },
    title: metric_name,
    marks: [
      // Add confidence intervals
      Plot.ruleX([lower, upper], {
        stroke: "red",
        strokeWidth: 2,
        tip: true,
      }),

      // Display mean that we manually calculate
      Plot.circle(data,
        Plot.group(
          { r: "count" },
          {
            tip: true,
            channels: {
              source: "src",
              reference: "tgt",
              hypothesis: "hyp",
            },
            x: "score",
            y: "type",
            stroke: "type",
            strokeWidth: 2,
            strokeLinecap: "round",
            fill: "type",
          },
        ),
      ),
    ],
  });

  return graph;
}

function parse_datum(d) {
  /*
   * Convert score to float.
   * Convert type to simpler form.
    */
  d.score = +d.score;
  if (d.type.match(/punct/)) {
    d.type = "punct";
  } else if (d.type.match(/word/)) {
    d.type = "word";
  } else if (d.type.match(/phrase/)) {
    d.type = "phrase";
  } else if (d.type.match(/sent/)) {
    d.type = "sent";
  }

  return d;
}

async function get_data(data_file, metricminmax_file) {
  const metrics_raw = await d3.json(`${data_file}.json`).then(d => d.map(parse_datum));
  const metrics = Object.fromEntries(
    Map.groupBy(
      metrics_raw,
      ({ metric }) => metric));

  const metricminmax_raw = await d3.json(`${metricminmax_file}.json`);
  const metricminmax = Object.fromEntries(metricminmax_raw.map(d => [d.metric, d]));

  const common_metrics = Array.from(new Set(Object.keys(metrics)).intersection(new Set(Object.keys(metricminmax))));
  const data = common_metrics.map((metric) => Object.assign({}, { values: metrics[metric] }, metricminmax[metric]))

  return data;
}

export default async function plot(selector, datafile, metricminmax_file) {
  // Add a spinner to show the user that we are working on the new graph.
  const selection = d3.select(selector);
  const spinner = add_spinner(selection);

  await get_data(datafile, metricminmax_file)
    .then(data => {
      selection
        .selectAll("figure")
        .remove();

      // [d3js selection append](https://d3js.org/d3-selection/modifying#selection_append)
      selection
        .selectAll("figure")
        .data(data, ({ metric }) => metric)
        .enter()
        .append(create_graph);
      spinner.remove();
    })
    .catch(error => {
      console.error(error);
      selection
        .selectAll("*")
        .remove();
      selection
        .append("h1")
        .classed("loading_error", true)
        .text(`Failed to load ${datafile}`)
    });

}
