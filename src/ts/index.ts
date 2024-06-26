import {
    Color3,
    DirectionalLight,
    Engine,
    HavokPlugin,
    HemisphericLight,
    MeshBuilder, PBRMetallicRoughnessMaterial,
    PhysicsAggregate,
    PhysicsShapeType,
    PhysicsViewer,
    ReflectionProbe,
    Scene,
    ShadowGenerator, Tools,
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
engine.displayLoadingUI();

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
characterController.getTransform().position.y = 3;
shadowGenerator.addShadowCaster(characterController.model);

for (let i = 0; i < 4; i++) {
    const boxMaterial = new PBRMetallicRoughnessMaterial("boxMaterial", scene);
    boxMaterial.baseColor = Color3.Random();

    const box = MeshBuilder.CreateBox("Box", { size: 1 }, scene);
    box.material = boxMaterial;
    shadowGenerator.addShadowCaster(box);
    box.position.copyFromFloats((Math.random() - 0.5) * 6, 4 + Math.random() * 2, 5 + Math.random() * 2);

    const boxAggregate = new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 10 }, scene);
    boxAggregate.body.applyAngularImpulse(new Vector3(Math.random(), Math.random(), Math.random()));
}

function updateScene() {
    const deltaSeconds = engine.getDeltaTime() / 1000;
    characterController.update(deltaSeconds);
}

scene.executeWhenReady(() => {
    engine.loadingScreen.hideLoadingUI();
    scene.onBeforeRenderObservable.add(() => updateScene());
    engine.runRenderLoop(() => scene.render());
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
});

const physicsViewer = new PhysicsViewer(scene);
let bodyShown = false;

document.addEventListener("keydown", async e => {
    if (e.key === "p") {
        Tools.CreateScreenshot(engine, characterController.thirdPersonCamera, { width: canvas.width, height: canvas.height });
    }
    if (e.key === "v") {
        bodyShown = !bodyShown;

        if(bodyShown) {
            scene.transformNodes.forEach(transform => { if (transform.physicsBody) physicsViewer.showBody(transform.physicsBody) });
            scene.meshes.forEach(mesh => { if (mesh.physicsBody) physicsViewer.showBody(mesh.physicsBody) });
        } else {
            scene.transformNodes.forEach(transform => { if (transform.physicsBody) physicsViewer.hideBody(transform.physicsBody) });
            scene.meshes.forEach(mesh => { if (mesh.physicsBody) physicsViewer.hideBody(mesh.physicsBody) });
        }
    }
})