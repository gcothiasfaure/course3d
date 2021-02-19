'use strict'

import * as itowns from 'itowns';
import * as THREE from 'three';
import * as DEMUtils from 'itowns/lib/Utils/DEMUtils.js'


const beginBtn = document.getElementById('beginBtn');
const fileInput = document.getElementById('fileInput');
const menu = document.getElementById('menu');
var viewerDiv = document.getElementById('viewerDiv');

var view;


beginBtn.addEventListener('click', () => {
    console.log("go");
    beginActivity(fileInput);
})


function beginActivity(gpxFile) {

    menu.remove();
    viewerDiv.classList.add("viewerDiv");
    
    console.log(gpxFile);
    
    var placement = {
        coord: new itowns.Coordinates('EPSG:4326', 0.089, 42.8989),
        range: 500,
        tilt: 45,
    }

    

    view = new itowns.GlobeView(viewerDiv, placement);

    setupLoadingScreen(viewerDiv, view);

    itowns.Fetcher.json('./node_modules/itowns/examples/layers/JSONLayers/Ortho.json').then(function _(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ColorLayer('Ortho', config);
        view.addLayer(layer);
    });
    function addElevationLayerFromConfig(config) {
        config.source = new itowns.WMTSSource(config.source);
        var layer = new itowns.ElevationLayer(config.id, config);
        view.addLayer(layer);
    }
    itowns.Fetcher.json('./node_modules/itowns/examples/layers/JSONLayers/WORLD_DTM.json').then(addElevationLayerFromConfig);
    itowns.Fetcher.json('./node_modules/itowns/examples/layers/JSONLayers/IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);

    view.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED,onViewLoad);
}





function onViewLoad() {
    
    console.info('Globe initialized');
    const coord = new itowns.Coordinates('EPSG:4326', 0.089, 42.8989);
    console.log(view.tileLayer);
    console.log(coord);
    const alt = DEMUtils.default.getElevationValueAt(view.tileLayer,coord,1);

    const sherePoint = new itowns.Coordinates('EPSG:4326',0.089, 42.8989,alt+5).as(view.referenceCrs);

    addSphere(sherePoint);

    itowns.Fetcher.xml('./gpx/tdfgm2020.gpx')
        .then(gpx => itowns.GpxParser.parse(gpx, {
            in: {
                crs: 'EPSG:4326',
            },
            out: {
                crs: 'EPSG:4326',
                mergeFeatures: true,
            }
        }))
        .then(collection =>{
            console.log(collection)
        })
}


function addSphere(coord) {

    var geometry = new THREE.SphereGeometry( 5, 32, 32 );
    var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var mesh = new THREE.Mesh(geometry, material);

    // position and orientation of the mesh
    mesh.position.copy(coord.toVector3());

    // update coordinate of the mesh
    mesh.updateMatrixWorld();

    // add the mesh to the scene
    view.scene.add(mesh);

    // make the object usable from outside of the function
    view.mesh = mesh;
    view.notifyChange();
}


function setupLoadingScreen(viewerDiv, view) {
    var loadingScreenContainer;

    // loading screen
    loadingScreenContainer = document.createElement('div');
    // eslint-disable-next-line no-multi-str
    loadingScreenContainer.innerHTML = '\
        <div>\
        <p>Je charge gros</p>\
        </div>';
    loadingScreenContainer.id = 'itowns-loader';
    viewerDiv.appendChild(loadingScreenContainer);

    // auto-hide in 3 sec or if view is loaded
    function hideLoader() {
        if (!loadingScreenContainer) {
            return;
        }
        loadingScreenContainer.style.opacity = 0;
        loadingScreenContainer.style.pointerEvents = 'none';
        loadingScreenContainer.style.transition = 'opacity 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)';

        loadingScreenContainer.addEventListener('transitionend', function _(e) {
            viewerDiv.removeChild(e.target);
        });
        loadingScreenContainer = null;
        view.removeEventListener(
            itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
            hideLoader);
    }

    view.addEventListener(itowns.VIEW_EVENTS.LAYERS_INITIALIZED, hideLoader);
    setTimeout(hideLoader, 3000);
}