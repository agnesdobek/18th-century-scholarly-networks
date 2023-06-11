
import Sigma from "sigma";
import Graph from "graphology";
import { Coordinates, EdgeDisplayData, NodeDisplayData } from "sigma/types";

import dataArea from "./area.json";
import dataReligion from "./religion.json";

// cluster definition
interface Cluster {
    label: string;
    x?: number;
    y?: number;
    color?: string;
    positions: { x: number; y: number }[];
}

// Type and declare internal state:
interface State {
    hoveredNode?: string;
    isNodeSelectionPermanent: boolean;
    searchQuery: string;

    // State derived from query:
    selectedNode?: string;
    suggestions?: Set<string>;

    // State derived from hovered node:
    hoveredNeighbors?: Set<string>;
    filteredEdges?: Set<string>;
    selectedEdgeCategory?: string;
    selectedEdgeCategoryItem?: HTMLElement;
}
const state: State = { searchQuery: "", isNodeSelectionPermanent: false };

var graph;

loadGraph(dataArea);

// Retrieve some useful DOM elements:
const container = document.getElementById("sigma-container") as HTMLElement;
const areaBtn = document.getElementById("area") as HTMLButtonElement;
const religionBtn = document.getElementById("religion") as HTMLButtonElement;
const zoomInBtn = document.getElementById("zoom-in") as HTMLButtonElement;
const zoomOutBtn = document.getElementById("zoom-out") as HTMLButtonElement;
const zoomResetBtn = document.getElementById("zoom-reset") as HTMLButtonElement;

const nodeDetails = document.getElementById("node-details") as HTMLElement;
const nodeDetailsName = document.getElementById("node-details-item-name") as HTMLElement;
const nodeDetailsArea = document.getElementById("node-details-item-area") as HTMLElement;
const nodeDetailsReligion = document.getElementById("node-details-item-religion") as HTMLElement;
const nodeDetailsOccupation = document.getElementById("node-details-item-occupation") as HTMLElement;

const nodeClearFilter = document.getElementById("node-clear-filter") as HTMLElement;
const legendClearFilter = document.getElementById("legend-clear-filter") as HTMLElement;

const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchSuggestions = document.getElementById("suggestions") as HTMLDataListElement;

areaBtn.addEventListener("click", () => {
    renderer.kill();
    loadGraph(dataArea);
    renderer = loadRenderer("geographic area", "Egyéb");
});
religionBtn.addEventListener("click", () => {
    renderer.kill();
    loadGraph(dataReligion);
    renderer = loadRenderer("religion", "?");
});

var renderer = loadRenderer("geographic area", "Egyéb");

const camera = renderer.getCamera();

// Bind zoom manipulation buttons
zoomInBtn.addEventListener("click", () => {
    camera.animatedZoom({ duration: 600 });
});
zoomOutBtn.addEventListener("click", () => {
    camera.animatedUnzoom({ duration: 600 });
});
zoomResetBtn.addEventListener("click", () => {
    camera.animatedReset({ duration: 600 });
});

Array.from(document.getElementsByClassName("legend-item")).forEach(legendItem => {
    legendItem.addEventListener("click", () => {
        setHoveredEdgeType(legendItem, legendItem.textContent, true);
    });
    legendItem.addEventListener("mouseover", () => {
        setHoveredEdgeType(legendItem, legendItem.textContent, false);
    });
    legendItem.addEventListener("mouseout", () => {
        setHoveredEdgeType(legendItem, undefined, false);
    });
});

nodeClearFilter.addEventListener("click", () => {
    setHoveredNode(undefined, true);
});
legendClearFilter.addEventListener("click", () => {
    setHoveredEdgeType(undefined, undefined, true);
});

