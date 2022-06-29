// rollup.config.js
import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import jsonPlugin from '@rollup/plugin-json';

let production = process.env.build_env === 'prod' || process.env.build_env === 'production'
const plugins = [
    nodeResolve(),
    jsonPlugin()
];
if (production){
  plugins.push(
      babel({
        exclude: 'node_modules/**', // only transpile our source code
        babelHelpers: 'bundled',
      })
  )
}
export default [{
  input: 'tidalstationswidget.js',
  output: {
    file: 'dist/tidalstationswidget.js',
    format: 'umd',
    name: 'TidalStationWidget',
    sourcemap: !production ? 'inline' : false,
  },
  plugins: plugins
}];
