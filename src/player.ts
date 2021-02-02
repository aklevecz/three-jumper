import * as THREE from "three";
import { WorldManager } from "./world";
import { OBJLoader } from "../node_modules/three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "../node_modules/three/examples/jsm/loaders/MTLLoader.js";
import { DDSLoader } from "../node_modules/three/examples/jsm/loaders/DDSLoader.js";

import FrogOBJ from "./objects/Frog.obj";
import FrogMTL from "./objects/Frog.mtl";
type PlayerParams = {
  scene: THREE.Scene;
  world: WorldManager;
};

class Player {
  private _position = new THREE.Vector3(0, 5, 0);
  private _velocity = 0.0;
  private _playerBox = new THREE.Sphere();
  private _mesh: THREE.Group;
  private _keys: { spacebar?: boolean; space?: boolean };

  // I dunno what this is for
  private oldKeys: any;

  private _params: PlayerParams;

  public gameOver = false;

  constructor(params: PlayerParams) {
    this._params = params;

    this._LoadModel();
    this._InitInput();
  }

  _LoadModel() {
    // this._mesh = new THREE.Mesh(
    // new THREE.SphereGeometry(),
    // new THREE.MeshBasicMaterial({ color: "white" })
    // );

    // this._params.scene.add(this._mesh);
    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new DDSLoader());

    new MTLLoader(manager).load(FrogMTL, (materials) => {
      materials.preload();
      new OBJLoader(manager).setMaterials(materials).load(FrogOBJ, (object) => {
        object.scale.setScalar(0.06);
        object.quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI / 2
        );
        object.traverse((c) => {
          c.castShadow = true;
        });
        this._mesh = object;
        this._params.scene.add(object);
      });
    });
  }

  _InitInput() {
    this._keys = {
      spacebar: false,
    };
    this.oldKeys = { ...this._keys };

    document.addEventListener("keydown", this._OnKeyDown, false);
    document.addEventListener("keyup", this._OnKeyUp, false);
  }

  _OnKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case "Space":
        this._keys.space = true;
        break;
    }
  };

  _OnKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case "Space":
        this._keys.space = false;
        break;
    }
  };

  _CheckCollision() {
    const colliders = this._params.world.GetColliders();

    // this._playerBox.setFromObject(this._mesh);
    this._playerBox.set(this._mesh.position, 1);

    for (let c of colliders) {
      const cur = c._collider;

      // if (cur.intersectsBox(this._playerBox)) {
      if (this._playerBox.intersectsBox(cur)) {
        this.gameOver = true;
      }
    }
  }

  Update(timeElapsed: number) {
    if (this._keys.space && this._position.y == 0.0) {
      this._velocity = 40;
    }

    const acceleration = -75 * timeElapsed;

    this._position.y += timeElapsed * (this._velocity + acceleration * 0.5);
    this._position.y = Math.max(this._position.y, 0.0);

    this._velocity += acceleration;
    this._velocity = Math.max(this._velocity, -100);

    if (this._mesh) {
      // this._mixer.update(timeElapsed) // For model animations
      this._mesh.position.copy(this._position);
      this._CheckCollision();
    }
  }
}

export { Player };
