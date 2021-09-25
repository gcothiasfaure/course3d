# <img src="./assets/logo.png" width="50" height="50" alt="logo"/> Course3d

**Course3d** is a web-based visualization tool of a course in a 3D dynamic camera environment, based on [iTowns](https://github.com/iTowns/itowns).

It was developed in the context of the 3D project of TSI-C 2021 at ENSG.

## Quick start

To use **Course3d**, import the GPX track of your course at the home page. Then visualize your course in a 3D environment with a dynamic camera. 

You can also view the default course proposed by **Course3d**.

A GPX trace (different from the default one) is available in this repository at [./gpx/tdfcml2020.gpx](./gpx/tdfcml2020.gpx).

## Demo

### Photos of the different stages when using Course3d :

When you connect to the site you arrive on the homepage, you can either add your own GPX file or use the GPX file proposed by default by **Course3d** :
# <img src="./assets/acceuil.PNG" width="320" height="180" alt="acceuil"/>

Once your GPX file is entered and after the loading screen, you will be moved from the globe to the first point of your GPX track symbolized by a green sphere.

# <img src="./assets/initialisation.PNG" width="320" height="180" alt="initialisation"/>

The path will then start to follow the GPX track and the camera will follow the route.

# <img src="./assets/suivit.PNG" width="320" height="180" alt="suivit"/>

At regular intervals, the camera aligns itself with the head of the track, so that even in mountainous areas the recent track is on the screen most of the time.

# <img src="./assets/montagne_pe.PNG" width="320" height="180" alt="montagne_pe"/>

Finally, when the track reaches the end of the GPX trace, the last point is displayed in white and the camera stops.

# <img src="./assets/arrive_pe.png" width="320" height="180" alt="arrive"/>

### Video demo :

Link to video demo (YouTube) : https://youtu.be/TwzuJKuZqaA

## Installation

To install **Course3d** : 

- Copy the repo
- At root : `npm install --legacy-peer-deps`

**Course3d** uses [Webpack](https://github.com/webpack/webpack) :
- To run a build in development mode : `npm run build-dev`
- To run a build in production mode : `npm run build-prod`
- To run a build at each source code save : `npm run autobuild`

> **NOTE :**
> 
> When cloning the repository, the *bundle* is in production version

## Implemented features

**Course3d** allows the user to visualize his course (imported via his GPX track in the menu) in a 3D environment with a dynamic camera.
After importing the track (or starting with the default track), **Course3d** allows the user to view :

- A camera animation of a view of the globe towards the starting point of the trail
- Start and finish point markers
- A dynamic and constant display of the course layout
- The route from a dynamic camera that follows the progress of the route

## Possible improvements

- Allow the user to:
  - Pause the plot and camera movement
  - Choose the duration of the plot and its colour
  - Enter a plot from another format (KML, JSON, GeoJSON ..)
- Do not allow the user to stop the dynamic visualisation by touching the 3D map
- Improve the fluidity of the tracking camera's movement
- Pre-load the tiles of the plot
- Display a countdown before the start of the track
- Allow the user to return to the menu at the end of the track
- Add a rotation of the camera around the finish point at the end of the track
- Improve camera positions/orientations to always see the trail optimally (hidden by mountains)

## Stack

- [iTowns](https://github.com/iTowns/itowns)

- [three.js](https://github.com/mrdoob/three.js)

- [Bootstrap](https://github.com/twbs/bootstrap)

- [tween.js](https://github.com/tweenjs/tween.js)

- [bs-custom-file-input](https://github.com/Johann-S/bs-custom-file-input)
