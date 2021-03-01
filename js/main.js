'use strict'


import {Coordinates,GlobeView,CameraUtils,VIEW_EVENTS,Fetcher,WMTSSource,ColorLayer,ElevationLayer,GpxParser} from 'itowns';
import bsCustomFileInput from 'bs-custom-file-input';
import {Vector3,CatmullRomCurve3,TubeGeometry,BufferGeometry,MeshBasicMaterial,Mesh,SphereGeometry} from 'three';
import * as THREE from 'three';

// For a dynamic file input in menu
bsCustomFileInput.init();


// Global variables
const beginBtn = document.getElementById('beginBtn');
const fileInput = document.getElementById('fileInput');
const menuContainer = document.getElementById('menuContainer');
const viewerDiv = document.getElementById('viewerDiv');
const ITOWNS_GPX_PARSER_OPTIONS = { in: { crs: 'EPSG:4326' } , out: { crs: 'EPSG:4326' , mergeFeatures: true } };
const INITIAL_CAMERA_RANGE = 5000;
const INITIAL_CAMERA_TILT = 89;
const STEP_NB_GEOMETRY_POSITIONS_3D_WAY = 100;

let pathTravel;
let time;
let currGeometryPosition=0;
let setIntervalToDraw3DWay;
let nbGeometryPositions3DWay;
let way_3d_positions;
let current_drawing_point;
let new_drawing_point;
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

    document.body.style="overflow: hidden;"
    setupLoadingScreen();

    parseGPXFile(gpxFile);
}


// Initialize 3D map by defining initial placement and loading the globe
function init3DMap(initialLng,initialLat) {

    const placement = {
        coord: new Coordinates('EPSG:4326',initialLng,initialLat),
        range: INITIAL_CAMERA_RANGE,
        tilt: INITIAL_CAMERA_TILT,
    }

    view = new GlobeView(viewerDiv, placement);
    time = 1;
    pathTravel = [];
    promises = [];
    // pathTravel.push({ coord: new Coordinates('EPSG:4326', 5.770120,45.208860), range: 100000, time: time * 0.2 });
    // pathTravel.push({ range: 13932, time: time * 0.2, tilt: 7.59, heading: -110.9 });
    // pathTravel.push({ tilt: 8, time: time * 0.2 });
    // pathTravel.push({ range: 70000, time: time * 0.2, tilt: 5, heading: -90 });
    // Detect when hide loader screen
    view.addEventListener(VIEW_EVENTS.LAYERS_INITIALIZED, hideLoader);
    setTimeout(hideLoader, 5000);

    Fetcher.json('./layers/JSONLayers/Ortho.json').then(function _(config) {
        config.source = new WMTSSource(config.source);
        let layer = new ColorLayer('Ortho', config);
        view.addLayer(layer);
    });
    function addElevationLayerFromConfig(config) {
        config.source = new WMTSSource(config.source);
        let layer = new ElevationLayer(config.id, config);
        view.addLayer(layer);
    }
    Fetcher.json('./layers/JSONLayers/WORLD_DTM.json').then(addElevationLayerFromConfig);
    Fetcher.json('./layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);
}


// Parse chosen GPX file or fetch the default one
function parseGPXFile(gpxFile) {
    if (gpxFile) {

        let reader = new FileReader();
        reader.readAsText(gpxFile);

        reader.onloadend = function(){

            let parser = new DOMParser();
            let GPXXMLFile = parser.parseFromString(reader.result,"text/xml");

            GpxParser.parse(GPXXMLFile,ITOWNS_GPX_PARSER_OPTIONS)
            .then(collection =>{

                const vertices = collection.features[0].vertices;
                init3DMap(vertices[0],vertices[1]);

                view.addEventListener(VIEW_EVENTS.LAYERS_INITIALIZED,()=>{  traceGPX(vertices)   });

            })
        }
    }
    else{

        Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => GpxParser.parse(gpx,ITOWNS_GPX_PARSER_OPTIONS))
        .then(collection =>{

            const vertices = collection.features[0].vertices;
            init3DMap(vertices[0],vertices[1]);
            
            view.addEventListener(VIEW_EVENTS.LAYERS_INITIALIZED,()=>{  
                traceGPX(vertices);
                
               });

        })
    }
}


