const path = require("path");

module.exports = {
  entry: "./src/index.js",
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
