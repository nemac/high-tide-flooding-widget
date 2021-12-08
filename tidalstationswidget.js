
import { partial,  round,  cloneDeep} from "./node_modules/lodash-es/lodash.js";

export default class {
  constructor(element, options = {}) {
    this.options = {
      responsive: true,
      station: '',
      data_url: 'tidal_data.json',
      scale: 'full',
      layout: {
        yaxis2: {
          type: 'linear',
          matches: 'y',
          overlaying: 'y',
          showline: false,
          showgrid: false,
          showticklabels: false,
          nticks: 0
        },
        xaxis: {
          nticks: 15,
          ticks: "outside",
          linecolor: 'rgb(0,0,0)',
          side: "bottom",
          tickformat: "%Y",
          xperiodalignment: 'start',
          type: 'date',
          ticklabelmode: "period",
          range: [1950,2100]
        },
        yaxis: {
          tickmode: "linear",
          tick0: 0,
          dtick: 75,
          ticks: "outside",
          side: "left",
          linecolor: 'rgb(0,0,0)',
          title: {
            text: 'Annual Days with High-Tide Flooding',
            font: {
              size: 12,
              color: '#494949'
            }
          },
          range: [0, 365]
        },
        legend: {
          "orientation": "h"
        },
        hovermode: 'x unified',
        hoverdistance: 30,
        autosize: true,
        margin: {
          l: 50,
          t: 2,
          r: 50,
          b: 2
        }
      },
      config: {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']
      },
      colors: {
        rcp45: {outerBand: 'rgb(0,88,207)', line: 'rgb(0,88,207)'},
        rcp85: {outerBand: 'rgba(246, 86, 66, 0.5)', line: 'rgb(245,68,45)'},
        hist: {outerBand: 'rgba(170,170,170, 0.5)', bar: 'rgb(119,119,119)'},
        opacity: {
          ann_hist_minmax: 0.6,
          ann_proj_minmax: 0.5,
          mon_proj_minmax: 0.5,
          hist_obs: 1,
          proj_line: 1,
        }
      }
    };
    this.scales = {
      full: {xrange: [1950, 2100], yrange: [0, 365], y_dtick: 75},
      historical: {xrange: [1950, 2020], yrange: [0, 365], y_dtick: 5}
    };
    this.data = {};
    this.element = element;
    this.chart_element = null;
    this._styles = [
      `#${this.element.id} {position: relative;}`,
    ];
    this._style_el = document.createElement('style');
    this.element.append(this._style_el);

    this._init_popover();

    Object.assign(this.options, options);

    // this._when_data = fetch(this.options.data_url).then((a) => a.json()).then((data) => {
    //     this.data = data
    // });
    this._update_styles();
    this._cache = new Map();
    this.request_update();
  }

  /**
   * Load JSON values into data field.
   */
  async request_update(options = {}) {

    // await this._when_data;
    if (this.options.station || ('station' in options && options['station'] !== this.options.station)) {

      let station = 'station' in options ? options['station'] : this.options.station;

      await this._fetch_station_data(station);

    }


    if ('station' in options && options['station'] !== this.options.station) {
      this.options.station = options['station'];
      this.options.scale = 'full';
      this.scales = {
        full: {xrange: [1950, 2100], yrange: [0, 365], y_dtick: 75},
        historical: {xrange: [1950, new Date().getFullYear()], yrange: [0, 365], y_dtick: 5}
      };

      this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
      this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
      this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;
      this._update();
    } else if ('scale' in options && options['scale'] !== this.options.scale) {
      this.options.scale = options['scale']
      this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
      this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
      this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;
      this._update()
    } else if (!this.chart_element) {
      this._update();
    }

    if (this.chart_element !== null) {
      this._when_chart = new Promise((resolve) => {
        this.chart_element.once('plotly_afterplot', (gd) => {
          resolve(gd);
        })
      })

      await this._when_chart;
    }

  }