// Trace GPX on map
function traceGPX(CoordVertices) {

    // Add green sphere at start
    addSphere(new Coordinates('EPSG:4326',CoordVertices[0],CoordVertices[1],CoordVertices[2]+10).as(view.referenceCrs).toVector3(),0x21b710);
    
    // Add white sphere at end
    addSphere(new Coordinates('EPSG:4326',CoordVertices[CoordVertices.length-3],CoordVertices[CoordVertices.length-2],CoordVertices[CoordVertices.length-1]+10).as(view.referenceCrs).toVector3(),0xffffff);

    initWay(CoordVertices);

    calculatePath(CoordVertices);
    // var camera =  new THREE.PerspectiveCamera( 84, window.innerWidth / window.innerHeight, 0.01, 1000 );
    travel().then(travel());
    // var camera = view.camera.camera3D;
    
    // let i = 0
    setTimeout(() => {
        
        
        setIntervalToDraw3DWay = setInterval(() => {
            // CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
            // i += 1;
            updateWay();
        }, 40);
        
    }, 2000);

}


// Init 3D way
function initWay(vertices) {

    let coordList=[];

    for (let i = 0; i < vertices.length/3; i++) {
        coordList.push(new Coordinates('EPSG:4326',vertices[i*3],vertices[i*3+1],vertices[i*3+2]+5).as(view.referenceCrs).toVector3());
    }

    const pipeSpline = new CatmullRomCurve3( coordList );

    let geometry = new TubeGeometry( pipeSpline,coordList.length*10,10,8, false );
    geometry = new BufferGeometry().fromGeometry( geometry );

    // Do not display the geometry
    geometry.setDrawRange(0,0);

    // Init the display of the geometry
    nbGeometryPositions3DWay = geometry.attributes.position.count;
    way_3d_positions = geometry.attributes.position.array;

    current_drawing_point=new Vector3(way_3d_positions[0],
        way_3d_positions[1],
        way_3d_positions[2]);
        
    geometry.attributes.position.needsUpdate = true;

    const material = new MeshBasicMaterial( { color: 0xff0000 } );

    const mesh = new Mesh( geometry, material );
    
    // update coordinate of the mesh
    mesh.updateMatrixWorld();

    // add the mesh to the scene
    view.scene.add(mesh);
    view.way=mesh;

    // Notify view to update
    view.notifyChange();
}


// Update 3D way
function updateWay() {

    if (currGeometryPosition>=nbGeometryPositions3DWay) {
        clearInterval(setIntervalToDraw3DWay);
        console.log("End drawing");
        return;
    }

    currGeometryPosition = currGeometryPosition + STEP_NB_GEOMETRY_POSITIONS_3D_WAY;

    new_drawing_point = new Vector3(way_3d_positions[currGeometryPosition*3],
                                            way_3d_positions[currGeometryPosition*3+1],
                                            way_3d_positions[currGeometryPosition*3+2]);

    if (new_drawing_point.distanceTo(current_drawing_point)<60)     updateWay();

    current_drawing_point=new_drawing_point;

    view.way.geometry.setDrawRange(0,currGeometryPosition);
    view.way.geometry.verticesNeedUpdate=true;
    view.notifyChange();
}


// Add a shere to 3D map
function addSphere(coord,color) {

    var geometry = new SphereGeometry( 20, 32, 32 );
    var material = new MeshBasicMaterial({ color: color });
    var mesh = new Mesh(geometry, material);

    // position and orientation of the mesh
    mesh.position.copy(coord);

    // update coordinate of the mesh
    mesh.updateMatrixWorld();

    // add the mesh to the scene
    view.scene.add(mesh);

    // Notify view to update
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
}


function calculatePath(CoordVertices){
    for(let i = 0; i < CoordVertices.length - 30; i +=30){
        let X = Math.cos(CoordVertices[i + 30] * Math.PI / 180) *
         Math.sin((CoordVertices[i + 31] - CoordVertices[i + 1]) * Math.PI / 180);
        let Y = Math.cos(CoordVertices[i] * Math.PI / 180)*
        Math.sin(CoordVertices[i + 30] * Math.PI / 180) -
        Math.sin(CoordVertices[i] * Math.PI / 180) *
        Math.cos(CoordVertices[i + 30] * Math.PI / 180) *
        Math.cos((CoordVertices[i + 31] - CoordVertices[i + 1]) * Math.PI / 180);

        let beta = Math.atan2(X,Y) * 180 / Math.PI;
        pathTravel.push({ coord: new Coordinates('EPSG:4326', CoordVertices[i],CoordVertices[i+1]), range: CoordVertices[i+2] + 5000, time:  500* time,  tilt: 30, heading: beta - 90});
    }
}
function travel() {
    var camera = view.camera.camera3D;
   
    // console.log("je passe");
    return CameraUtils
        .sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
}
