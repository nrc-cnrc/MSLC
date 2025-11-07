// [source](https://observablehq.com/d/ed9e56b825647a13)

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// [source](https://observablehq.com/plot/getting-started#plot-in-vanilla-html)
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
import { svg } from "https://cdn.jsdelivr.net/npm/htl@0.3.1/+esm";
import { add_spinner, is_cool, partition, COLOR_COOL, COLOR_WARM } from "./utils.mjs"


function diagonal(values, fx, order) {
  // Subplots on the diagonal are stacked histograms.

  return [
    // diagonal cell (one dimension)
    Plot.rectY(values,
      Plot.stackY(
        Plot.binX(
          {
            y: "count",
            sort: null,
          },
          {
            x: fx,
            y: "system_id",
            fill: "system_id",
            order: order,
            tip: true,
          })
      )),
    Plot.axisX({
      ticks: 5,
      anchor: "bottom",
      labelAnchor: "center",
    }),
    Plot.text([fx], {
      frameAnchor: "top",
      fontWeight: "bold",
      dy: 5
    })
  ];
}


function off_diagonal(values, fx, fy) {
  // Off diagonal subplots are scatter plots.

  return [
    // off diagonal
    // two dimensions
    Plot.gridX({ ticks: 5 }),
    Plot.gridY({ ticks: 7 }),
    Plot.dot(
      values,
      {
        channels: {
          system_id: "system_id",
          segment_id: "segment_id",
        },
        tip: {
          format: {
            system_id: true,
            segment_id: true,
            x: (d) => `${d.toFixed(3)}`,
            y: (d) => `${d.toFixed(3)}`,
          },
        },
        x: fx,
        y: fy,
        stroke: "system_id",
        opacity: 0.2,
      }),
    Plot.axisX({ ticks: 5, anchor: "bottom", labelAnchor: "center", }),
  ];
}



class SubPlot extends Plot.Mark {
  set_values(values) {
    this.values = values;
    return this;
  }

  set_selected_metrics(selected_metrics) {
    this.selected_metrics = selected_metrics;
    return this;
  }

  // This function receives the facet information (fx and fy), and returns a new Plot
  render({ fx, fy }, scales, _channels, dimensions, _context) {
    // The charts on the same column must share the same x scale, and the charts on the
    // same row must share the same y scale (except on the diagonal). Currently this works
    // because plots are consistent, but it’s not guaranteed if you start playing with
    // more custom charts.
    const chart = Plot.plot({
      ...dimensions,
      insetTop: fx === fy ? 20 : 6,
      insetBottom: fx === fy ? 0 : 6,
      inset: 6,
      nice: true,
      x: {
        label: null,  // Disable sub plots x-axis's labels.
      },
      y: {
        label: null,  // Disable sub plots y-axis's labels.
      },
      color: {
        // domain size and range size should be the same or else we are getting an error.
        domain: scales.color.domain(),
        range: scales.color.range(),
        type: "ordinal",
      },
      // [Make the Axis labels bigger](https://talk.observablehq.com/t/changing-axis-label-size-while-using-plot/5913/5)
      style: { fontSize: "1.5em", },
      marks: [
        fx === fy
          ? diagonal(this.values, fx, scales.color.domain())
          : off_diagonal(this.values, fx, fy),

        // NOTE: Only for the top row
        fy === this.selected_metrics[0] ?
          [
            Plot.text([fx], {
              frameAnchor: "top",
              fontWeight: "bold",
              dy: -15,
            }),
          ]
          : null,

        // NOTE: Only for the left column
        fx === this.selected_metrics[0] ?
          [
            Plot.text([fy], {
              frameAnchor: "left",
              fontWeight: "bold",
              dx: -45,
              rotate: -90,
            }),
          ]
          : null,
      ]
    });

    return svg`< g > ${chart}`;
  }
}

function create_graph(
  data,
  selected_metrics,
  colors,
  graph_size,
) {
  const cometrics = d3.cross(selected_metrics, selected_metrics);

  const graph = Plot.plot({
    width: graph_size,
    height: graph_size,
    marginTop: 20,
    marginLeft: 60,
    marginRight: 70,
    marginBottom: 33,
    facet: {
      data: cometrics,
      x: "0",
      y: "1",
    },
    fx: {
      domain: selected_metrics,
      padding: 0.15,
    },
    fy: {
      domain: selected_metrics,
    },
    axis: null,
    color: {
      legend: true,
      domain: colors.domain(),
      range: colors.range(),
    },
    marks: [
      Plot.frame(),
      new SubPlot(cometrics).set_values(data).set_selected_metrics(selected_metrics),
    ],
  });

  return graph;
}