  async request_download_image() {

    if (this.chart_element == null) return;

    let {width, height} = window.getComputedStyle(this.element);

    width = 1440;
    height = 720;
    const old_layout= cloneDeep(this.options.layout);
    old_layout.title = ""
    const temp_layout = cloneDeep(this.options.layout);
    //
    temp_layout.title = cloneDeep(temp_layout.yaxis.title)
    temp_layout.title.x = 0.015;
    temp_layout.yaxis.title.text = "";
    temp_layout.margin = {
        l: 50,
        t: 30,
        r: 50,
        b: 2
    }
    // legend padding/margin
    // legend font-size?
    // nticks?

    // temp_layout.yaxis2.title.font.size = 18;
    // temp_layout.xaxis3.title.font.size = 18;
    //
    //
    //
    await Plotly.relayout(this.chart_element, temp_layout);
    const result = Plotly.downloadImage(this.chart_element, {
      format: 'png', width: width, height: height, filename: "high_tide_flooding_" + this.options.station + ".png"
    })
    await result
    await Plotly.relayout(this.chart_element, old_layout);
    return result
    ;


  }

  async _fetch_station_data(station) {
    if (this._cache.has(station)) {
      this.data = this._cache.get(station);
    } else {

      const [_historical, _projection] = await Promise.all([
        fetch(`https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_annual.json?station=${station}`).then(res => res.json()),
        fetch(`https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_projection_annual.json?station=${station}`).then(res => res.json())]);

      this.data = {floods_historical: _historical, projection: _projection};
      this._cache.set(station, this.data);

    }
  }

  /**
   * Update Plotly graph with updated values
   */
  _update() {
    if (!this.options.station) {
      return
    }
    // transform data from object to array
    let data_hist = []

    let floods_historical = this.data.floods_historical.AnnualFloodCount;

    for (let i = 0; i < floods_historical.length; i++) {
      data_hist.push(floods_historical[i].minCount);
    }

    this.scales.historical.yrange[1] = Math.max(...data_hist) * 2;

    // turn projected data values into an array
    let years = [];
    let data_rcp45 = []; //int_low
    let data_rcp85 = []; //int

    let projection = this.data.projection.AnnualProjection;
    let proj_year_idx = 0;

    for (let i = 1920; i <= 2100; i++) {
      // build an array of labels
      years.push(i.toString() + '-01-01');

      // prepend 0s to projected data
      if (i < new Date().getFullYear()) {
        data_rcp45.push(Number.NaN);
        data_rcp85.push(Number.NaN);
      } else {
        data_rcp45.push(projection[proj_year_idx].intLow);
        data_rcp85.push(projection[proj_year_idx].intermediate);
        proj_year_idx++;
      }
    }

    if (!this.element) {
      return;
    }

    this.chart_element = this.element.querySelector('.chart');

    if (!this.chart_element) {
      this.chart_element = document.createElement("div");
      this.chart_element.classList.add("chart");
      this.element.appendChild(this.chart_element);
    }

    let chart_historic_min = {
      type: "bar",
      x: years,
      y: data_hist,
      name: "Historical",
      xperiod:"M12",
      xperiodalignment:"start",
      fill: "tonexty",
      yaxis: "y2",
      marker: {
        color: this.options.colors.hist.outerBand,
        line: {
          color: this.options.colors.hist.bar,
          width: 1.5
        }
      },
      hovertemplate: "Historical: <b>%{y}</b>",
      hoverlabel: {
        namelength: 0
      }
    }

    let chart_rcp45 = {
      x: years,
      y: data_rcp45,
      mode: "lines",
      name: "Lower Emissions",
      fill: "tonexty",
      fillcolor: rgba(this.options.colors.rcp45.outerBand, this.options.colors.opacity.ann_proj_minmax),
      line: {
        color: this.options.colors.rcp45.line,
        width: 2
      },
      xperiod:"M12",
      xperiodalignment:"start",
      hovertemplate: "Lower Emissions: <b>%{y}</b>",
      hoverlabel: {
        namelength: 0
      }
    }

    let chart_rcp85 = {
      x: years,
      y: data_rcp85,
      mode: "lines",
      name: "Higher Emissions",
      fill: "tonexty",
      fillcolor: rgba(this.options.colors.rcp85.outerBand, this.options.colors.opacity.ann_proj_minmax),
      line: {
        color: this.options.colors.rcp85.line,
        width: 2
      },
      xperiod:"M12",
      xperiodalignment:"start",
      hovertemplate: "Higher Emissions: <b>%{y}</b>",
      hoverlabel: {
        namelength: 0
      }
    }

    let data = [chart_historic_min, chart_rcp45, chart_rcp85]
    const layout = this.options.layout;
    layout['xaxis'] = {...this.options.layout.xaxis, range: this.options.layout.xaxis.range.map((a) => a + '-01-01')}
    Plotly.react(this.chart_element, data, this.options.layout, this.options.config);

    this._hover_handler = partial(this._request_show_popover.bind(this), false, {years, rcp45: data_rcp45, rcp85: data_rcp85, hist: data_hist}, this.options.colors, 1);
    this.chart_element.on('plotly_hover', this._hover_handler);
    this._click_handler = partial(this._request_show_popover.bind(this), true, {years, rcp45: data_rcp45, rcp85: data_rcp85, hist: data_hist}, this.options.colors, 1);
    this.chart_element.on('plotly_click', this._click_handler);

  }



