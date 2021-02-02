import * as THREE from "three";
import { Player } from "./player";
import { WorldManager } from "./world";

const _VS = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const _FS = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;
varying vec3 vWorldPosition;
void main() {
  float h = normalize( vWorldPosition + offset ).y;
  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
}`;

const groundFS = `
const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );
uniform vec3 iResolution;
uniform float iTime;
varying vec2 vUv;

float noise( in vec2 p )
{
	return sin(p.x)*sin(p.y);
}

float fbm4( vec2 p )
{
    float f = 0.0;
    f += 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.1250*noise( p ); p = m*p*2.01;
    f += 0.0625*noise( p );
    return f/0.9375;
}

float fbm6( vec2 p )
{
    float f = 0.0;
    f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
    f += 0.250000*(0.5+0.5*noise( p )); p = m*p*2.03;
    f += 0.125000*(0.5+0.5*noise( p )); p = m*p*2.01;
    f += 0.062500*(0.5+0.5*noise( p )); p = m*p*2.04;
    f += 0.031250*(0.5+0.5*noise( p )); p = m*p*2.01;
    f += 0.015625*(0.5+0.5*noise( p ));
    return f/0.96875;
}

vec2 fbm4_2( vec2 p )
{
    return vec2(fbm4(p), fbm4(p+vec2(7.8)));
}

vec2 fbm6_2( vec2 p )
{
    return vec2(fbm6(p+vec2(16.8)), fbm6(p+vec2(11.5)));
}

//====================================================================

float func( vec2 q, out vec4 ron )
{
    q += 0.03*sin( vec2(0.27,0.23)*iTime + length(q)*vec2(4.1,4.3));

	vec2 o = fbm4_2( 0.9*q );

    o += 0.04*sin( vec2(0.12,0.14)*iTime + length(o));

    vec2 n = fbm6_2( 3.0*o );

	ron = vec4( o, n );

    float f = 0.5 + 0.5*fbm4( 1.8*q + 6.0*n );

    return mix( f, f*f*f*3.5, f*abs(n.x) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    float e = 2.0/iResolution.y;

    vec2 p = fragCoord/iResolution.xy;

    vec4 on = vec4(0.0);
    float f = func(p, on);

	vec3 col = vec3(0.0);
    col = mix( vec3(0.2,0.1,0.4), vec3(0.3,0.05,0.05), f );
    col = mix( col, vec3(0.1,0.9,0.3), dot(on.zw,on.zw) );
    col = mix( col, vec3(0.1,0.3,0.3), 0.2 + 0.5*on.y*on.y );
    col = mix( col, vec3(0.0,0.2,0.4), 0.5*smoothstep(1.2,1.3,abs(on.z)+abs(on.w)) );
    col = clamp( col*f*2.0, 0.0, 1.0 );
    
#if 0
    // gpu derivatives - bad quality, but fast
	vec3 nor = normalize( vec3( dFdx(f)*iResolution.x, 6.0, dFdy(f)*iResolution.y ) );
#else    
    // manual derivatives - better quality, but slower
    vec4 kk;
 	vec3 nor = normalize( vec3( func(p+vec2(e,0.0),kk)-f, 
                                2.0*e,
                                func(p+vec2(0.0,e),kk)-f ) );
#endif    

    vec3 lig = normalize( vec3( 0.9, 0.2, -0.4 ) );
    float dif = clamp( 0.3+0.7*dot( nor, lig ), 0.0, 1.0 );
    vec3 lin = vec3(0.70,0.90,0.95)*(nor.y*0.5+0.5) + vec3(0.15,0.10,0.05)*dif;
    col *= 1.2*lin;
	col = 1.0 - col;
	col = 1.1*col*col;
    
    fragColor = vec4( col, 1.0 );
}
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;
const fragmentShader = `
#include <common>
 
uniform vec3 iResolution;
uniform float iTime;
 
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
 
    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
 
    // Output to screen
    fragColor = vec4(col,1.0);
}
 
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;
const groundVS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

`;

class Game {
  private _gameStarted: boolean = false;
  private _gameOver: boolean = false;
  private _previousRAF: number = null;
  private _paused = false;

  private _renderer: THREE.WebGLRenderer;
  private _camera: THREE.PerspectiveCamera;
  private _scene: THREE.Scene;
  private _lights: THREE.Light[] = [];

  private _world: WorldManager;
  private _player: Player;

  private _guniforms: any;
  private _suniforms: any;

  constructor() {
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");

    startButton.onclick = () => {
      this._OnStart();
      startButton.remove();
    };

    pauseButton.onclick = () => {
      this._paused = !this._paused;
      pauseButton.innerText = this._paused ? "RESUME" : "PAUSED";
    };
  }

  _OnStart() {
    this._Init();
    this._gameStarted = true;
  }

  _Init() {
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.gammaFactor = 4.2;
    this._renderer.shadowMap.enabled = true;
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._renderer.domElement);

    window.addEventListener("resize", this._onWindowResize, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 20000.0;

    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(-5, 5, 10);
    this._camera.lookAt(8, 3, 0);

    this._scene = new THREE.Scene();

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(-10, 10, 0);
    light.target.position.set(20, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.far = 200.0;
    light.shadow.camera.near = 1.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    const hemiLight = new THREE.HemisphereLight(0x202020, 0x004080, 0.6);
    this._lights.push(hemiLight);

    for (let i = 0; i < this._lights.length; i++) {
      this._scene.add(this._lights[i]);
    }

    this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.01125);

    this._scene.background = new THREE.Color(255, 255, 0);

    this._guniforms = {
      iTime: { value: 0 },
      iResolution: {
        value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1),
      },
    };

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    ground.castShadow = false;
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    this._scene.add(ground);

    this._suniforms = {
      topColor: { value: new THREE.Color(0x0077ff) },
      bottomColor: { value: new THREE.Color(0x89b2eb) },
      offset: { value: 33 },
      exponent: { value: 0.6 },
      iTime: {
        value: 0,
      },
      iResolution: {
        value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1),
      },
    };
    const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this._suniforms,
      vertexShader: _VS,
      fragmentShader: groundFS,
      side: THREE.BackSide,
    });
    this._scene.add(new THREE.Mesh(skyGeo, skyMat));

    this._world = new WorldManager({ scene: this._scene });
    this._player = new Player({ scene: this._scene, world: this._world });
    // add background?

    this._RAF();
    this._onWindowResize();
  }

  _onWindowResize = () => {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  };

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }
      this._suniforms.iTime.value += 0.03;
      this._RAF();

      this._Step((t - this._previousRAF) / 1000.0);
      this._renderer.render(this._scene, this._camera);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed: number) {
    if (this._gameOver || !this._gameStarted || this._paused) {
      return;
    }

    this._player.Update(timeElapsed);
    this._world.Update(timeElapsed);
    // this._background.update()

    if (this._player.gameOver && !this._gameOver) {
      this._gameOver = true;
    }
  }
}

export { Game };
