const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.js",
  plugins: [
    new HtmlWebpackPlugin({
      title: "js.polli.live",
      template: "./src/index.html",
      scriptLoading: "blocking",
      inject: "head",
    }),
  ],
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
    library: "polli_live",
    libraryTarget: "umd",
    globalObject: "this",
  },
  mode: "production",
  module: {
    rules: [
      {
        test: /\.html$/i,
        use: "raw-loader",
      },
    ],
  },
};
