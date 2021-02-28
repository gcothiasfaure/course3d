# <img src="./assets/logo.png" width="50" height="50" alt="logo"/> Course3d

**Course3d** est un outil de visualisation web d'un parcours dans un environnement 3D à caméra dynamique, basé sur [iTowns](https://github.com/iTowns/itowns).

Il a été dévelppé dans le cadre du mini projet 3D de TSI C 2021.

## Déploiement

**Course3d** est déployé à cette adresse : https://gaspardcothiasfaure.github.io/course3d/

## Installation

Le code source (JavaScript) de **Course3d** se trouve dans [./js/main.js](./js/main.js)

Pour installer **Course3d** : 

- Copiez le dépôt
- A la racine du dépot : `npm install`

**Course3d** utilise [Webpack](https://github.com/webpack/webpack) comme groupeur de modules JavaScript :
- Pour lancer un build en mode développement : `npm run build-dev`
- Pour lancer un build en mode production : `npm run build-prod`
- Pour lancer un build à chaque  nouvelle sauvegarde du code source : `npm run autobuild`

Dans chaque cas, un *bundle* est généré ([./dist/bundle.js](./dist/bundle.js)), il est lié aux autres fichiers statiques de **Course3d**.

## Librairies utilisées

- [iTowns](https://github.com/iTowns/itowns)

- [three.js](https://github.com/mrdoob/three.js)

- [Bootstrap](https://github.com/twbs/bootstrap)

## Auteurs

- Gaspard Cothias Faure
- Félix Quinton
