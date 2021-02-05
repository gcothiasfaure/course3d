"use strict";
// # Loading gpx file

// Define initial camera position
// var placement = {
//     coord: new itowns.Coordinates('EPSG:4326', 5.770120,45.208860),
//     range: 80000,
//     tilt: 45,
// }

var placement = {
    coord: new itowns.Coordinates('EPSG:4326', 2.351323, 48.856712),
    range: 25000000,
}
var promises = [];

// `viewerDiv` will contain iTowns' rendering area (`<canvas>`)
var viewerDiv = document.getElementById('viewerDiv');

// Instanciate iTowns GlobeView*
var view = new itowns.GlobeView(viewerDiv, placement);
var time = 50000;
var pathTravel = [];
const atmosphere = view.getLayerById('atmosphere');
atmosphere.setRealisticOn(false);


pathTravel.push({ coord: new itowns.Coordinates('EPSG:4326', 5.770120,45.208860), range: 100000, time: time * 0.2 });
pathTravel.push({ range: 13932, time: time * 0.2, tilt: 7.59, heading: -110.9 });
pathTravel.push({ tilt: 8, time: time * 0.2 });
pathTravel.push({ range: 70000, time: time * 0.2, tilt: 5, heading: -90 });

function addLayerCb(layer) {
    return view.addLayer(layer);
}

function travel() {
    var camera = view.camera.camera3D;
    return itowns.CameraUtils
        .sequenceAnimationsToLookAtTarget(view, camera, pathTravel);
}


// setupLoadingScreen(viewerDiv, view);


// Add one imagery layer to the scene
// This layer is defined in a json file but it could be defined as a plain js
// object. See Layer* for more info.
itowns.Fetcher.json('layers/Ortho.json').then(function _(config) {
    config.source = new itowns.WMTSSource(config.source);
    var layer = new itowns.ColorLayer('Ortho', config);
    view.addLayer(layer);
});
// Add two elevation layers.
// These will deform iTowns globe geometry to represent terrain elevation.
function addElevationLayerFromConfig(config) {
    config.source = new itowns.WMTSSource(config.source);
    var layer = new itowns.ElevationLayer(config.id, config);
    view.addLayer(layer);
}
itowns.Fetcher.json('layers/WORLD_DTM.json').then(addElevationLayerFromConfig);
itowns.Fetcher.json('layers/IGN_MNT_HIGHRES.json').then(addElevationLayerFromConfig);

// update the waypoint
var distance, scale, point = new itowns.THREE.Vector3();
var size = new itowns.THREE.Vector2();
function updatePointScale(renderer, scene, camera) {
    point.copy(this.geometry.boundingSphere.center).applyMatrix4(this.matrixWorld);;
    distance = camera.position.distanceTo(point);
    renderer.getSize(size);
    scale = Math.max(2, Math.min(100, distance / size.y));
    this.scale.set(scale, scale, scale);
    this.updateMatrixWorld();
}

var waypointGeometry = new itowns.THREE.BoxGeometry(1, 1, 80);
var waypointMaterial = new itowns.THREE.MeshBasicMaterial({ color: 0xffffff });
// Listen for globe full initialisation event
var waypoints = [];
view.addEventListener(itowns.GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED, function init() {
    console.info('Globe initialized');
    // itowns.Fetcher.xml('https://raw.githubusercontent.com/iTowns/iTowns2-sample-data/master/ULTRA2009.gpx')
    itowns.Fetcher.xml('gpx/tdfgm2020.gpx')
        .then(gpx => itowns.GpxParser.parse(gpx, {
            in: {
                crs: 'EPSG:4326',
            },
            out: {
                crs: view.referenceCrs,
                buildExtent: true,
                mergeFeatures: true,
            }
        }))
        .then(collection => itowns.Feature2Mesh.convert({
            color: new itowns.THREE.Color(0xffff00),
        })(collection))
        .then(function (mesh) {
            if (mesh) {
                mesh.traverse((m) => {
                    if (m.type == 'Line') {
                        m.material.linewidth = 20000;
                    }

                    // if (m.type == 'Points') {
                    //     var vertices = m.feature.vertices;
                    //     for (var i = 0; i < vertices.length; i++) {
                    //         var waypoint = new itowns.THREE.Mesh(waypointGeometry, waypointMaterial);
                    //         waypoint.position.set(
                    //             vertices[i * 3],
                    //             vertices[i * 3 + 1],
                    //             vertices[i * 3 + 2]);
                    //         waypoint.lookAt(0, 0, 0);
                    //         waypoint.onBeforeRender = updatePointScale;
                    //         waypoint.updateMatrixWorld();
                    //         waypoints.push(waypoint);
                    //     }
                    // }
                });
                mesh.add(...waypoints);
                mesh.updateMatrixWorld();
                view.scene.add(mesh);
                view.notifyChange();
            }
        },
        Promise.all(promises).then(function _() {
            // let's go
            travel().then(travel);
        }).catch(console.error));
});