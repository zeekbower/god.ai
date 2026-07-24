import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { PYRAMID_RADIUS, PYRAMID_HEIGHT, getPyramidFaces, getPyramidVertices, getTangentBasis } from "./pyramidFaces";

const BEVEL_WIDTH = 0.055;
const BEVEL_BOX_SIZE = 12;
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Chamfers a single edge (the straight line from pointA to pointB, shared by two
 * faces with the given outward normals) by subtracting a large box whose inner
 * face sits flush with the bevel plane. The plane is built from the two faces'
 * bisector, with the component along the edge removed, so it stays parallel to
 * the edge — the cut runs its full length instead of slicing across it.
 */
function bevelEdge(
  brush: Brush,
  evaluator: Evaluator,
  pointA: THREE.Vector3,
  pointB: THREE.Vector3,
  normalA: THREE.Vector3,
  normalB: THREE.Vector3
): Brush {
  const edgeDir = new THREE.Vector3().subVectors(pointB, pointA).normalize();
  const rawBisector = new THREE.Vector3().addVectors(normalA, normalB).normalize();
  const alongEdge = edgeDir.clone().multiplyScalar(rawBisector.dot(edgeDir));
  const bevelNormal = new THREE.Vector3().subVectors(rawBisector, alongEdge).normalize();

  const midpoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
  const planePoint = midpoint.addScaledVector(bevelNormal, BEVEL_WIDTH);

  const cutter = new Brush(new THREE.BoxGeometry(BEVEL_BOX_SIZE, BEVEL_BOX_SIZE, BEVEL_BOX_SIZE));
  cutter.position.copy(planePoint).addScaledVector(bevelNormal, BEVEL_BOX_SIZE / 2);

  const { xAxis, yAxis } = getTangentBasis(bevelNormal);
  cutter.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, bevelNormal));
  cutter.updateMatrixWorld();

  return evaluator.evaluate(brush, cutter, SUBTRACTION);
}

/**
 * Carves one almond-shaped eye socket into each side face via real CSG boolean
 * subtraction (negative space), centered on the face. The socket is a squashed
 * sphere: wide + tall in the face plane, shallow along the face normal, so it
 * reads as a hollowed eye opening rather than a bite taken out of the pyramid.
 * The vertical and base edges are chamfered first, for a manufactured look.
 */
export function createPyramidGeometry(sides = 3): THREE.BufferGeometry {
  const coneGeo = new THREE.ConeGeometry(PYRAMID_RADIUS, PYRAMID_HEIGHT, sides, 1, false);
  let result = new Brush(coneGeo);
  result.updateMatrixWorld();

  const evaluator = new Evaluator();
  const faces = getPyramidFaces(sides);
  const { apex, corners } = getPyramidVertices(sides);

  // Vertical edges (apex -> base corner), each shared by two adjacent side faces.
  for (let i = 0; i < sides; i++) {
    const prev = (i - 1 + sides) % sides;
    result = bevelEdge(result, evaluator, apex, corners[i], faces[i].normal, faces[prev].normal);
  }

  // Base perimeter edges (corner -> next corner), each shared with the bottom cap.
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    result = bevelEdge(result, evaluator, corners[i], corners[next], faces[i].normal, DOWN);
  }

  const socketGeo = new THREE.SphereGeometry(0.5, 48, 48);
  for (const { normal, centroid } of faces) {
    const socket = new Brush(socketGeo);
    // Sink the socket's center behind the surface so only its outer cap breaches the face.
    socket.position.copy(centroid).addScaledVector(normal, -0.2);

    const { xAxis, yAxis } = getTangentBasis(normal);
    socket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal));
    socket.scale.set(1.05, 0.72, 0.5);
    socket.updateMatrixWorld();

    result = evaluator.evaluate(result, socket, SUBTRACTION);
  }

  return result.geometry;
}
