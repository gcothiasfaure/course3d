'use strict'


import * as itowns from 'itowns';
import bsCustomFileInput from 'bs-custom-file-input';
import * as THREE from 'three';
import * as DEMUtils from 'itowns/lib/Utils/DEMUtils.js';


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
let pathTravel;
let time;
let view;
let loadingScreenContainer;
let promises;

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
    time = 1;
    pathTravel = [];
    promises = [];
    // pathTravel.push({ coord: new itowns.Coordinates('EPSG:4326', 5.770120,45.208860), range: 100000, time: time * 0.2 });
    // pathTravel.push({ range: 13932, time: time * 0.2, tilt: 7.59, heading: -110.9 });
    // pathTravel.push({ tilt: 8, time: time * 0.2 });
    // pathTravel.push({ range: 70000, time: time * 0.2, tilt: 5, heading: -90 });
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

                const vertices = collection.features[0].vertices;
                init3DMap(vertices[0],vertices[1]);

                view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED,()=>{  traceGPX(vertices)   });

            })
        }
    }
    else{

        itowns.Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => itowns.GpxParser.parse(gpx,GPXParserOptions))
        .then(collection =>{

            const vertices = collection.features[0].vertices;
            init3DMap(vertices[0],vertices[1]);
            // pathTravel.push({ range: 1000, time: time, tilt: 5.59, heading: -40.9 });
            
            for(let i = 0; i < vertices.length - 30; i +=30){
                let X = Math.cos(vertices[i + 30] * Math.PI / 180) *
                 Math.sin((vertices[i + 31] - vertices[i + 1]) * Math.PI / 180);
                let Y = Math.cos(vertices[i] * Math.PI / 180)*
                Math.sin(vertices[i + 30] * Math.PI / 180) -
                Math.sin(vertices[i] * Math.PI / 180) *
                Math.cos(vertices[i + 30] * Math.PI / 180) *
                Math.cos((vertices[i + 31] - vertices[i + 1]) * Math.PI / 180);

                let beta = Math.atan2(X,Y) * 180 / Math.PI;
                // let dab = Math.sqrt(
                //     Math.pow((vertices[i + 30] - vertices[i]),2) 
                //     + Math.pow((vertices[i + 31] - vertices[i + 1]),2)
                //      );
                // let a = 2 * Math.atan(
                //     (vertices[i + 30] - vertices[i])
                //     /( dab
                //     +  (vertices[i + 31] - vertices[i + 1])
                //      ));
                console.log(beta);
                pathTravel.push({ coord: new itowns.Coordinates('EPSG:4326', vertices[i],vertices[i+1]), range: vertices[i+2] + 1000, time:  1000* time,  tilt: 30, heading: beta - 90});
            }
            view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED,()=>{  
                traceGPX(vertices);
                Promise.all(promises).then(function _() {
                    // let's go
                    travel().then(travel);
                }).catch(console.error)
               });

        })
    }
}


// Trace GPX on map
function traceGPX(vertices) {
    addCurve(vertices);
}


// Compute elevation according to the layer if available
function computeElevation(lng,lat,alt) {
    let realAlt;

    const coord = new itowns.Coordinates('EPSG:4326',lng,lat);

    let computedAlt = DEMUtils.default.getElevationValueAt(view.tileLayer,coord,1);

    if (computedAlt)    realAlt = computedAlt;
    else                realAlt = alt;

    const computedPoint = new itowns.Coordinates('EPSG:4326',lng,lat,realAlt+3).as(view.referenceCrs);
    
    return computedPoint.toVector3();
}


// Add the curve to the 3D map
function addCurve(vertices) {

    let coordList=[];

    for (var i = 0; i < 1000; i++){

        let currentPoint = {
            lng:vertices[i*3],
            lat:vertices[i*3 + 1],
            alt:vertices[i*3 + 2]
        }

        coordList.push(computeElevation(currentPoint.lng,currentPoint.lat,currentPoint.alt));
    }

    const pipeSpline = new THREE.CatmullRomCurve3( coordList );

    const geometry = new THREE.TubeGeometry( pipeSpline, 2000, 2, 20, false );
    const material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    const mesh = new THREE.Mesh( geometry, material );
    
    // update coordinate of the mesh
    mesh.updateMatrixWorld();

    // add the mesh to the scene
    view.scene.add(mesh);

    // make the object usable from outside of the function
    view.mesh = mesh;
    view.notifyChange();
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



function travel() {
    var camera = view.camera.camera3D;

    return itowns.CameraUtils
        .sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
}