// Instanciate sigma:
// attributes: https://github.com/jacomyal/sigma.js/blob/339be9ed274fcfb881ddd3585974ea7be46ca7dd/src/settings.ts#L34-L82
function loadRenderer(clusterAttribute, clusterOtherLabel) {
    const renderer = new Sigma(graph, container, {
        minCameraRatio: 0.3,
        maxCameraRatio: 1,

        labelDensity: 5,
        /*    labelDensity: 1,
    labelGridCellSize: 100,
    labelRenderedSizeThreshold: 6,*/
        labelRenderedSizeThreshold: 20,

        labelFont: "Poppins",
        labelWeight: "600",
        labelSize: 16,
        //labelWeight: "bold",
        labelColor: { "attribute": "", "color": "#444" },
        //renderEdgeLabels: true,
    });

    const clusterKeyCount = {};
    graph.forEachNode((node, atts) => {
        const itemClusterAttribute = atts[clusterAttribute];
        clusterKeyCount[itemClusterAttribute] = clusterKeyCount[itemClusterAttribute] ? clusterKeyCount[itemClusterAttribute] + 1 : 1;
    });

    const clustersWithLabel = []
    for (var key in clusterKeyCount) {
        if (key && key != "null" && clusterKeyCount[key] > 2) {
            clustersWithLabel.push(key);
        }
    }

    // initialize clusters from graph data
    const clusters: { [key: string]: Cluster } = {};
    graph.forEachNode((node, atts) => {
        var itemClusterAttribute = atts[clusterAttribute];
        if (!clustersWithLabel.includes(itemClusterAttribute)) {
            itemClusterAttribute = clusterOtherLabel;
        }
        if (!clusters[itemClusterAttribute]) {
            clusters[itemClusterAttribute] = { label: itemClusterAttribute, positions: [], color: atts.color };
        }
        clusters[itemClusterAttribute].positions.push({ x: atts.x, y: atts.y });
    });

    for (const itemClusterAttribute in clusters) {
        clusters[itemClusterAttribute].x =
            clusters[itemClusterAttribute].positions.reduce((acc, p) => acc + p.x, 0) / clusters[itemClusterAttribute].positions.length;
        clusters[itemClusterAttribute].y =
            clusters[itemClusterAttribute].positions.reduce((acc, p) => acc + p.y, 0) / clusters[itemClusterAttribute].positions.length;
    }

    // create the clustersLabel layer
    const clustersLayer = document.createElement("div");
    clustersLayer.id = "clustersLayer";
    let clusterLabelsDoms = "";
    for (const itemClusterAttribute in clusters) {
        const cluster = clusters[itemClusterAttribute];
        const viewportPos = renderer.graphToViewport(cluster as Coordinates);
        clusterLabelsDoms += `<div id='${cluster.label}' class="clusterLabel" style="top:${viewportPos.y}px;left:${viewportPos.x}px;color:${cluster.color}">${cluster.label}</div>`;
    }
    clustersLayer.innerHTML = clusterLabelsDoms;
    container.insertBefore(clustersLayer, document.getElementsByClassName("sigma-hovers")[0]);

    renderer.on("afterRender", () => {
        for (const itemClusterAttribute in clusters) {
            const cluster = clusters[itemClusterAttribute];
            const clusterLabel = document.getElementById(cluster.label);
            // update position from the viewport
            const viewportPos = renderer.graphToViewport(cluster as Coordinates);
            clusterLabel.style.top = `${viewportPos.y}px`;
            clusterLabel.style.left = `${viewportPos.x}px`;
        }
    });

    // Bind graph interactions:
    renderer.on("clickNode", ({ node }) => {
        setHoveredNode(node, true);
    });
    renderer.on("enterNode", ({ node }) => {
        setHoveredNode(node, false);
    });
    renderer.on("leaveNode", () => {
        setHoveredNode(undefined, false);
    });

    // Render nodes accordingly to the internal state:
    // 1. If a node is selected, it is highlighted
    // 2. If there is query, all non-matching nodes are greyed
    // 3. If there is a hovered node, all non-neighbor nodes are greyed
    renderer.setSetting("nodeReducer", (node, data) => {
        const res: Partial<NodeDisplayData> = { ...data };

        if (state.hoveredNeighbors && !state.hoveredNeighbors.has(node) && state.hoveredNode !== node) {
            res.label = "";
            res.color = "#f6f6f6";
        }

        if (state.selectedNode === node) {
            res.highlighted = true;
        } else if (state.suggestions && !state.suggestions.has(node)) {
            res.label = "";
            res.color = "#f6f6f6";
        }

        return res;
    });

    // Render edges accordingly to the internal state:
    // 1. If a node is hovered, the edge is hidden if it is not connected to the
    //    node
    // 2. If there is a query, the edge is only visible if it connects two
    //    suggestions
    renderer.setSetting("edgeReducer", (edge, data) => {
        const res: Partial<EdgeDisplayData> = { ...data };

        if (state.hoveredNode && !graph.hasExtremity(edge, state.hoveredNode)) {
            res.hidden = true;
        }

        if (state.filteredEdges && !state.filteredEdges.has(edge)) {
            res.hidden = true;
        }

        if (state.suggestions && (!state.suggestions.has(graph.source(edge)) || !state.suggestions.has(graph.target(edge)))) {
            res.hidden = true;
        }

        return res;
    });

    hideNodeDetails();

    return renderer;
}

// Feed the datalist autocomplete values:
searchSuggestions.innerHTML = graph
    .nodes()
    .map((node) => `<option value="${graph.getNodeAttribute(node, "label")}"></option>`)
    .join("\n");

