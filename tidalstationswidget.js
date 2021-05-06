export default class TidalStationWidget {
    constructor(element, options={}) {
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
                modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d','resetScale2d']
            }
        };
        this.scales = {
            full: {xrange: [1950, 2100], yrange: [0, 365], y_dtick: 75},
            historical: {xrange: [1950, 2020], yrange: [0, 365], y_dtick: 5}
        };
        this.data = {};
        this.element = element;
        this.chart_element = null;
        
        Object.assign(this.options, options);
      
        // this._when_data = fetch(this.options.data_url).then((a)=>a.json()).then((data)=>{
        //   this.data = data
        // });

        this._cache = new Map();
        this.request_update();
    }

    /**
     * Load JSON values into data field.
     */
    async request_update(options={}) {
      
      // await this._when_data;
      if(this.options.station || ('station' in options && options['station'] !== this.options.station)) {

        let station = 'station' in options ? options['station'] : this.options.station;

        if(this._cache.has(station)) {
          this.data = this._cache.get(station);
          console.log(`${station} is in the cache`, this.data);
        } else {
  
          console.log(`fetching data for ${station}`);
  
          let _historical_res = await fetch(`https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_annual.json?station=${station}`);
          let _projection_res = await fetch(`https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_projection_annual.json?station=${station}`);
  
          let _historical = await _historical_res.json();
          let _projection = await _projection_res.json();

          this.data = {floods_historical: _historical, projection: _projection};
          this._cache.set(station, this.data);
  
          console.log(`data set ${station}`, this.data);
        }
      }


      if ('station' in options && options['station'] !== this.options.station) {
        this.options.station = options['station'];
        this.options.scale = 'full';
        this.scales = {
          full: {xrange: [1950, 2100], yrange: [0, 365], y_dtick: 75},
          historical: {xrange: [1950, 2020], yrange: [0, 365], y_dtick: 5}
        };

        this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
        this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
        this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;
        this._update();
      }
      else if ('scale' in options && options['scale'] !== this.options.scale){
        this.options.scale = options['scale']
        this.options.layout.xaxis.range = this.scales[this.options.scale].xrange;
        this.options.layout.yaxis.range = this.scales[this.options.scale].yrange;
        this.options.layout.yaxis.dtick = this.scales[this.options.scale].y_dtick;
        this._update()
      }
      else if (!this.chart_element) {
        this._update();
      }

      if(this.chart_element !== null) {
        this._when_chart = new Promise((resolve) => {
          this.chart_element.once('plotly_afterplot', (gd) => {
            resolve(gd);
          })
        })

        await this._when_chart;
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
          let data_hist = {
            maj: [],
            min: [],
            mod: []
          }

          let floods_historical = this.data.floods_historical.AnnualFloodCount;

          for (let i = 0; i < floods_historical.length; i++) {
            data_hist.maj.push(floods_historical[i].majCount);
            data_hist.min.push(floods_historical[i].minCount);
            data_hist.mod.push(floods_historical[i].modCount);
          }

          this.scales.historical.yrange[1] = Math.max(...data_hist.maj, ...data_hist.min, ...data_hist.mod) * 2;
    
          // turn projected data values into an array
          let labels = [];
          let data_rcp45 = []; //int_low
          let data_rcp85 = []; //int
          
          let projection = this.data.projection.AnnualProjection;
          let position = 0;

          for (let i = 1920; i <= 2100; i++) {
            // build an array of labels
            labels.push(i);
    
            // prepend 0s to historical range
            if (i < 2021) {
              data_rcp45.push(0);
              data_rcp85.push(0);
            } else {
              
              data_rcp45.push(projection[position].intLow);
              data_rcp85.push(projection[position].intermediate);
              position++;
            }
          }

          console.log(data_rcp45);
          console.log(data_rcp85);
    
          if(!this.element) {
            return;
          }
    
          this.chart_element = this.element.querySelector('.chart');
    
          if(!this.chart_element) {
            this.chart_element = document.createElement("div");
            this.chart_element.classList.add("chart");
            this.element.appendChild(this.chart_element);
          }
    
          let chart_historic_maj = {
            type: "bar",
            x: labels,
            y: data_hist.maj,
            name: "Major",
            fill: "tonexty",
            yaxis: "y2",
            marker: {
              color: "rgba(204, 0, 0, 0.5)",
              line: {
                color: 'rgb(204, 0, 0)',
                width: 1.5
              }
            },
            hovertemplate: "Historical: <b>%{y}</b>",
            hoverlabel: {
              namelength: 0
            }
          }

          let chart_historic_min = {
            type: "bar",
            x: labels,
            y: data_hist.min,
            name: "Minor",
            fill: "tonexty",
            yaxis: "y2",
            marker: {
              color: "rgba(7, 217, 0, 0.5)",
              line: {
                color: 'rgb(7, 217, 0)',
                width: 1.5
              }
            },
            hovertemplate: "Historical: <b>%{y}</b>",
            hoverlabel: {
              namelength: 0
            }
          }
    
          let chart_historic_mod = {
            type: "bar",
            x: labels,
            y: data_hist.mod,
            name: "Moderate",
            fill: "tonexty",
            yaxis: "y2",
            marker: {
              color: "rgba(217, 195, 0, 0.5)",
              line: {
                color: 'rgb(217, 195, 0)',
                width: 1.5
              }
            },
            hovertemplate: "Historical: <b>%{y}</b>",
            hoverlabel: {
              namelength: 0
            }
          }

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
          }
    
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
          }
          let data = [chart_historic_maj, chart_historic_min, chart_historic_mod, chart_rcp45, chart_rcp85]
        
          Plotly.react(this.chart_element, data, this.options.layout, this.options.config);
          
    }



    /**
     * Toggle the zoom between historical and normal viewing of the graph
     */
    async zoomToggle() {
      return this.request_update({scale:this.options.scale === 'historical' ? 'full' : 'historical'});
    }

}
