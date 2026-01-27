const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'msqpay.min.js' : 'msqpay.js',
      library: {
        name: 'MSQPay',
        type: 'umd',
        export: 'default',
      },
      globalObject: "typeof self !== 'undefined' ? self : this",
      clean: true,
      umdNamedDefine: true,
    },
    externals: {
      ethers: {
        commonjs: 'ethers',
        commonjs2: 'ethers',
        amd: 'ethers',
        root: 'ethers',
      },
    },
    optimization: {
      minimize: isProduction,
      minimizer: isProduction
        ? [
            new TerserPlugin({
              terserOptions: {
                format: {
                  comments: false,
                },
              },
              extractComments: false,
            }),
          ]
        : [],
    },
    mode: argv.mode || 'production',
    resolve: {
      extensions: ['.js'],
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: {
                      browsers: ['> 1%', 'last 2 versions'],
                    },
                    modules: false,
                  },
                ],
              ],
            },
          },
        },
      ],
    },
    devtool: isProduction ? false : 'source-map',
  };
};
