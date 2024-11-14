// [source](https://observablehq.com/d/ed9e56b825647a13)

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// [source](https://observablehq.com/plot/getting-started#plot-in-vanilla-html)
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
// import PlotMatrix from "https://cdn.jsdelivr.net/npm/@observablehq/autoplot-matrix";
// import PlotMatrix from "https://cdn.observableusercontent.com/npm/@observablehq/autoplot-matrix";
import { html, svg } from "https://cdn.jsdelivr.net/npm/htl@0.3.1/+esm";
import { add_spinner, is_cool, partition, COLOR_COOL, COLOR_WARM } from "./utils.mjs"

const DEFAULT_FIELDS = new Set(["XLsimMqm", "BLEU", "chrF", "COMET-22", "GEMBA-ESA", "XCOMET"]);


function graph(data_, selector, metric_selector) {
  const graph_size = 1800;
  const data = data_;
  let selected_metrics = [];

  populate_metric_fieldset(data, selector, metric_selector, update);

  const all_system_id = Array.from(
    new Set(
      data.map(({ system_id }) => system_id)
    ));
  const [cool_systems, warm_systems] = partition(all_system_id, is_cool);

  const colors = d3.scaleOrdinal(
    // We have to rebuild the all system_id array or else the colors are weird.
    Array.from(cool_systems.keys()).concat(Array.from(warm_systems.keys())),
    new Array(
      ...d3.range(cool_systems.size).map(v => COLOR_COOL(v / (cool_systems.size - 1.))),
      ...d3.range(warm_systems.size).map(v => COLOR_WARM(v / (warm_systems.size - 1.))),
    ),
  );

  class SubPlot extends Plot.Mark {
    // This function receives the facet information (fx and fy), and returns a new Plot
    render({ fx, fy }, _scales, _channels, dimensions, _context) {
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
          label: null,
        },
        color: {
          // domain size and range size should be the same or else we are getting an error.
          domain: colors.domain(),
          range: colors.range(),
          type: "ordinal",
        },
        // [Make the Axis labels bigger](https://talk.observablehq.com/t/changing-axis-label-size-while-using-plot/5913/5)
        style: { fontSize: "1.5em", },
        marks: [
          fx === fy
            ? [
              // diagonal cell (one dimension)
              Plot.rectY(data,
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
                      order: colors.domain(),
                      tip: true,
                    })
                )),
              Plot.axisX({ ticks: 5, anchor: "bottom", labelAnchor: "center" }),
              Plot.text([fx], {
                frameAnchor: "top",
                fontWeight: "bold",
                dy: 5
              })
            ]
            : [
              // off diagonal
              // two dimensions
              Plot.gridX({ ticks: 5 }),
              Plot.gridY({ ticks: 7 }),
              Plot.dot(
                data,
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
              Plot.axisX({ ticks: 5, anchor: "bottom", labelAnchor: "center" }),
            ],

          // First column and not the first row
          fx === selected_metrics[0] && fy !== fx
            ? [
              // left y axes (note that we omit it on the top-left cell, where y is defined by the bar chart)
              Plot.dotY(data, { y: fy, filter: [] }), // no output, but necessary to set the y scale
              Plot.axisY({ ticks: 7, label: null, anchor: "left" }),
            ]
            : null,

          /*
              // Last column
              fx === selected_metrics[selected_metrics.length - 1] && fy !== fx
                ? [
                  // right y axes
                  Plot.dotY(data, { y: fy, filter: [] }),
                  Plot.axisY({ ticks: 7, label: null, anchor: "right" }),
                ]
                : null,
          */

          // Last row
          fy === selected_metrics[selected_metrics.length - 1]
            ? [
              // bottom x axes
              Plot.dotX(data, { x: fx, filter: [] }),
              Plot.axisX({ ticks: 5, anchor: "bottom", labelAnchor: "center" }),
            ]
            : null,

          // NOTE: Only for the top row
          fy == selected_metrics[0] ?
            [
              Plot.text([fx], {
                frameAnchor: "top",
                fontWeight: "bold",
                dy: -15,
              }),
            ]
            : null,

          // NOTE: Only for the left column
          fx == selected_metrics[0] ?
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
      })

      return svg`< g > ${chart}`;
    }
  }

  function update(selection) {
    selected_metrics = Array.from(document.querySelectorAll('input[name=metrics]:checked').values().map(({ value }) => value));
    const cometrics = d3.cross(selected_metrics, selected_metrics);

    const create_graph = _ => Plot.plot({
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
      fx: { domain: selected_metrics, padding: 0.15, },
      fy: { domain: selected_metrics },
      axis: null,
      color: {
        legend: true,
        domain: colors.domain(),
        range: colors.range(),
      },
      marks: [
        Plot.frame(),
        new SubPlot(cometrics),
      ],
    });

    selection
      .selectAll("*")
      .remove();

    selection
      .append(create_graph);

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

  return update;
}


function populate_metric_fieldset(data, selector, metric_selector, graph_update) {
  // Populate the metric selection checkboxes
  const all_fields = new Set(data
    .flatMap(Object.keys)
    .filter(d => d !== "system_id")
    .filter(d => d !== "segment_id"));

  d3.select(metric_selector)
    .on("change", function (_event, _d) {
      if (false) {
        // NOTE: We would like to have a spinner when adding/removing metrics
        // but there is a delay and the spinner is shown at the same time as
        // the graph is completely redrawn.
        d3.select(metric_selector)
          .append("div")
          .classed("progress", true)
          .classed("spinner-border", true)
          .property("role", "status")
          .append("span")
          .classed("visually-hidden", true)
          .text("Loading...")
          ;
      }
      d3.select(selector).call(graph_update);
    })
    .selectAll("input")
    .data(Array.from(all_fields).toSorted())
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
        .property("checked", d => DEFAULT_FIELDS.has(d))
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


export default async function plot(selector, metric_selector, datafile, width = 1800) {
  // Add a spinner to show the user that we are working on the new graph.
  const selection = d3.select(selector);
  selection.call(add_spinner);

  const datafilename = `${datafile}.csv`;
  await d3.csv(datafilename, parse_csv)
    .then(data => {
      const graph_update = graph(data, selector, metric_selector);

      selection.call(graph_update);
    })
    .catch((error) => {
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
