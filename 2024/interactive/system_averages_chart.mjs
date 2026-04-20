import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// [source](https://observablehq.com/plot/getting-started#plot-in-vanilla-html)
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
// import { html, svg } from "https://cdn.jsdelivr.net/npm/htl@0.3.1/+esm";
import { add_spinner, is_cool, partition, COLOR_COOL, COLOR_WARM } from "./utils.mjs"

function graph(data, selector, sort_order_selector) {
  const all_system_id = Array.from(
    new Set(
      data
        .filter(({ metric }) => metric != "MQM")
        .flatMap(datum => datum.values.map(({ system_id }) => system_id))
    ));
  const [cool_systems, warm_systems] = partition(all_system_id, is_cool);

  // Rearrange the data to sort warm colored systems per metric score.
  const system_scores_per_metric = Object.fromEntries(
    data.map(({ metric, values }) => (
      [
        metric,
        Object.fromEntries(values.map(
          ({ system_id, score }) => [system_id, score])
        ),
      ])
    )
  );

  populate_sort_order_dropdown(selector, sort_order_selector, data, update);

  function update(selection) {
    // Update graphs when user changes the ordering metric.

    // Based on what metric should the WMT systems be sorted?
    const ordering_metric = d3.select(sort_order_selector).property("value");
    const system_scores = system_scores_per_metric[ordering_metric];
    const colors = d3.scaleOrdinal(
      // We have to rebuild the all system_id array or else the colors are weird.
      Array.from(cool_systems.keys())
        .concat(Array.from(warm_systems)
          .sort((a, b) => system_scores[a] - system_scores[b])),
      new Array(
        ...d3.range(cool_systems.size).map(v => COLOR_COOL(v / (cool_systems.size - 1.))),
        ...d3.range(warm_systems.size).map(v => COLOR_WARM(v / (warm_systems.size - 1.))),
      ),
    );

    const create_graph = data => Plot.plot({
      inset: 6,
      width: 600,
      height: 600,
      grid: false,
      marginBottom: 145,
      marginLeft: 60,
      x: {
        domain: colors.domain(),
        label: null,
        tickRotate: 90,
      },
      y: { label: "score", },
      color: {
        domain: colors.domain(),
        range: colors.range(),
      },
      // [Make the Axis labels bigger](https://talk.observablehq.com/t/changing-axis-label-size-while-using-plot/5913/5)
      style: { fontSize: "1.0em", },
      title: data.metric,
      marks: [
        // Add metric's score per system.
        Plot.dot(data.values, {
          tip: {
            format: {
              "system id": true,
              "score": (d) => d.toFixed(3),
              "error bars": ([l, h]) => `[${l.toFixed(3)}, ${h.toFixed(3)}]`,
            }
          },
          channels: {
            system_id: "system_id",
            score: "score",
            "error bars": ({ score, ci_low, ci_high }) => [score - ci_low, score + ci_high],
          },
          x: "system_id",
          y: "score",
          sort: { x: null },
          stroke: "system_id",
          strokeWidth: 4,
          strokeLinecap: "round",
        }),
        // Add confidence intervals.
        Plot.ruleX(data.values, {
          x: "system_id",
          y1: ({ score, ci_low }) => score - ci_low,
          y2: ({ score, ci_high }) => score + ci_high,
          sort: { x: null },
          stroke: "black",
          strokeWidth: 2,
        }),
        // x-Axis
        Plot.frame({ anchor: "bottom" }),
        // y-Axis
        Plot.frame({ anchor: "left" }),
      ],
    });

    selection.each(function (_datum, _i) {
      // generate chart here; `datum` is the data and `this` is the element

      // Remove previous chart, we are recreating them.
      d3.select(this).selectAll("*").remove();
      // Replace with the new chart.
      d3.select(this).append(create_graph);
    });
  }

  return update;
}


function populate_sort_order_dropdown(selector, sort_order_selector, data, update) {
  // Populate the dropdown with possible metrics for sorting
  d3.select(sort_order_selector)
    .on("change", function (_event, _d) {
      d3.select(selector)
        .selectAll("div")
        .call(update);
    })
    .call(selection => {
      selection.selectAll("option")
        .data(data.map(({ metric }) => metric))
        .enter()
        .append("option")
        .attr('value', d => d)
        .text(d => d);
    }
    )
    // Default value has to be set after `<select>` is created and populated.
    .property("value", "MQM");
}


export default async function plot(selector, sort_order_selector, datafile) {
  // Add a spinner to show the user that we are working on the new graph.
  const selection = d3.select(selector);
  const spinner = add_spinner(selection);

  const datafilename = `${datafile}.json`;
  await d3.json(datafilename)
    .then(data => {
      const graph_update = graph(data, selector, sort_order_selector);

      selection
        .selectAll("div.chart")
        .data(data, ({ metric }) => metric)
        .join("div")
        .classed("chart", true)
        .call(graph_update);
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
        .text(`Failed to load ${datafilename}`)
    });
}