// Actions:
function setSearchQuery(query: string) {
    state.searchQuery = query;

    if (searchInput.value !== query) searchInput.value = query;

    if (query) {
        const lcQuery = query.toLowerCase();
        const suggestions = graph
            .nodes()
            .map((n) => ({ id: n, label: graph.getNodeAttribute(n, "label") as string }))
            .filter(({ label }) => label.toLowerCase().includes(lcQuery));

        // If we have a single perfect match, them we remove the suggestions, and
        // we consider the user has selected a node through the datalist
        // autocomplete:
        if (suggestions.length === 1 && suggestions[0].label === query) {
            state.selectedNode = suggestions[0].id;
            setHoveredNode(suggestions[0].id, true);
            state.suggestions = undefined;

            // Move the camera to center it on the selected node:
            const nodePosition = renderer.getNodeDisplayData(state.selectedNode) as Coordinates;
            renderer.getCamera().animate(nodePosition, {
                duration: 500,
            });
        }
        // Else, we display the suggestions list:
        else {
            state.selectedNode = undefined;
            state.suggestions = new Set(suggestions.map(({ id }) => id));
        }
    }
    // If the query is empty, then we reset the selectedNode / suggestions state:
    else {
        if (!state.isNodeSelectionPermanent) {
            state.selectedNode = undefined;
        }
        state.suggestions = undefined;
    }

    // Refresh rendering:
    renderer.refresh();
}

// Bind search input interactions:
searchInput.addEventListener("input", () => {
    setSearchQuery(searchInput.value || "");
});
searchInput.addEventListener("blur", () => {
    setSearchQuery("");
});

function loadGraph(data) {
    graph = new Graph();
    graph.import(data);
}

function tearDown() {
    graph.clear();
    renderer.clear();
}

function setHoveredNode(node, isPermanent) {
    if (node) {
        if (!state.selectedEdgeCategory && (isPermanent || !state.isNodeSelectionPermanent)) {
            state.hoveredNode = node;
            state.hoveredNeighbors = new Set(graph.neighbors(node));
            state.isNodeSelectionPermanent = isPermanent;
            if (isPermanent) {
                state.selectedNode = node;
                nodeClearFilter.style.visibility = "visible";
            }
        }

        showNodeDetails(graph.getNodeAttributes(node));
    } else {
        if (!state.selectedEdgeCategory && (isPermanent || !state.isNodeSelectionPermanent)) {
            state.hoveredNode = undefined;
            state.hoveredNeighbors = undefined;
            state.isNodeSelectionPermanent = false;
            if (isPermanent) {
                state.selectedNode = undefined;
                nodeClearFilter.style.visibility = "hidden";
            }
        }

        hideNodeDetails();
    }

    renderer.refresh();
}

function setHoveredEdgeType(legendItem, edgeType, isPermanent) {
    if (state.selectedEdgeCategory && !isPermanent) {
        return;
    }

    if (isPermanent) {
        selectEdgeCategory(legendItem, edgeType);
    }


    if (edgeType) {
        state.hoveredNeighbors = new Set();
        state.filteredEdges = new Set();
        graph.forEachEdge((edge, edgeAttributes, source, target) => {
            if (edgeAttributes.label == edgeType) {
                state.filteredEdges.add(edge);
                state.hoveredNeighbors.add(source);
                state.hoveredNeighbors.add(target);
            }
        });
    } else {
        state.hoveredNeighbors = undefined;
        state.filteredEdges = undefined;
    }

    renderer.refresh();
}

function showNodeDetails(attributes) {
    nodeDetails.style.display = "";
    nodeDetailsName.innerHTML = attributes.label;
    nodeDetailsArea.innerHTML = attributes["geographic area"] == "null" ? "&nbsp;" : attributes["geographic area"];
    nodeDetailsReligion.innerHTML = attributes.religion == "null" ? "&nbsp;" : attributes.religion;
    nodeDetailsOccupation.innerHTML = attributes.occupation == "null" ? "&nbsp;" : attributes.occupation;
}


function hideNodeDetails() {
    nodeDetails.style.display = "none";
}

function selectEdgeCategory(legendItem, selectedEdgeCategory) {
    state.selectedEdgeCategoryItem?.classList.remove("legend-item-selected");
    state.selectedEdgeCategory = selectedEdgeCategory;
    state.selectedEdgeCategoryItem = legendItem;
    legendItem?.classList.add("legend-item-selected");

    legendClearFilter.style.visibility = selectedEdgeCategory ? "visible" : "hidden";
}