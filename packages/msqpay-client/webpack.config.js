const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.ts',
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
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                module: 'ESNext',
                target: 'ES2022',
              },
            },
          },
        },
      ],
    },
    devtool: isProduction ? false : 'source-map',
  };
};