  async request_hide_popover(hide_pinned = false) {
    if (!hide_pinned && this.element.classList.contains('popover-pinned')) {
      return Promise.resolve()
    }
    // requests the popover be hidden, with a 5ms debounce delay during which a request to show can cancel the hiding, thereby reducing flicker.
    this._popover_hide_pending = true;
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (this._popover_hide_pending) {
          this.element.classList.remove('popover-open', 'popover-pinned');
          resolve();
        } else {
          reject();
        }
      }, 10);
    });
  }


  /**
   * Toggle the zoom between historical and normal viewing of the graph
   */
  async zoomToggle() {
    return this.request_update({scale: this.options.scale === 'historical' ? 'full' : 'historical'});
  }


  _update_styles() {
    if (this._style_el) {
      this._style_el.innerHTML = this._styles.join('\n');
    }
  }



  async __request_show_popover(x, y, content, pinned = false, title = '') {
    if (!pinned && this.element.classList.contains('popover-pinned')) {
      return Promise.resolve()
    }

    this.element.classList.add('popover-open');
    if (pinned) {
      this.element.classList.add('popover-pinned');
    }
    this._popover_hide_pending = false;
    let x_position, y_position;
    if (x != null) {
      x_position = x + 50 + 7;
      if ((x_position + this._popover.offsetWidth + 25) >= this.element.offsetWidth) {
        x_position -= this._popover.offsetWidth + 14;
      }
    } else {
      x_position = ((this.element.offsetWidth - 50) / 2 - (this._popover.offsetWidth / 2) + 7);
    }

    y_position = (this.element.offsetHeight - 60) / 2 - (this._popover.offsetHeight / 2);

    this._popover.style.top = `${y_position}px`;
    this._popover.style.left = `${x_position}px`;
    this._popover.innerHTML = `<div class="popover-header"><span
      class="high_tide_flooding_popover-title">${title}</span>${pinned ? '<button style="background: none; margin-left: auto; margin-right: 0.156rem; height: fit-content; padding: 0.062rem; font-size: 0.781rem; border: none;" data-popover-action="hide" title="Close"><span aria-hidden="true">&#x2715</span></button>' : ''}
    </div>
    <div>${content}</div>`;
    if (pinned) {
      this._popover.querySelectorAll('[data-popover-action="hide"]').forEach((el) => {
        el.addEventListener('click', () => {
          this.request_hide_popover(true)
        })
      });
    }
    return Promise.resolve();
  }

  async _request_show_popover(pinned, chart_data, colors, precision, event_data) {
    try {
      const year = parseInt(event_data.points.length > 2 ? event_data.points[2].x.slice(0, 4): event_data.points[0].x.slice(0, 4));
      const proj_year_idx = year - 1920;
      return this.__request_show_popover('xaxes' in event_data ? event_data.xaxes[0].l2p(event_data.xvals[0]) : null, null, `
        <div style="display: grid; grid-template-columns: auto auto;">
        ${ year >= new Date().getFullYear() ? `
        <div class="label1">${year} projection</div>
          <div class="bg-rcp85 label2" >Higher Emissions</div>
          <div class="bg-rcp85" style="grid-column: 1 / span 2; padding-bottom: 0.25rem;">
            <div title="${year} higher emissions weighted mean" class="legend-line" style="font-size: 1.1rem; border-left-color:${rgba(colors.rcp85.line, colors.opacity.proj_line)}; ">${round(chart_data['rcp85'][proj_year_idx], precision)}</div>
          </div>
         
          <div class="bg-rcp45 label2" >Lower Emissions</div>
          <div class="bg-rcp45" style="grid-column: 1 / span 2;  padding-bottom: 0.25rem;">
            <div title="${year} lower emissions weighted mean"  class="legend-line"  style="font-size: 1.1rem; border-left-color:${rgba(colors.rcp45.line, colors.opacity.proj_line)};  ">${round(chart_data['rcp45'][proj_year_idx], precision)}</div>
          </div>
         
        `:`
        <div  class="label1" style="font-size: 0.8rem;">${year} observed</div>
          <div style="grid-column: 1 / span 2;">
            <div title="${year} observed" class="legend-line" style="border-left-color: ${rgba(colors.hist.bar, 0.75)};  ">${round(chart_data['hist'][year - 1920], precision)}</div>
          </div>
        `}
        </div>
        `, pinned, "High-tide flooding (days)");
    } catch (e) {
      console.error(e)
      return this.request_hide_popover(pinned);
    }
  }

  _init_popover() {
    this._styles = [...this._styles,

      `#${this.element.id} .hoverlayer .legend {display: none !important;}`,
      `#${this.element.id} .high_tide_flooding_popover {
            z-index: 9999;
            display: none;
            position:absolute;
            background: rgba(252,253,255,0.75);
            pointer-events: none;
            min-height: 3.75rem;
            flex-flow: column nowrap;
            height: fit-content;
            width: 16rem;
            box-shadow: 2px 1px 5px rgb(0 0 0 / 50%);
            border: solid 1.3px rgba(0, 0, 0, 0.3);
            padding: 0.45rem 0.55rem;
            font-size: 1rem;
            font-weight: 500;
            line-height: 1.5rem;
       }`,
      `#${this.element.id} .high_tide_flooding_popover .bg-rcp85 { background-color: ${rgba(this.options.colors.rcp85.outerBand, 0.1)}; }`,
      `#${this.element.id} .high_tide_flooding_popover .bg-rcp45 { background-color: ${rgba(this.options.colors.rcp45.outerBand, 0.1)}; }`,
      `#${this.element.id} .high_tide_flooding_popover .label1 { font-size: 1rem; font-weight: 700; line-height: 1.5rem; grid-column: 1 / span 2; }`,
      `#${this.element.id} .high_tide_flooding_popover .label2 { font-size: 0.7rem; padding-left: 0.3rem; line-height: 1rem; grid-column: 1 / span 2; }`,
      `#${this.element.id} .high_tide_flooding_popover .legend-line { margin-left: 0.5rem; border-left-width: 0.15rem; border-left-style: solid; padding-left: 0.5rem; }`,
      `#${this.element.id} .high_tide_flooding_popover .popover-header { display: flex; flex-flow: row nowrap; align-items: center;}`,
      `#${this.element.id}.popover-pinned .high_tide_flooding_popover { pointer-events: all; background: rgba(252,253,255,0.95); left: 60px !important; top: 15px !important; }`,
      `#${this.element.id}.popover-open .high_tide_flooding_popover { display: flex;   }`


    ];
    this.element.addEventListener('mouseleave', () => this.request_hide_popover(false));
    this._popover = document.createElement("span");
    this._popover.classList.add('high_tide_flooding_popover');
    this.element.append(this._popover);
  }

}


/**
 * Utility function to add an alpha channel to an rgb color. Doesn't play nice with hex colors.
 * @param rgb
 * @param opacity
 * @return {string}
 * @private
 */
function rgba(rgb, opacity) {
  const [r, g, b] = rgb.split('(').splice(-1)[0].split(')')[0].split(',').slice(0, 3)
  return `rgba(${r},${g},${b},${opacity})`
}



