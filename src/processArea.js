const fs = require('fs');
const fileName = './area.json';
const file = require(fileName);

// Taken from here: https://www.heavy.ai/blog/12-color-palettes-for-telling-better-stories-with-your-data
// Spring pastels: ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"]
// Retro metro: ["#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"]

console.log(process.argv[2]);

let nodeColorsByArea = {
    "Eger": "#fd7f6f",
    "Róma": "#7eb0d5",
    "Bécs": "#b2e061",
    "Pest": "#bd7ebe",
    "Pozsony": "#ffb55a",
    "Kassa": "#fdcce5",
    "Pécs": "#beb9db",
}

let edgeColors = {
    "Oktatás": "#ea5545",
    "Könyvgyűjtés": "#f46a9b",
    "Irodalmi mecenatúra": "#ef9b20",
    "Tudományos/irodalmi": "#edbf33",
    "Könyvkiadás": "#ede15b",
    "Forrásgyűjtés": "#bdcf32",
    "Családi": "#87bc45",
    "Politikai": "#27aeef",
    "Reprezentáció": "#b33dc6",
    "Természettudományok": "#666",
    "Gazdasági": "#999",
    "Irodalmi mecenatúra, könyvgyűjtés": "#ef9b20"
}

var degrees = {};

for (var i = 0; i < file.edges.length; i++) {
    file.edges[i].attributes.size = file.edges[i].attributes.weight == 0.1 ? 0.01 : 4;
    let label = file.edges[i].attributes.label;
    if (edgeColors[label]) {
        file.edges[i].attributes.color = edgeColors[label];
    }
    file.edges[i].type = "dashed";

    let source = file.edges[i].source;
    let target = file.edges[i].target;

    degrees[source] = !degrees[source] ? 1 : degrees[source] + 1;
    degrees[target] = !degrees[target] ? 1 : degrees[target] + 1;
}

for (var i = 0; i < file.nodes.length; i++) {
    let nodeId = file.nodes[i].key;
    let area = file.nodes[i].attributes["geographic area"];
    file.nodes[i].attributes.size = nodeId == 1 ? 30 : 10 + (degrees[nodeId] ?? 0);
    file.nodes[i].attributes.color = nodeColorsByArea[area] ? nodeColorsByArea[area] : "#8bd3c7";
}

file["attributes"] = undefined;
file["options"] = undefined;


//file.key = "new value";

fs.writeFile(fileName, JSON.stringify(file), function writeJSON(err) {
    if (err) return console.log(err);
    //console.log(JSON.stringify(file));
    console.log('writing to ' + fileName);
});