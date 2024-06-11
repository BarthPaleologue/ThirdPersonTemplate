import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";

import character from "../assets/character.glb";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Culling/ray";

import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
import { PhysicsEngineV2 } from "@babylonjs/core/Physics/v2";
import { ActionManager, ExecuteCodeAction } from "@babylonjs/core/Actions";
import { AnimationGroup, Space } from "@babylonjs/core";

class AnimationGroupWrapper {
    name: string;
    group: AnimationGroup;
    weight: number;

    constructor(name: string, group: AnimationGroup, startingWeight: number) {
        this.name = name;
        this.weight = startingWeight;

        this.group = group;
        this.group.play(true);
        this.group.setWeightForAllAnimatables(startingWeight);
    }

    moveTowardsWeight(targetWeight: number, deltaTime: number) {
        this.weight = Math.min(Math.max(this.weight + deltaTime * Math.sign(targetWeight - this.weight), 0), 1);
        this.group.setWeightForAllAnimatables(this.weight);
    }
}

export class CharacterController {
    readonly mesh: AbstractMesh;

    readonly heroSpeed = 1.8;
    readonly heroSpeedBackwards = 1.2;
    readonly heroRotationSpeed = 6;


    private readonly raycastResult: PhysicsRaycastResult;

    readonly walkAnim: AnimationGroupWrapper;
    readonly walkBackAnim: AnimationGroupWrapper;
    readonly idleAnim: AnimationGroupWrapper;
    readonly sambaAnim: AnimationGroupWrapper;

    private targetAnim: AnimationGroupWrapper;
    readonly nonIdleAnimations: AnimationGroupWrapper[];

    readonly inputMap: Map<string, boolean>;

    readonly thirdPersonCamera: ArcRotateCamera;


    static async CreateAsync(scene: Scene): Promise<CharacterController> {
        const result = await SceneLoader.ImportMeshAsync("", "", character, scene);

        const hero = result.meshes[0];

        const cameraAttachPoint = new TransformNode("cameraAttachPoint", scene);
        cameraAttachPoint.parent = hero;
        cameraAttachPoint.position = new Vector3(0, 1.5, 0);

        const camera = new ArcRotateCamera("thirdPersonCamera", -1.5, 1.2, 5, Vector3.Zero(), scene);
        camera.attachControl(true);

        camera.setTarget(cameraAttachPoint);
        camera.wheelPrecision = 200;
        camera.lowerRadiusLimit = 3;
        camera.upperBetaLimit = 3.14 / 2 + 0.2;

        return new CharacterController(hero, camera, scene);
    }

    private constructor(characterMesh: AbstractMesh, thirdPersonCamera: ArcRotateCamera, scene: Scene) {
        this.mesh = characterMesh;
        this.thirdPersonCamera = thirdPersonCamera;

        const walkAnimGroup = scene.getAnimationGroupByName("Walking");
        if (walkAnimGroup === null) throw new Error("'Walking' animation not found");
        this.walkAnim = new AnimationGroupWrapper("Walking", walkAnimGroup, 0);

        const walkBackAnimGroup = scene.getAnimationGroupByName("WalkingBackwards");
        if (walkBackAnimGroup === null) throw new Error("'WalkingBackwards' animation not found");
        this.walkBackAnim = new AnimationGroupWrapper("WalkingBackwards", walkBackAnimGroup, 0);

        const idleAnimGroup = scene.getAnimationGroupByName("Idle");
        if (idleAnimGroup === null) throw new Error("'Idle' animation not found");
        this.idleAnim = new AnimationGroupWrapper("Idle", idleAnimGroup, 1);

        const sambaAnimGroup = scene.getAnimationGroupByName("SambaDancing");
        if (sambaAnimGroup === null) throw new Error("'Samba' animation not found");
        this.sambaAnim = new AnimationGroupWrapper("SambaDancing", sambaAnimGroup, 0);

        this.targetAnim = this.idleAnim;
        this.nonIdleAnimations = [this.walkAnim, this.walkBackAnim, this.sambaAnim];

        this.inputMap = new Map();
        scene.actionManager = new ActionManager(scene);
        scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (e) => {
                this.inputMap.set(e.sourceEvent.key, e.sourceEvent.type == "keydown");
            })
        );
        scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (e) => {
                this.inputMap.set(e.sourceEvent.key, e.sourceEvent.type == "keydown");
            })
        );

        this.raycastResult = new PhysicsRaycastResult();
    }

    public move(direction: Vector3, distance: number) {
        const start = this.mesh.position;
        const end = start.add(direction.scale(distance + 0.5));
        const scene = this.mesh.getScene();
        (scene.getPhysicsEngine() as PhysicsEngineV2).raycastToRef(start, end, this.raycastResult);
        if (!this.raycastResult.hasHit) {
            this.mesh.translate(direction, distance, Space.WORLD);
        }
    }

    public update(deltaSeconds: number) {
        if (this.walkAnim.weight > 0.0) {
            this.move(this.mesh.forward, this.heroSpeed * deltaSeconds * this.walkAnim.weight);
        }

        if (this.walkBackAnim.weight > 0.0) {
            this.move(this.mesh.forward, -this.heroSpeedBackwards * deltaSeconds * this.walkBackAnim.weight);
        }

        const isWalking = this.walkAnim.weight > 0.0 || this.walkBackAnim.weight > 0.0;

        this.targetAnim = this.idleAnim;

        // Translation
        if (this.inputMap.get("z") || this.inputMap.get("w")) {
            this.targetAnim = this.walkAnim;
        } else if (this.inputMap.get("s")) {
            this.targetAnim = this.walkBackAnim;
        }

        // Rotation
        if ((this.inputMap.get("q") || this.inputMap.get("a")) && isWalking) {
            this.mesh.rotate(Vector3.Up(), -this.heroRotationSpeed * deltaSeconds);
        } else if (this.inputMap.get("d") && isWalking) {
            this.mesh.rotate(Vector3.Up(), this.heroRotationSpeed * deltaSeconds);
        }

        // Samba!
        if (this.inputMap.get("b")) {
            this.targetAnim = this.sambaAnim;
        }

        let weightSum = 0;
        for (const animation of this.nonIdleAnimations) {
            if (animation === this.targetAnim) {
                animation.moveTowardsWeight(1, deltaSeconds);
            } else {
                animation.moveTowardsWeight(0, deltaSeconds);
            }
            weightSum += animation.weight;
        }

        this.idleAnim.moveTowardsWeight(Math.min(Math.max(1 - weightSum, 0.0), 1.0), deltaSeconds);

        const scene = this.mesh.getScene();

        // downward raycast
        const start = this.mesh.position.add(this.mesh.up.scale(50));
        const end = this.mesh.position.add(this.mesh.up.scale(-50));
        (scene.getPhysicsEngine() as PhysicsEngineV2).raycastToRef(start, end, this.raycastResult);
        if (this.raycastResult.hasHit) {
            this.mesh.position = this.raycastResult.hitPointWorld.add(this.mesh.up.scale(0.01));
        }
    }
}
