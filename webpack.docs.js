const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    // Emit at the same URL docs/index.html requests, so the dev server serves the
    // freshly compiled library instead of a checked-in bundle.
    output: {
        filename: 'js/klee.min.js',
        path: path.resolve(__dirname, 'docs'),
        library: 'Klee',
        libraryTarget: "umd",
    },
    devServer: {
        open: true,
        watchFiles: ['docs/**/*'],
        static: [
            {
                directory: path.join(__dirname, 'docs'),
                watch: true
            },
        ]
    }
});
