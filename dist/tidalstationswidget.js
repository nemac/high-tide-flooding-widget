(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TidalStationsWidget = factory());
}(this, (function () { 'use strict';

    class TidalStationWidget {
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
              tickmode: "linear",
              tick0: 1950,
              dtick: 10,
              ticks: "outside",
              linecolor: 'rgb(0,0,0)',
              side: "bottom",
              range: [1950, 2100]
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
            hoverdistance: 50,
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
          }
        };
        this.scales = {
          full: {
            xrange: [1950, 2100],
            yrange: [0, 365],
            y_dtick: 75
          },
          historical: {
            xrange: [1950, 2020],
            yrange: [0, 365],
            y_dtick: 5
          }
        };
        this.data = {};
        this.element = element;
        this.chart_element = null;
        Object.assign(this.options, options);
        this._when_data = fetch(this.options.data_url).then(a => a.json()).then(data => {
          this.data = data;
        });
      }
      /**
       * Load JSON values into data field.
       */


      async request_update(options = {}) {
        await this._when_data;

        if ('station' in options && options['station'] !== this.options.station) {
          this.options.station = options['station'];
          this.options.scale = 'full';
          this.scales = {
            full: {
              xrange: [1950, 2100],
              yrange: [0, 365],
              y_dtick: 75
            },
            historical: {
              xrange: [1950, 2020],
              yrange: [0, 365],
              y_dtick: 5
            }
          };
          this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
          this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
          this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;

          this._update();
        } else if ('scale' in options && options['scale'] !== this.options.scale) {
          this.options.scale = options['scale'];
          this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
          this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
          this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;

          this._update();
        } else if (!this.chart_element) {
          this._update();
        }

        if (this.chart_element !== null) {
          this._when_chart = new Promise(resolve => {
            this.chart_element.once('plotly_afterplot', gd => {
              resolve(gd);
            });
          });
          await this._when_chart;
        }
      }

      async request_download_image() {
        if (this.chart_element == null) return;
        let {
          width,
          height
        } = window.getComputedStyle(this.element);
        width = Number.parseFloat(width) * 1.2;
        height = Number.parseFloat(height) * 1.2;
        return Plotly.downloadImage(this.chart_element, {
          format: 'png',
          width: width,
          height: height,
          filename: "high_tide_flooding_" + this.options.station + ".png"
        });
      }
      /**
       * Update Plotly graph with updated values
       */


      _update() {
        if (!this.options.station) {
          return;
        } // transform data from object to array


        let data_hist = [];
        let floods_historical = this.data.floods_historical.AnnualFloodCount;

        for (let i = 0; i < floods_historical.length; i++) {
          data_hist.push(floods_historical[i].minCount);
        }

        this.scales.historical.yrange[1] = Math.max(...data_hist) * 2; // turn projected data values into an array

        let labels = [];
        let data_rcp45 = []; //int_low

        let data_rcp85 = []; //int

        let projection = this.data.projection.AnnualProjection;
        let proj_year_idx = 0;

        for (let i = 1920; i <= 2100; i++) {
          // build an array of labels
          labels.push(i); // prepend 0s to projected data

          if (i < new Date().getFullYear()) {
            data_rcp45.push(0);
            data_rcp85.push(0);
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
          x: labels,
          y: data_hist,
          name: "Historical",
          fill: "tonexty",
          yaxis: "y2",
          marker: {
            color: "rgba(170,170,170, 0.5)",
            line: {
              color: 'rgb(119,119,119)',
              width: 1.5
            }
          },
          hovertemplate: "Historical: <b>%{y}</b>",
          hoverlabel: {
            namelength: 0
          }
        };
        let chart_rcp45 = {
          x: labels,
          y: data_rcp45,
          mode: "lines",
          name: "Lower Emissions",
          fill: "tonexty",
          fillcolor: 'rgba(25,104,211, 0.5)',
          line: {
            color: 'rgb(0,88,207)',
            width: 2
          },
          hovertemplate: "Lower Emissions: <b>%{y}</b>",
          hoverlabel: {
            namelength: 0
          }
        };
        let chart_rcp85 = {
          x: labels,
          y: data_rcp85,
          mode: "lines",
          name: "Higher Emissions",
          fill: "tonexty",
          fillcolor: 'rgba(246, 86, 66, 0.5)',
          line: {
            color: 'rgb(245,68,45)',
            width: 2
          },
          hovertemplate: "Higher Emissions: <b>%{y}</b>",
          hoverlabel: {
            namelength: 0
          }
        };
        let data = [chart_historic_min, chart_rcp45, chart_rcp85];
        Plotly.react(this.chart_element, data, this.options.layout, this.options.config);
        this.chart_element.on('plotly_hover', data => {
          document.getElementsByClassName("hoverlayer")[0].style.display = "none";
          this.hoverInfo.style.display = "block";
          this.hoverInfo.style.position = "absolute";
          let innerText = `
                    <div>
                        <span>Year ${data.points[0].x}</span>                    
                    </div>`;

          for (let i = 0; i < data.points.length; i++) {
            let point = data.points[i];
            let color = '';

            if (point.data.type === 'bar') {
              color = point.data.marker.color;
            } else if (point.data.mode === 'lines') {
              color = point.fullData.line.color;
            }

            innerText += `
                    <div style="display: flex; flex-direction: row; justify-content: space-between; border: 1px solid ${color}; border-radius: 2px; margin-bottom: 5px;">
                        <span style="padding-left: 3px; padding-right: 3px;">${point.data.name}: </span>
                        <span style="padding-left: 3px; padding-right: 3px; font-weight: bold;">${point.y}</span>
                    </div>
                `;
          }

          let outterText = '<div style="background-color: rgba(255, 255, 255, 0.75); padding: 5px; border: 1px solid black; border-radius: 2px">' + innerText + '</div>';
          let hoverInfoWidth = this.hoverInfo.offsetWidth + data.event.pageX - this.hoverInfo.offsetWidth * this.hoverThreshold;
          let tooFarRight = hoverInfoWidth > document.getElementsByTagName("body")[0].offsetWidth;
          let xPosition = data.event.pageX + 15;

          if (tooFarRight) {
            xPosition = data.event.pageX - this.hoverInfo.offsetWidth - 30;
          }

          this.hoverInfo.innerHTML = outterText;
          this.hoverInfo.style.top = `${this.chart_element.offsetHeight / 1.5}px`;
          this.hoverInfo.style.left = `${xPosition}px`;
        });
        this.chart_element.on('plotly_unhover', data => {
          this.hoverInfo.style.display = "none";
        });
      }
      /**
       * Toggle the zoom between historical and normal viewing of the graph
       */


      async zoomToggle() {
        return this.request_update({
          scale: this.options.scale === 'historical' ? 'full' : 'historical'
        });
      }

    }

    return TidalStationWidget;

})));
