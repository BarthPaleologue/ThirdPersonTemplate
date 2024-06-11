import {
    Color3,
    DirectionalLight,
    Engine,
    HavokPlugin,
    HemisphericLight,
    MeshBuilder, PBRMetallicRoughnessMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    ReflectionProbe,
    Scene,
    ShadowGenerator,
    StandardMaterial,
    Vector3
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

import "../styles/index.scss";
import { CharacterController } from "./character";
import { SkyMaterial } from "@babylonjs/materials";

const canvas = document.getElementById("renderer") as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const engine = new Engine(canvas);

const havokInstance = await HavokPhysics();
const havokPlugin = new HavokPlugin(true, havokInstance);

const scene = new Scene(engine);
scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

const sun = new DirectionalLight("light", new Vector3(-5, -10, 5).normalize(), scene);
sun.position = sun.direction.negate().scaleInPlace(40);

// Shadows
const shadowGenerator = new ShadowGenerator(1024, sun);
shadowGenerator.useExponentialShadowMap = true;

const hemiLight = new HemisphericLight("hemi", Vector3.Up(), scene);
hemiLight.intensity = 0.4;

const skyMaterial = new SkyMaterial("skyMaterial", scene);
skyMaterial.backFaceCulling = false;
skyMaterial.useSunPosition = true;
skyMaterial.sunPosition = sun.direction.negate();

const skybox = MeshBuilder.CreateBox("skyBox", { size: 100.0 }, scene);
skybox.material = skyMaterial;

// Reflection probe
const rp = new ReflectionProbe("ref", 512, scene);
rp.renderList?.push(skybox);

scene.environmentTexture = rp.cubeTexture;

const groundMaterial = new PBRMetallicRoughnessMaterial("groundMat", scene);

const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 });
ground.material = groundMaterial;
ground.receiveShadows = true;

new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

const characterController = await CharacterController.CreateAsync(scene);
shadowGenerator.addShadowCaster(characterController.mesh);

const boxMaterial = new PBRMetallicRoughnessMaterial("boxMaterial", scene);
boxMaterial.baseColor = Color3.Random();

const box = MeshBuilder.CreateBox("Box", { size: 1 }, scene);
box.material = boxMaterial;
shadowGenerator.addShadowCaster(box);

box.position.y = 4;
box.position.z = 5;

const boxAggregate = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 1 }, scene);
boxAggregate.body.applyAngularImpulse(new Vector3(Math.random(), Math.random(), Math.random()));

let elapsedSeconds = 0;

function updateScene() {
    const deltaTime = engine.getDeltaTime() / 1000;
    elapsedSeconds += deltaTime;
}

scene.executeWhenReady(() => {

    engine.loadingScreen.hideLoadingUI();
    scene.registerBeforeRender(() => updateScene());
    engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
});

