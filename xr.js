import { WebXRButton } from './js/util/webxr-button.js';
import { Scene } from './js/render/scenes/scene.js';
import { Renderer, createWebGLContext } from './js/render/core/renderer.js';
import { Node } from './js/render/core/node.js';
import { Gltf2Node } from './js/render/nodes/gltf2.js';
import { DropShadowNode } from './js/render/nodes/drop-shadow.js';
import { vec3 } from './js/render/math/gl-matrix.js';
import { Ray } from './js/render/math/ray.js';

// XR globals.
let xrButton = null;
let xrRefSpace = null;
let xrViewerSpace = null;
let xrHitTestSource = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = new Scene();
scene.enableStats(false);

let arObject = new Node();
arObject.visible = false;
scene.addNode(arObject);

let lamp = new Gltf2Node({ url: 'gltf/lampe.gltf' });
arObject.addNode(lamp);

let reticle = new Gltf2Node({ url: 'gltf/lampe.gltf' });
//let reticle = new Gltf2Node({url: 'media/gltf/reticle/reticle.gltf'});
reticle.visible = false;
scene.addNode(reticle);

// Having a really simple drop shadow underneath an object helps ground
// it in the world without adding much complexity.
let shadow = new DropShadowNode();
vec3.set(shadow.scale, 0.05, 0.05, 0.05);
arObject.addNode(shadow);

const MAX_LAMPS = 1;
let lamps = [];

// Ensure the background is transparent for AR.
scene.clear = false;

function initXR() {
    /* xrButton = new WebXRButton({
      onRequestSession: onRequestSession,
      onEndSession: onEndSession,
      textEnterXRTitle: "START AR",
      textXRNotFoundTitle: "AR NOT FOUND",
      textExitXRTitle: "EXIT  AR",
    });
    document.querySelector('header').appendChild(xrButton.domElement); */

    document.querySelector('#start-xr').addEventListener("click", onRequestSession)

    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar')
            .then((supported) => {
                /* xrButton.enabled = supported; */
            });
    }


}



function onRequestSession() {
    return navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local', 'hit-test'] })
        .then((session) => {
            /* xrButton.setSession(session); */
            onSessionStarted(session);
        });
}

function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);
    session.addEventListener('select', onSelect/*  */);
    session.addEventListener('selectstart', onInputChange/*  */);
    session.addEventListener('selectend', onInputChange/*  */);

    if (!gl) {
        gl = createWebGLContext({
            xrCompatible: true
        });

        renderer = new Renderer(gl);

        scene.setRenderer(renderer);
    }

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    // In this sample we want to cast a ray straight out from the viewer's
    // position and render a reticle where it intersects with a real world
    // surface. To do this we first get the viewer space, then create a
    // hitTestSource that tracks it.
    session.requestReferenceSpace('viewer').then((refSpace) => {
        xrViewerSpace = refSpace;
        session.requestHitTestSource({ space: xrViewerSpace }).then((hitTestSource) => {
            xrHitTestSource = hitTestSource;
        });
    });

    session.requestReferenceSpace('local').then((refSpace) => {
        xrRefSpace = refSpace;

        session.requestAnimationFrame(onXRFrame);
    });
}

function onEndSession(session) {
    xrHitTestSource.cancel();
    xrHitTestSource = null;
    session.end();
}

function onSessionEnded(event) {
    /* xrButton.setSession(null); */
}

// Adds a new object to the scene at the
// specificed transform.
function addARObjectAt(matrix) {
    let newLamp = arObject.clone();
    newLamp.visible = true;
    newLamp.matrix = matrix;
    scene.addNode(newLamp);

    lamps.push(newLamp);
    reticle.visible = false;

    // For performance reasons if we add too many objects start
    // removing the oldest ones to keep the scene complexity
    // from growing too much.
    if (lamps.length > MAX_LAMPS) {
        let oldLamp = lamps.shift();
        scene.removeNode(oldLamp);
    }
}

function moveARObject() {
    reticle.visible = true;
    let oldLamp = lamps.shift();
    scene.removeNode(oldLamp);
}

let rayOrigin = vec3.create();
let rayDirection = vec3.create();
function onSelect(event) {
    if (reticle.visible) {
        // The reticle should already be positioned at the latest hit point, 
        // so we can just use it's matrix to save an unnecessary call to 
        // event.frame.getHitTestResults.
        addARObjectAt(reticle.matrix);
    }

    else if (!reticle.visible) {
        moveARObject();
    }
}

function onInputChange(event) {
    /* console.log("select event"); */
    let source = event.inputSource;
    let targetRayPose = event.frame.getPose(source.targetRaySpace, source.targetRaySpace);
    /* console.log(source);
    console.log(targetRayPose); */
}

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
    let session = frame.session;
    let pose = frame.getViewerPose(xrRefSpace);

    reticle.visible = false;

    // If we have a hit test source, get its results for the frame
    // and use the pose to display a reticle in the scene.
    if (xrHitTestSource && pose) {
        let hitTestResults = frame.getHitTestResults(xrHitTestSource);
        if (hitTestResults.length > 0) {
            let pose = hitTestResults[0].getPose(xrRefSpace);
            reticle.visible = true;
            reticle.matrix = pose.transform.matrix;
            /* reticle.matrix[15] = 0; */

            /* if (reticle.matrix[0] <= 0) {
                reticle.matrix[0] = reticle.matrix[0] * (-1);
            }

            if (reticle.matrix[10] <= 0) {
                reticle.matrix[10] = reticle.matrix[10] * (-1);
            } */
            

            /* console.log("Rotation");
            console.log(reticle._rotation);
            console.log("RETICLE");
            console.log(reticle);
            console.log("RETICLE MATRIX");
            console.log(reticle.matrix); */


            if (lamps.length == MAX_LAMPS) {
                reticle.visible = false;
            }
        }
    }

    scene.startFrame();

    session.requestAnimationFrame(onXRFrame);

    scene.drawXRFrame(frame, pose);

    scene.endFrame();
}

// Start the XR application.
initXR();