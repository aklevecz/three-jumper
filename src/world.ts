import * as THREE from "three";
import { OBJLoader } from "../node_modules/three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "../node_modules/three/examples/jsm/loaders/MTLLoader.js";

import { DDSLoader } from "../node_modules/three/examples/jsm/loaders/DDSLoader.js";
import { math } from "./math";
import ConeOBJ from "./objects/cone1.obj";
import ConeMTL from "./objects/cone1.mtl";
import { LoadingManager } from "three";

type WorldParams = {
  scene: THREE.Scene;
};

const START_POS = 100;
const SEPARATION_DISTANCE = 20;

class WorldObject {
  private _position = new THREE.Vector3(0, 0, 0);
  private _quaternion = new THREE.Quaternion();
  private _scale: number = 1.0;
  private _collider = new THREE.Box3();
  private _mesh = new THREE.Group();

  private _params: WorldParams;

  constructor(params: WorldParams) {
    this._params = params;
    this._LoadModel();
  }

  _LoadModel() {
    // this._mesh = new THREE.Mesh(
    //   new THREE.SphereGeometry(),
    //   new THREE.MeshBasicMaterial({ color: "purple" })
    // );

    // this._params.scene.add(this._mesh);

    // const loader = new OBJLoader();
    // loader.load(ConeOBJ, (obj) => {
    //   console.log(obj);
    //   this._mesh = obj;
    //   this._params.scene.add(obj);
    // });

    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new DDSLoader());

    new MTLLoader(manager).load(ConeMTL, (materials) => {
      materials.preload();
      new OBJLoader(manager).setMaterials(materials).load(ConeOBJ, (object) => {
        object.traverse((c) => {
          c.castShadow = true;
          c.receiveShadow = true;
        });
        this._mesh = object;
        this._params.scene.add(object);
      });
    });
  }

  _UpdateCollider() {
    this._collider.setFromObject(this._mesh);
  }

  Update(timeElapsed: number) {
    if (!this._mesh) {
      return;
    }
    this._mesh.position.copy(this._position);
    this._mesh.quaternion.copy(this._quaternion);
    this._mesh.scale.setScalar(this._scale);
    this._UpdateCollider();
  }
}

class WorldManager {
  private _objects: any[] = [];
  private _unused: any[] = [];
  private _speed = 22;
  private _score = 0.0;
  private _scoreText = "00000";
  private _separationDistance = SEPARATION_DISTANCE;
  private _params: WorldParams;
  constructor(params: WorldParams) {
    this._params = params;
  }

  GetColliders() {
    return this._objects;
  }

  _LastObjectPosition() {
    if (this._objects.length === 0) {
      return SEPARATION_DISTANCE;
    }

    return this._objects[this._objects.length - 1]._position.x;
  }

  _SpawnObj(scale: number, offset: number) {
    let obj = null;

    if (this._unused.length > 0) {
      obj = this._unused.pop();
      obj._mesh.visible = true;
    } else {
      obj = new WorldObject(this._params);
    }
    // obj._quaternion.setFromAxisAngle(
    //   new THREE.Vector3(0, 1, 0),
    //   Math.random() * Math.PI * 2.0
    // );
    obj._position.x = START_POS + offset;
    // obj._scale = scale * 0.01;
    this._objects.push(obj);
  }

  _SpawnCluster() {
    const scaleIndex = math.rand_int(0, 1);
    const scales = [2, 3.5];
    const ranges = [2, 3];
    const scale = scales[scaleIndex];
    const numObjects = math.rand_int(1, ranges[scaleIndex]);

    for (let i = 0; i < numObjects; i++) {
      const offset = i * 1 * scale;
      this._SpawnObj(scale, offset);
    }
  }

  _MaybeSpawn() {
    const closest = this._LastObjectPosition();
    if (Math.abs(START_POS - closest) > this._separationDistance) {
      this._SpawnCluster();
      this._separationDistance = math.rand_range(
        SEPARATION_DISTANCE,
        SEPARATION_DISTANCE * 1.5
      );
    }
  }

  Update(timeElapsed: number) {
    this._MaybeSpawn();
    this._UpdateColliders(timeElapsed);
    this._UpdateScore(timeElapsed);
  }

  _UpdateScore(timeElapsed: number) {
    this._score += timeElapsed + 10;

    const scoreText = Math.round(this._score).toLocaleString("en-US", {
      minimumIntegerDigits: 5,
      useGrouping: false,
    });

    if (scoreText == this._scoreText) {
      return;
    }

    document.getElementById("score-board").innerText = scoreText;
  }

  _UpdateColliders(timeElapsed: number) {
    const invisible = [];
    const visible = [];

    for (let obj of this._objects) {
      obj._position.x -= timeElapsed * this._speed;

      if (obj._position.x < -20) {
        invisible.push(obj);
        obj._mesh.visible = false;
      } else {
        visible.push(obj);
      }

      obj.Update(timeElapsed);
    }

    this._objects = visible;
    this._unused.push(...invisible);
  }
}

export { WorldManager };
