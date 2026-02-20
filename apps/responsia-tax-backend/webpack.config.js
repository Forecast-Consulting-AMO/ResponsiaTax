const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = (_, argv) => {
  const isProd = argv.mode === 'production';
  return {
    output: {
      path: join(__dirname, '../../dist/apps/responsia-tax-backend'),
    },
    plugins: [
      new NxAppWebpackPlugin({
        target: 'node',
        compiler: 'tsc',
        main: './src/main.ts',
        tsConfig: './tsconfig.app.json',
        optimization: false,
        outputHashing: 'none',
        generatePackageJson: true,
        sourceMap: !isProd,
      }),
    ],
    watchOptions: {
      poll: 1000,
    },
  };
};
