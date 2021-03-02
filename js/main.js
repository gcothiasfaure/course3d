'use strict'


import {Coordinates,GlobeView,CameraUtils,VIEW_EVENTS,Fetcher,WMTSSource,ColorLayer,ElevationLayer,GpxParser,GLOBE_VIEW_EVENTS} from 'itowns';
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
const FOLLOWING_CAMERA_TILT = 30;
const FOLLOWING_CAMERA_TIME = 500;
const STEP_NB_GEOMETRY_POSITIONS_3D_WAY = 100;
const INITIAL_CAMERA_TRAVEL_TIME = 15;
const FOLLOWING_CAMERA_UP_VECTOR3 = new Vector3(0,0,1);

let pathTravel=[];
let currGeometryPosition=0;
let setIntervalToDraw3DWay;
let nbGeometryPositions3DWay;
let way3DVerticesArray=[];
let currentDrawingPoint;
let newDrawingPoint;
let view;
let camera;
let loadingScreenContainer;
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

    document.body.style="overflow: hidden;";

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

    const initialLng=allGPXcoord[0];
    const initialLat=allGPXcoord[1];
    const initialAlt=allGPXcoord[2]+10;
    const lastLng=allGPXcoord[allGPXcoord.length-3];
    const lastLat=allGPXcoord[allGPXcoord.length-2];
    const lastAlt=allGPXcoord[allGPXcoord.length-1]+10;

    // Add green sphere at start
    addSphere(new Coordinates('EPSG:4326',initialLng,initialLat,initialAlt).as(view.referenceCrs).toVector3(),0x21b710);
    
    // Add white sphere at end
    addSphere(new Coordinates('EPSG:4326',lastLng,lastLat,lastAlt).as(view.referenceCrs).toVector3(),0xffffff);

    setUp3DWay(allGPXcoord);

    const followingCameraPath = calculateFollowingCameraPath(allGPXcoord);

    const followingCameraPathFirstPosition = Object.assign({}, followingCameraPath[0]);

    initialCameraTravel(followingCameraPathFirstPosition).then(() => {

        // Wait a little after camera positioned
        setTimeout(() => {
            onCameraReadyToBegin();
        }, 3000);

    });
}


// When camera set up on the start point => trace can begin
function onCameraReadyToBegin() {

    // followingCameraTravel().then(followingCameraTravel);

    const positionVector3 = new Vector3(way3DVerticesArray[0]+200,way3DVerticesArray[1]+200,way3DVerticesArray[2]+200)
    const lookAtVector3 = new Vector3(way3DVerticesArray[3000],way3DVerticesArray[3001],way3DVerticesArray[3002])
    setFollowingCameraPositionAndLookAt(positionVector3,lookAtVector3);

    setIntervalToDraw3DWay = setInterval(() => {
        traceGPX();
    }, 40);

}


// Position camera following the 3D way
function setFollowingCameraPositionAndLookAt(positionVector3,lookAtVector3) {
    camera.position.copy(positionVector3);
    camera.matrix.lookAt(positionVector3,lookAtVector3,FOLLOWING_CAMERA_UP_VECTOR3);
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
        clearInterval(setIntervalToDraw3DWay);
        return;
    }

    currGeometryPosition = currGeometryPosition + STEP_NB_GEOMETRY_POSITIONS_3D_WAY;

    newDrawingPoint = new Vector3(way3DVerticesArray[currGeometryPosition*3],
                                            way3DVerticesArray[currGeometryPosition*3+1],
                                            way3DVerticesArray[currGeometryPosition*3+2]);

    if (newDrawingPoint.distanceTo(currentDrawingPoint)<60)     traceGPX();

    currentDrawingPoint = newDrawingPoint;

    let currentDrawingPointIn4326 = new Coordinates(view.referenceCrs,currentDrawingPoint).as('EPSG:4326');
    // currentDrawingPointIn4326.altitude.set(300);

    console.log(currentDrawingPointIn4326);

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
function initialCameraTravel(followingCameraPathFirstPosition) {
    followingCameraPathFirstPosition.time = INITIAL_CAMERA_TRAVEL_TIME;
    return CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, [followingCameraPathFirstPosition]);
}


// Calculate the path of the following camera above the 3D way
function calculateFollowingCameraPath(allGPXcoord){

    for(let i = 0; i < allGPXcoord.length - 30; i +=30){

        let X = Math.cos(allGPXcoord[i + 30] * Math.PI / 180) *
         Math.sin((allGPXcoord[i + 31] - allGPXcoord[i + 1]) * Math.PI / 180);
        let Y = Math.cos(allGPXcoord[i] * Math.PI / 180)*
        Math.sin(allGPXcoord[i + 30] * Math.PI / 180) -
        Math.sin(allGPXcoord[i] * Math.PI / 180) *
        Math.cos(allGPXcoord[i + 30] * Math.PI / 180) *
        Math.cos((allGPXcoord[i + 31] - allGPXcoord[i + 1]) * Math.PI / 180);

        let beta = Math.atan2(X,Y) * 180 / Math.PI;
        pathTravel.push({ coord: new Coordinates('EPSG:4326', allGPXcoord[i],allGPXcoord[i+1]), range: allGPXcoord[i+2] + 5000, time:  FOLLOWING_CAMERA_TIME,  tilt: FOLLOWING_CAMERA_TILT, heading: beta - 90});

    }

    return pathTravel;
}


// Following camera travel above the 3D way 
function followingCameraTravel() {
    return CameraUtils.sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
}