function update(
  selection,
  data,
  selector,
  colors,
  graph_size,
) {
  // User requested a change, either a new language pair or to add/remove a metric from the graph.

  const selected_metrics = Array.from(
    document
      .querySelectorAll('input[name=metrics]:checked')
      .values()
      .map(({ value }) => value)
  );

  selection
    .selectAll("*")
    .remove();

  selection.append(() => create_graph(data, selected_metrics, colors, graph_size,));

  // Attach hooks to enable dynamic coloring aka black dots.
  d3.selectAll(`${selector} figure div span`)
    .on("mouseover", function (_event, _d) {
      const current_system = this.textContent;
      const current_color = colors(current_system);
      // Add a class to the legend's selected system.
      d3.select(this)
        .selectAll("svg")
        .classed("highlight", true);
      // Add the same class to the corresponding series.
      d3.selectAll(`${selector} circle[stroke = "${current_color}"]`)
        .classed("highlight", true);
      d3.selectAll(`${selector} rect[fill = "${current_color}"]`)
        .classed("highlight", true);
    })
    .on("mouseout", function (_event, _d) {
      d3.select(selector)
        .selectAll(".highlight")
        .classed("highlight", false);
    });
}



function partition_systems(data) {
  // We want the data points to be sorted by average BLEU.
  // Then we partition systems into cool and warm colors.

  const system2BLEU = data.reduce((acc, {system_id, BLEU}) => {
      acc[system_id] = acc[system_id] || 0;
      acc[system_id] += BLEU;
      return acc;
    },
    Object.create(null),
  );

  const all_system_id = Object.entries(system2BLEU)
    .sort((a,b) => a[1] - b[1])
    .map(([system_id, _BLEU_sum]) => system_id);

  const [cool_systems, warm_systems] = partition(all_system_id, is_cool);

  return [cool_systems, warm_systems];
}



function graph(data_, selector,) {
  // Precalculate invariants.
  // Create a closure for an updater.

  const graph_size = 1800;
  const data = data_;

  // Calculate values that will not change through out the life of the graph.
  const [cool_systems, warm_systems] = partition_systems(data);

  const colors = d3.scaleOrdinal(
    // We have to rebuild the all system_id array or else the colors are weird.
    [...cool_systems.keys(), ...warm_systems.keys(),],
    [
      ...d3.range(cool_systems.size).map(v => COLOR_COOL(v / (cool_systems.size - 1.))),
      ...d3.range(warm_systems.size).map(v => COLOR_WARM(v / (warm_systems.size - 1.))),
    ],
  );

  const updater = selection => update(selection, data, selector, colors, graph_size);

  return updater;
}


function populate_metric_fieldset(data, selector, metric_selector, graph_update, default_fields) {
  // Populate the metric selection checkboxes in the UI

  const all_metrics = new Set(data
    .flatMap(Object.keys)
    .filter(d => d !== "system_id")
    .filter(d => d !== "segment_id"));

  if ( ! (new Set(default_fields)).isSubsetOf(all_metrics)){
    const metric_not_present_in_data = new Set(default_fields).difference(all_metrics);
    console.log([...metric_not_present_in_data], " can not be found in the data");
    throw new Error(`${[...metric_not_present_in_data]} can not be found in the data`);
  }

  d3.select(metric_selector)
    .on("change", function (_event, _d) {
      d3.select(selector).call(graph_update);
    })
    .selectAll("input")
    .data(Array.from(all_metrics).toSorted())
    .enter()
    .each(function (_d) {
      // [Checkbox and radio button groups](https://getbootstrap.com/docs/5.3/components/button-group/#checkbox-and-radio-button-groups)
      // [Bootstrap: button style](https://d3-graph-gallery.com/graph/interactivity_button.html#buttonStyle)
      d3.select(this)
        .append("input")
        .attr("type", "checkbox")
        .attr("name", "metrics")
        .attr("id", d => d)
        .attr("value", d => d)
        .property("checked", d => default_fields.has(d))
        .classed("btn-check", true)
        ;
      d3.select(this)
        .append("label")
        .attr("for", d => d)
        .classed("btn", true)
        .classed("btn-primary", true)
        .text(d => d)
        ;
    });
}


function parse_csv(d) {
  return Object
    .entries(d)
    .reduce(
      function (obj, [key, value]) {
        value = key !== "system_id" ? parseFloat(value) : value;
        return (obj[key] = value, obj);
      },
      {}
    );
}


export default async function plot(selector, metric_selector, datafile, default_fields) {
  // Add a spinner to show the user that we are working on the new graph.
  const selection = d3.select(selector);
  const spinner = add_spinner(selection);

  const datafilename = `${datafile}.csv`;
  await d3.csv(datafilename, parse_csv)
    .then(data => {
      const graph_update = graph(data, selector);

      // Populate the UI with some buttons to toggle on and off metrics.
      populate_metric_fieldset(
        data,
        selector,
        metric_selector,
        graph_update,
        default_fields,
      );

      selection.call(graph_update);
      spinner.remove();
    })
    .catch((error) => {
      console.error(error);
      selection
        .selectAll("*")
        .remove();

      const error_message = selection
        .append("div")
        .classed("loading_error", true);
      error_message
        .append("h1")
        .text("Error");

      error_message
        .selectAll("p")
        .data([`Failed to load ${datafilename}`, `${error}`])
        .enter()
        .append("p")
        .text(d => d);
    });
}
