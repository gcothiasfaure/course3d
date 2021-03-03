'use strict'


import {Coordinates,GlobeView,CameraUtils,VIEW_EVENTS,Fetcher,WMTSSource,ColorLayer,ElevationLayer,GpxParser,GLOBE_VIEW_EVENTS} from 'itowns';
import bsCustomFileInput from 'bs-custom-file-input';
import {Easing} from '@tweenjs/tween.js';
import {Vector3,CatmullRomCurve3,TubeGeometry,BufferGeometry,MeshBasicMaterial,Mesh,SphereGeometry} from 'three';


// For a dynamic file input in menu
bsCustomFileInput.init();


// Global variables
const beginBtn = document.getElementById('beginBtn');
const fileInput = document.getElementById('fileInput');
const menuContainer = document.getElementById('menuContainer');
const viewerDiv = document.getElementById('viewerDiv');
const ITOWNS_GPX_PARSER_OPTIONS = { in: { crs: 'EPSG:4326' } , out: { crs: 'EPSG:4326' , mergeFeatures: true } };
const FOLLOWING_CAMERA_TILT = 27;
const FOLLOWING_CAMERA_TIME = 500;
const STEP_NB_GEOMETRY_POSITIONS_3D_WAY = 100;
const INITIAL_CAMERA_TRAVEL_TIME = 15000;
const UPDATE_CAMERA_TIME = 700;

let pathTravel=[];
let currGeometryPosition=0;
let setIntervalToDraw3DWay;
let setIntervalUpdateFollowingCamera;
let nbGeometryPositions3DWay;
let way3DVerticesArray=[];
let currentDrawingPoint;
let previousCurrentDrawingPoint;
let newDrawingPoint;
let view;
let camera;
let loadingScreenContainer;
let atmosphere;
let iterationNumerinUpdateFollowingCamera = 0;


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

    document.body.style="overflow: hidden; height:100%;";

    setupLoadingScreen();

    parseGPXFile(gpxFile);
}


// Initialize 3D map by defining initial placement and loading the globe
function init3DMap() {

    const initialPlacement = {
        coord: new Coordinates('EPSG:4326', 2.351323, 48.856712),
        range: 25000000,
    }

    view = new GlobeView(viewerDiv, initialPlacement);

    camera = view.camera.camera3D;
    atmosphere = view.getLayerById('atmosphere');
    atmosphere.setRealisticOn(false);

    // Hide loader and display globe when initialized or after 5 sec
    view.addEventListener(GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, hideLoader);

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

    // Code repetition is mandatory here

    if (gpxFile) {

        let reader = new FileReader();

        reader.readAsText(gpxFile);

        reader.onloadend = function(){

            let parser = new DOMParser();

            let GPXXMLFile = parser.parseFromString(reader.result,"text/xml");

            GpxParser.parse(GPXXMLFile,ITOWNS_GPX_PARSER_OPTIONS)
            .then(parsedGPX =>{

                const allGPXcoord = parsedGPX.features[0].vertices;

                init3DMap();

                setUpEnvironmentAnd3DWay(allGPXcoord);

            })
        }
    }
    else{

        Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => GpxParser.parse(gpx,ITOWNS_GPX_PARSER_OPTIONS))
        .then(parsedGPX =>{

            const allGPXcoord = parsedGPX.features[0].vertices;

            init3DMap();

            setUpEnvironmentAnd3DWay(allGPXcoord);

        })
    }
}


// Trace GPX on map
function setUpEnvironmentAnd3DWay(allGPXcoord) {

    const startCoord = new Coordinates('EPSG:4326',allGPXcoord[0],allGPXcoord[1],allGPXcoord[2]+10);
    const secondCoord = new Coordinates('EPSG:4326',allGPXcoord[3],allGPXcoord[4],allGPXcoord[5]+10);
    const endCoord = new Coordinates('EPSG:4326',allGPXcoord[allGPXcoord.length-3],allGPXcoord[allGPXcoord.length-2],allGPXcoord[allGPXcoord.length-1]+10);

    // Add green sphere at start
    addSphere(startCoord.as(view.referenceCrs).toVector3(),0x21b710);
    
    // Add white sphere at end
    addSphere(endCoord.as(view.referenceCrs).toVector3(),0xffffff);

    setUp3DWay(allGPXcoord);

    // Wait a little after loading screen => brutal otherwise
    setTimeout(() => {

        const followingCameraPathFirstPosition = { 
            coord: startCoord, 
            range: startCoord.altitude + 5000, 
            time:  INITIAL_CAMERA_TRAVEL_TIME,  
            tilt: FOLLOWING_CAMERA_TILT, 
            heading: calculateHeadingBetweenTwoCoord4326(startCoord,secondCoord),
            easing:Easing.Quartic.Out
        }
        
        cameraTravel(followingCameraPathFirstPosition).then(() => {

            // Wait a little after camera positioned
            setTimeout(onCameraReadyToBegin, 3000);
    
        });
        
    }, 1000);

}


