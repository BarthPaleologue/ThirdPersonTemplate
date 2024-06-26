import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";

import character from "../assets/character.glb";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Culling/ray";

import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ActionManager, ExecuteCodeAction } from "@babylonjs/core/Actions";
import { moveTowards } from "./utils";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsShapeCylinder } from "@babylonjs/core/Physics/v2/physicsShape";

export class CharacterController {
    private readonly transform: TransformNode;

    readonly model: AbstractMesh;

    readonly impostorPhysicsBody: PhysicsBody;

    readonly moveSpeed = 1.8;
    readonly rotationSpeed = 6;
    readonly animationBlendSpeed = 4.0;

    readonly walkAnim: AnimationGroup;
    readonly sambaAnim: AnimationGroup;
    readonly idleAnim: AnimationGroup;

    private targetAnim: AnimationGroup;
    readonly nonIdleAnimations: AnimationGroup[];

    readonly inputMap: Map<string, boolean>;

    readonly thirdPersonCamera: ArcRotateCamera;

    keyForward = "w";
    keyBackward = "s";
    keyLeft = "a";
    keyRight = "d";

    static async CreateAsync(scene: Scene): Promise<CharacterController> {
        const result = await SceneLoader.ImportMeshAsync("", "", character, scene);

        const model = result.meshes[0];

        const cameraAttachPoint = new TransformNode("cameraAttachPoint", scene);
        cameraAttachPoint.parent = model;
        cameraAttachPoint.position = new Vector3(0, 1.5, 0);

        const camera = new ArcRotateCamera("thirdPersonCamera", -1.5, 1.2, 5, Vector3.Zero(), scene);
        camera.attachControl(true);

        camera.setTarget(cameraAttachPoint);
        camera.wheelPrecision = 200;
        camera.lowerRadiusLimit = 3;
        camera.upperBetaLimit = 3.14 / 2 + 0.2;

        return new CharacterController(model, camera, scene);
    }

    private constructor(characterMesh: AbstractMesh, thirdPersonCamera: ArcRotateCamera, scene: Scene) {
        this.transform = new TransformNode("CharacterTransform", scene);
        this.transform.rotationQuaternion = Quaternion.Identity();

        this.model = characterMesh;
        this.model.parent = this.transform;
        this.model.rotate(Vector3.Up(), Math.PI)
        this.model.position.y = -0.5

        this.thirdPersonCamera = thirdPersonCamera;

        const walkAnimGroup = scene.getAnimationGroupByName("Walking");
        if (walkAnimGroup === null) throw new Error("'Walking' animation not found");
        this.walkAnim = walkAnimGroup;
        this.walkAnim.weight = 0;

        const idleAnimGroup = scene.getAnimationGroupByName("Idle");
        if (idleAnimGroup === null) throw new Error("'Idle' animation not found");
        this.idleAnim = idleAnimGroup;
        this.idleAnim.weight = 1;

        const sambaAnimGroup = scene.getAnimationGroupByName("SambaDancing");
        if (sambaAnimGroup === null) throw new Error("'Samba' animation not found");
        this.sambaAnim = sambaAnimGroup;
        this.sambaAnim.weight = 0;

        this.targetAnim = this.idleAnim;
        this.nonIdleAnimations = [this.walkAnim, this.sambaAnim];

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

        this.impostorPhysicsBody = new PhysicsBody(this.transform, PhysicsMotionType.DYNAMIC, false, scene);
        const impostorShape = new PhysicsShapeCylinder(
            new Vector3(0, -0.5, 0),
            new Vector3(0, 1.7, 0),
            0.5,
            scene
        );

        this.impostorPhysicsBody.shape = impostorShape;
        this.impostorPhysicsBody.setMassProperties({ mass: 1 });
        this.impostorPhysicsBody.setAngularDamping(100);
        this.impostorPhysicsBody.setLinearDamping(10);
    }

    public getTransform() {
        return this.transform;
    }

    public update(deltaSeconds: number) {        
        this.targetAnim = this.idleAnim;

        const angle180 = Math.PI;
        const angle45 = angle180 / 4;
        const angle90 = angle180 / 2;
        const angle135 = angle45 + angle90;
        const direction = this.thirdPersonCamera.getForwardRay().direction;
        const forward = new Vector3(direction.x, 0, direction.z).normalize();
        const rot = Quaternion.FromLookDirectionLH(forward, Vector3.Up());

        let rotation = 0;
        if (this.inputMap.get(this.keyBackward) && !this.inputMap.get(this.keyRight) && !this.inputMap.get(this.keyLeft)) {
            rotation = angle180
        }
        if (this.inputMap.get(this.keyLeft) && !this.inputMap.get(this.keyForward) && !this.inputMap.get(this.keyBackward)) {
            rotation = -angle90
        }
        if (this.inputMap.get(this.keyRight) && !this.inputMap.get(this.keyForward) && !this.inputMap.get(this.keyBackward)) {
            rotation = angle90
        }
        if (this.inputMap.get(this.keyForward) && this.inputMap.get(this.keyRight)) {
            rotation = angle45
        }
        if (this.inputMap.get(this.keyForward) && this.inputMap.get(this.keyLeft)) {
            rotation = -angle45
        }
        if (this.inputMap.get(this.keyBackward) && this.inputMap.get(this.keyRight)) {
            rotation = angle135
        }
        if (this.inputMap.get(this.keyBackward) && this.inputMap.get(this.keyLeft)) {
            rotation = -angle135
        }

        rot.multiplyInPlace(Quaternion.RotationAxis(Vector3.Up(), rotation));

        if (this.inputMap.get(this.keyForward) || this.inputMap.get(this.keyBackward) || this.inputMap.get(this.keyLeft) || this.inputMap.get(this.keyRight)) { 
            this.targetAnim = this.walkAnim;

            const quaternion = rot; //euler.toQuaternion();
            const impostorQuaternion = this.transform.rotationQuaternion;
            if (impostorQuaternion === null) {
                throw new Error("Impostor quaternion is null");
            }
            Quaternion.SlerpToRef(
                impostorQuaternion,
                quaternion,
                this.rotationSpeed * deltaSeconds,
                impostorQuaternion
            )
            this.transform.translate(new Vector3(0, 0, -1), this.moveSpeed * deltaSeconds);
            this.impostorPhysicsBody.setTargetTransform(this.transform.absolutePosition, impostorQuaternion)
        }

        if (this.inputMap.get("b")) {
            this.targetAnim = this.sambaAnim;
        }

        
        let weightSum = 0;
        for (const animation of this.nonIdleAnimations) {
            if (animation === this.targetAnim) {
                animation.weight = moveTowards(animation.weight, 1, this.animationBlendSpeed * deltaSeconds);
            } else {
                animation.weight = moveTowards(animation.weight, 0, this.animationBlendSpeed * deltaSeconds);
            }
            if(animation.weight > 0 && !animation.isPlaying) animation.play(true);
            if(animation.weight === 0 && animation.isPlaying) animation.pause();

            weightSum += animation.weight;
        }

        this.idleAnim.weight = moveTowards(this.idleAnim.weight, Math.min(Math.max(1 - weightSum, 0.0), 1.0), this.animationBlendSpeed * deltaSeconds);
    }
}
