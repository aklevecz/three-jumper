const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const webpack = require("webpack");
const dotenv = require("dotenv").config({
  path: path.join(__dirname, "/.env.dev"),
});
module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(dotenv.parsed),
    }),
  ],
  devServer: {
    disableHostCheck: true,
    contentBase: "./dist",
    https: false,
  },
});