// When camera set up on the start point => trace can begin
function onCameraReadyToBegin() {

    setIntervalToDraw3DWay = setInterval(traceGPX, 40);

    setIntervalUpdateFollowingCamera = setInterval(updateFollowingCamera, UPDATE_CAMERA_TIME);
    
}


// Update parameters of the following camera to follow the 3D trace
function updateFollowingCamera() {
    const desiredCameraPositionIn4326 = new Coordinates(view.referenceCrs,currentDrawingPoint).as('EPSG:4326');

    let cameraParameters;
    let newHeading = null;

    if (previousCurrentDrawingPoint) {

        const previousCurrentDrawingPointCoord = new Coordinates(view.referenceCrs,previousCurrentDrawingPoint).as('EPSG:4326');

        iterationNumerinUpdateFollowingCamera++

        if (iterationNumerinUpdateFollowingCamera==5) {

            newHeading = calculateHeadingBetweenTwoCoord4326(previousCurrentDrawingPointCoord,desiredCameraPositionIn4326);

            iterationNumerinUpdateFollowingCamera=0;
        }
    }

    previousCurrentDrawingPoint = currentDrawingPoint;

    cameraParameters = {
        coord: desiredCameraPositionIn4326, 
        range: desiredCameraPositionIn4326.altitude+5000, 
        time:  UPDATE_CAMERA_TIME,
        tilt: FOLLOWING_CAMERA_TILT,
        heading:newHeading,
        easing:Easing.Linear.None
    }

    cameraTravel(cameraParameters);
}


// Init 3D way
function setUp3DWay(vertices) {

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
    way3DVerticesArray = geometry.attributes.position.array;

    // Init currentDrawingPoint
    currentDrawingPoint=new Vector3(way3DVerticesArray[0],
        way3DVerticesArray[1],
        way3DVerticesArray[2]);
        
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
function traceGPX() {

    if (currGeometryPosition>=nbGeometryPositions3DWay) {
        // End of drawing => finish trace and update of following camera
        clearInterval(setIntervalToDraw3DWay);
        clearInterval(setIntervalUpdateFollowingCamera);
        return;
    }

    currGeometryPosition = currGeometryPosition + STEP_NB_GEOMETRY_POSITIONS_3D_WAY;

    newDrawingPoint = new Vector3(way3DVerticesArray[currGeometryPosition*3],
                                    way3DVerticesArray[currGeometryPosition*3+1],
                                    way3DVerticesArray[currGeometryPosition*3+2]
    );

    if (newDrawingPoint.distanceTo(currentDrawingPoint)<50)     traceGPX();

    currentDrawingPoint = newDrawingPoint;

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


// Camera travel with one point
function cameraTravel(travelPathParam) {
    return CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, [travelPathParam]);
}


// Calculate heading between to coordinates in 4326
function calculateHeadingBetweenTwoCoord4326(coord1,coord2){

    let X = Math.cos(coord2.longitude * Math.PI / 180) *
        Math.sin((coord2.latitude - coord1.latitude) * Math.PI / 180);

    let Y = Math.cos(coord1.longitude * Math.PI / 180)*
        Math.sin(coord2.longitude * Math.PI / 180) -
        Math.sin(coord1.longitude * Math.PI / 180) *
        Math.cos(coord2.longitude * Math.PI / 180) *
        Math.cos((coord2.latitude - coord1.latitude) * Math.PI / 180);

    let beta = Math.atan2(X,Y) * 180 / Math.PI;

    return beta - 90;
}