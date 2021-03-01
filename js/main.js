'use strict'


import {Coordinates,GlobeView,CameraUtils,VIEW_EVENTS,Fetcher,WMTSSource,ColorLayer,ElevationLayer,GpxParser} from 'itowns';
import bsCustomFileInput from 'bs-custom-file-input';
import {Vector3,CatmullRomCurve3,TubeGeometry,BufferGeometry,MeshBasicMaterial,Mesh,SphereGeometry} from 'three';


// For a dynamic file input in menu
bsCustomFileInput.init();


// Global variables
const beginBtn = document.getElementById('beginBtn');
const fileInput = document.getElementById('fileInput');
const menuContainer = document.getElementById('menuContainer');
const viewerDiv = document.getElementById('viewerDiv');
const ITOWNS_GPX_PARSER_OPTIONS = { in: { crs: 'EPSG:4326' } , out: { crs: 'EPSG:4326' , mergeFeatures: true } };
const INITIAL_CAMERA_RANGE = 7000;
const STEP_NB_GEOMETRY_POSITIONS_3D_WAY = 100;
const INITIAL_CAMERA_TRAVEL_TIME = 15000;

let pathTravel;
let time;
let currGeometryPosition=0;
let setIntervalToDraw3DWay;
let nbGeometryPositions3DWay;
let way_3d_positions;
let current_drawing_point;
let new_drawing_point;
let view;
let camera;
let loadingScreenContainer;
let promises;
let firstInitialCameraTravelPath=[];
let atmosphere;


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
function init3DMap() {

    // const placement = {
    //     coord: new Coordinates('EPSG:4326',initialLng,initialLat),
    //     range: INITIAL_CAMERA_RANGE,
    //     tilt: INITIAL_CAMERA_TILT,
    // }

    var placement = {
        coord: new Coordinates('EPSG:4326', 2.351323, 48.856712),
        range: 25000000,
    }

    view = new GlobeView(viewerDiv, placement);
    camera = view.camera.camera3D;
    atmosphere = view.getLayerById('atmosphere');
    atmosphere.setRealisticOn(false);

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
                init3DMap();

                view.addEventListener(VIEW_EVENTS.LAYERS_INITIALIZED,()=>{  traceGPX(vertices)   });

            })
        }
    }
    else{

        Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => GpxParser.parse(gpx,ITOWNS_GPX_PARSER_OPTIONS))
        .then(collection =>{

            const vertices = collection.features[0].vertices;
            init3DMap();
            for(let i = 0; i < vertices.length - 30; i +=30){
                let X = Math.cos(vertices[i + 30] * Math.PI / 180) *
                 Math.sin((vertices[i + 31] - vertices[i + 1]) * Math.PI / 180);
                let Y = Math.cos(vertices[i] * Math.PI / 180)*
                Math.sin(vertices[i + 30] * Math.PI / 180) -
                Math.sin(vertices[i] * Math.PI / 180) *
                Math.cos(vertices[i + 30] * Math.PI / 180) *
                Math.cos((vertices[i + 31] - vertices[i + 1]) * Math.PI / 180);

                let beta = Math.atan2(X,Y) * 180 / Math.PI;
                // console.log(beta);
                pathTravel.push({ coord: new Coordinates('EPSG:4326', vertices[i],vertices[i+1]), range: vertices[i+2] + 1000, time:  1000* time,  tilt: 30, heading: beta - 90});
            }
            view.addEventListener(VIEW_EVENTS.LAYERS_INITIALIZED,()=>{
                traceGPX(vertices);
                Promise.all(promises).then(function _() {
                    // let's go
                    // travel().then(travel);
                }).catch(console.error)
            });

        })
    }
}


// Trace GPX on map
function traceGPX(CoordVertices) {

    const initialLng=CoordVertices[0];
    const initialLat=CoordVertices[1];
    const initialAlt=CoordVertices[2]+10;
    const lastLng=CoordVertices[CoordVertices.length-3];
    const lastLat=CoordVertices[CoordVertices.length-2];
    const lastAlt=CoordVertices[CoordVertices.length-1]+10;

    firstInitialCameraTravel(initialLng,initialLat).then(() => {
        console.log("ret");
    });

    // Add green sphere at start
    addSphere(new Coordinates('EPSG:4326',initialLng,initialLat,initialAlt).as(view.referenceCrs).toVector3(),0x21b710);
    
    // Add white sphere at end
    addSphere(new Coordinates('EPSG:4326',lastLng,lastLat,lastAlt).as(view.referenceCrs).toVector3(),0xffffff);

    initWay(CoordVertices);

    setTimeout(() => {
        console.log("Start drawing");

        setIntervalToDraw3DWay = setInterval(() => {
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


// Init first camera travel from global earth to starting point of the 3D way
function firstInitialCameraTravel(initialLng,initialLat) {
    firstInitialCameraTravelPath.push({ coord: new Coordinates('EPSG:4326', initialLng,initialLat), range: INITIAL_CAMERA_RANGE, time: INITIAL_CAMERA_TRAVEL_TIME });
    return CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, firstInitialCameraTravelPath);
}

function travel() {
    return CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
}
