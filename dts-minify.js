const fs = require("fs");
const path = require("path");
const { createMinifier } = require("dts-minify");
const ts = require("typescript");

const minifier = createMinifier(ts);

const dtsPath = path.join(__dirname, "index.d.ts");
const originalDts = fs.readFileSync(dtsPath, {encoding: "utf-8"});
const minifiedDts = minifier.minify(originalDts, {});

fs.writeFileSync(dtsPath, minifiedDts, {encoding: "utf-8"});
