'use strict'


import * as itowns from 'itowns';
import bsCustomFileInput from 'bs-custom-file-input';


// For dynamic file input in menu
bsCustomFileInput.init();


// Global variables
const beginBtn = document.getElementById('beginBtn');
const fileInput = document.getElementById('fileInput');
const menuContainer = document.getElementById('menuContainer');
const viewerDiv = document.getElementById('viewerDiv');
const GPXParserOptions = {    in: {   crs: 'EPSG:4326'    },out: {    crs: 'EPSG:4326',   mergeFeatures: true }    };
const INITIAL_CAMERA_RANGE=500;
const INITIAL_CAMERA_TILT=90;
let view;
let loadingScreenContainer;


// Display menu :
beginBtn.addEventListener('click', onBegin);
// Skip menu :
//beginActivity(undefined);


// On user start, decide if launch activity with chosen GPX file or default one
function onBegin() {
    // Take in count the GPX file if user inputed one
    if(fileInput.value!="") beginActivity(fileInput.files[0]);
    // If not, default GPX
    else    beginActivity(undefined);
}


// Pass from menu to loader screen
function beginActivity(gpxFile) {

    // Remove menu and add viewerDiv class to viewerDiv
    menuContainer.remove();

    viewerDiv.classList.add("viewerDiv");

    setupLoadingScreen();

    parseGPXFile(gpxFile);
}


// Initialize 3D map by defining initial placement and loading the globe
function init3DMap(initialLng,initialLat) {

    const placement = {
        coord: new itowns.Coordinates('EPSG:4326',initialLng,initialLat),
        range: INITIAL_CAMERA_RANGE,
        tilt: INITIAL_CAMERA_TILT,
    }

    view = new itowns.GlobeView(viewerDiv, placement);

    // Detect when hide loader screen
    view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED, hideLoader);
    setTimeout(hideLoader, 5000);

    itowns.Fetcher.json('./layers/JSONLayers/Ortho.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        let layer = new itowns.ColorLayer('Ortho', config);
        view.addLayer(layer);
    });
    function addElevationLayerFromConfig(config) {
        config.source = new itowns.WMTSSource(config.source);
        let layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer);
    }
    itowns.Fetcher.json('./layers/JSONLayers/WORLD_DTM.json').then(addElevationLayerFromConfig);
    itowns.Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);
}


// Parse chosen GPX file or fetch the default one
function parseGPXFile(gpxFile) {
    if (gpxFile) {

        let reader = new FileReader();
        reader.readAsText(gpxFile);

        reader.onloadend = function(){

            let parser = new DOMParser();
            let GPXXMLFile = parser.parseFromString(reader.result,"text/xml");

            itowns.GpxParser.parse(GPXXMLFile,GPXParserOptions)
            .then(collection =>{

                console.log(collection);
                const vertices = collection.features[0].vertices;
                init3DMap(vertices[0],vertices[1]);

            })
        }
    }
    else{

        itowns.Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => itowns.GpxParser.parse(gpx,GPXParserOptions))
        .then(collection =>{

            console.log(collection);
            const vertices = collection.features[0].vertices;
            init3DMap(vertices[0],vertices[1]);

        })
    }
}


// Display the loader screen
function setupLoadingScreen() {

    loadingScreenContainer = document.createElement('div');
    let img = new Image(200,200);
    img.classList.add("loading-image");
    img.onload = function() {
        loadingScreenContainer.appendChild(img);
    }
    img.src = './assets/logo.png';
    loadingScreenContainer.id = 'itowns-loader';
    viewerDiv.appendChild(loadingScreenContainer);
}


// Hide the loader screen
function hideLoader() {
    if (!loadingScreenContainer)    return;

    loadingScreenContainer.style.opacity = 0;
    loadingScreenContainer.style.pointerEvents = 'none';
    loadingScreenContainer.style.transition = 'opacity 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)';

    loadingScreenContainer.addEventListener('transitionend', function _(e) {
        viewerDiv.removeChild(e.target);
    })

    loadingScreenContainer = null;
    view.removeEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED,hideLoader);
}