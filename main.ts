///
import type { Alpine as AlpineInstance } from "npm:alpinejs";

import * as d3 from "npm:d3";
import * as topojson from "npm:topojson";

function Globe(Alpine: AlpineInstance) {
  Alpine.directive("globe", directive);
}

type EventWithCoordinates = Event & { x: number; y: number };

type OptionsObject = {
  globe_svg_id: string;
  width: number;
  height: number;
  sens: number;
  scaleFactor: number;
  rotate_delay: number;
  countries: Array<string>;
  world: {
    json: string;
    tsv: string;
  };
};

const directive = async (
  element: HTMLElement,
  // deno-lint-ignore no-explicit-any
  { expression }: { expression: any },
  // deno-lint-ignore no-explicit-any
  { Alpine, evaluate }: { Alpine: AlpineInstance; evaluate: any },
) => {
  // const modules: Array<SwiperModule> = add_module_from_modifiers(modifiers)

  const user_options: object = evaluate(expression);
  const default_options: OptionsObject = {
    globe_svg_id: "globe_svg",
    width: 650,
    height: 650,
    sens: 0.25,
    scaleFactor: 0.9,
    rotate_delay: 350,
    countries: [],
    world: {
      json: "./assets/world.json",
      tsv: "./assets/world-country-names.tsv",
    },
  };

  const options: OptionsObject = { ...default_options, ...user_options };

  const globe_svg_id = `#${options.globe_svg_id}`;

  await Alpine.$nextTick;

  // deno-lint-ignore no-explicit-any
  const world_data: { json: any; tsv: any } = {
    json: await d3.json(options.world.json),
    tsv: await d3.tsv(options.world.tsv),
  };

  const countries_by_id = world_data.tsv.reduce(
    // deno-lint-ignore no-explicit-any
    (country_list: any, country: any) => {
      country_list[String(country.id)] = country.name;
      return country_list;
    },
  );

  const world_topography = topojson.feature(
    world_data.json,
    world_data.json.objects.countries,
  );

  const globe_element = element.querySelector(globe_svg_id);

  // deno-lint-ignore no-explicit-any
  let delay: any;
  let focused: boolean;
  let is_spinning: boolean = true;

  const tooltip = d3
    .select(".globe-tooltip");

  const projection = d3.geoOrthographic()
    .scale((options.scaleFactor * Math.min(options.width, options.height)) / 2)
    .rotate([0, 0])
    .translate([options.width / 2, options.height / 2])
    .clipAngle(90);

  const path = d3.geoPath()
    .projection(projection);

  const globe_svg = d3.select(globe_svg_id)
    .attr("width", options.width)
    .attr("height", options.height);

  const _water_fill = create_water(globe_svg);

  globe_svg.append("path")
    .datum({
      type: "Sphere",
    })
    .attr("class", "water")
    .style("fill", "url(#water_fill)")
    .attr("d", path)
    .call(
      d3.drag()
        .subject(() => {
          const rotate = projection.rotate();
          return {
            x: rotate[0] / options.sens,
            y: -rotate[1] / options.sens,
          };
        })
        .on("drag", (event: EventWithCoordinates) => {
          const rotate = projection.rotate();

          projection.rotate([
            event.x * options.sens,
            -(event.y * options.sens),
            rotate[2],
          ]);

          globe_svg.selectAll("path.land").attr("d", path);
          globe_svg.selectAll(".focused").classed("focused", focused);
        }),
    )
    .on("mouseover", () => {
      is_spinning = false;
    })
    .on("mouseout", () => {
      if (delay) return;
      is_spinning = true;
    })
    .on("touchstart", () => {
      is_spinning = false;
    })
    .on("touchend", () => {
      if (delay) return;
      is_spinning = true;
    });

  const _world = globe_svg.selectAll("path.land")
    .data(world_topography.features)
    .enter()
    .append("path")
    // deno-lint-ignore no-explicit-any
    .attr("id", (data: any) => {
      return data.id;
    })
    // deno-lint-ignore no-explicit-any
    .attr("class", function (data: any) {
      if (countries_by_id[Number(data.id)] == undefined) {
        return "land";
      }

      if (
        options.countries.includes(
          countries_by_id[Number(data.id)].toLowerCase(),
        ) && countries_by_id[Number(data.id)]
      ) {
        return "land has-data";
      }

      return "land";
    })
    // deno-lint-ignore no-explicit-any
    .attr("d", path).attr("tabindex", function (data: any) {
      if (countries_by_id[Number(data.id)] == undefined) {
        return "-1";
      }

      if (
        options.countries.includes(
          countries_by_id[Number(data.id)].toLowerCase(),
        )
      ) {
        return 0;
      }
      return "-1";
    })
    .call(
      d3
        .drag()
        .subject(function () {
          const rotate = projection.rotate();
          return {
            x: rotate[0] / options.sens,
            y: -rotate[1] / options.sens,
          };
        })
        .on(
          "drag",
          (event: EventWithCoordinates) => {
            const rotate = projection.rotate();

            const transformed_rotate = [
              event.x * options.sens,
              -(event.y * options.sens),
              rotate[2],
            ];
            projection.rotate(transformed_rotate);
            globe_svg.selectAll("path.land").attr("d", path);
            globe_svg.selectAll(".focused").classed("focused", focused);
          },
        ),
    )
    // deno-lint-ignore no-explicit-any
    .on("click", (data: any) => {
      const country_name = countries_by_id[Number(data.target.id)];
      proxy_click(country_name.toLowerCase());
      rotateMe(data);
    })
    // deno-lint-ignore no-explicit-any
    .on("mouseover", function (data: any) {
      const country_name = countries_by_id[Number(data.target.id)];

      const [x, y] = d3.pointer(data);

      tooltip
        .text(country_name)
        .style("left", (x + 7) + "px")
        .style("top", (y - 15) + "px")
        .style("display", "block")
        .style("opacity", 1);

      is_spinning = false;
    })
    .on("mouseout", () => {
      tooltip
        .style("opacity", 0)
        .style("display", "none");
      if (!delay) is_spinning = true;
    });

  /*
   * HACK: proxy_click to dispatch events from the actual element, I
   * guess I could pass the element but that rarely works itself.
   */
  function proxy_click(country_name: string) {
    element.dispatchEvent(globe_event_factory(country_name));
  }

  // deno-lint-ignore no-explicit-any
  function rotateMe(clicked_country_data: any) {
    // deno-lint-ignore no-explicit-any
    const focused_country = world_topography.features.find((country: any) =>
      Number(country.id) === Number(clicked_country_data.target.id)
    );
    const p = d3.geoCentroid(focused_country);

    globe_svg.selectAll("path").classed("focused", focused);

    d3.transition()
      .duration(2500)
      .tween("rotate", () => {
        const rotate_interpolation = d3.interpolate(projection.rotate(), [
          -p[0],
          -p[1],
        ]);
        // deno-lint-ignore no-explicit-any
        return function (t: any) {
          projection.rotate(rotate_interpolation(t));
          globe_svg.selectAll("path.land").attr("d", path)
            // deno-lint-ignore no-explicit-any
            .classed("focused", (data: any, _i: any) => {
              return data.id == focused_country.id ? focused = data : false;
            });
        };
      });

    clearTimeout(delay);

    delay = false;

    delay = setTimeout(function () {
      is_spinning = true, delay = false;
    }, options.rotate_delay);

    is_spinning = false;
  }

  function spinGlobe() {
    d3.timer(() => {
      if (is_spinning && globe_element?.matches(":hover") == false) {
        const rotate = projection.rotate();
        projection.rotate([rotate[0] - 0.25, rotate[1], 0]);
        globe_svg.selectAll("path.land").attr("d", path);
      }
    });
  }

  // Rotate Globe
  spinGlobe();
};

// deno-lint-ignore no-explicit-any
function create_water(svg: any) {
  const water = svg.append("defs")
    .append("radialGradient")
    .attr("id", "water_fill")
    .attr("cx", "50%")
    .attr("cy", "50%");

  water.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#FFFFFF");

  water.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#BCDAF3");

  return water;
}

function globe_event_factory(active_country: string) {
  return new CustomEvent("globe", {
    bubbles: false,
    detail: {
      active: active_country,
    },
  });
}

export default Globe;
