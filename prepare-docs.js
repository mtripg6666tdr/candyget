const fs = require("fs");
const path = require("path");

const original = fs.readFileSync(path.join(__dirname, "./src/index.ts"), {encoding: "utf-8"});
const line = original.split("\n");
const prefix = ["type", "class", "function"];
for(let i = 0; i < line.length; i++){
  if(prefix.some(pre => line[i].startsWith(pre))){
    line[i] = "export " + line[i];
  }else if(line[i].startsWith("export =")){
    line[i] = "// " + line[i];
  }
}
fs.writeFileSync(path.join(__dirname, "./src/index.temp.ts"), line.join("\n"), {encoding: "utf-8"});
