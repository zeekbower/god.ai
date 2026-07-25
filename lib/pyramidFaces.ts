import * as THREE from "three";

export const PYRAMID_RADIUS = 1.55;
export const PYRAMID_HEIGHT = 2.15;
/** World-space Y offset of the pyramid's group (see Pyramid.tsx's root <group position>). */
export const PYRAMID_GROUP_OFFSET_Y = -0.2;

export type FaceData = {
  /** Outward-facing unit normal of this side face. */
  normal: THREE.Vector3;
  /** Centroid of the triangular face, in the pyramid's local space. */
  centroid: THREE.Vector3;
};

/** The apex and base-corner vertices of the pyramid, in local space. */
export function getPyramidVertices(sides = 3): { apex: THREE.Vector3; corners: THREE.Vector3[] } {
  const halfHeight = PYRAMID_HEIGHT / 2;
  const apex = new THREE.Vector3(0, halfHeight, 0);
  const corners: THREE.Vector3[] = [];

  for (let i = 0; i < sides; i++) {
    const theta = (i / sides) * Math.PI * 2;
    corners.push(new THREE.Vector3(Math.sin(theta) * PYRAMID_RADIUS, -halfHeight, Math.cos(theta) * PYRAMID_RADIUS));
  }

  return { apex, corners };
}

/**
 * Geometric data for each side face of a ConeGeometry(PYRAMID_RADIUS, PYRAMID_HEIGHT, sides)
 * pyramid, derived analytically (not read back from the geometry) so it stays correct
 * regardless of how the CSG boolean ops reshape the mesh.
 */
export function getPyramidFaces(sides = 3): FaceData[] {
  const { apex, corners } = getPyramidVertices(sides);
  const faces: FaceData[] = [];

  for (let i = 0; i < sides; i++) {
    const b1 = corners[i];
    const b2 = corners[(i + 1) % sides];

    const centroid = new THREE.Vector3().add(apex).add(b1).add(b2).divideScalar(3);

    const edge1 = new THREE.Vector3().subVectors(b1, apex);
    const edge2 = new THREE.Vector3().subVectors(b2, apex);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    if (normal.dot(centroid) < 0) normal.negate();

    faces.push({ normal, centroid });
  }

  return faces;
}

/** An orthonormal in-plane (xAxis, yAxis) basis for a face, given its outward normal. */
export function getTangentBasis(normal: THREE.Vector3): { xAxis: THREE.Vector3; yAxis: THREE.Vector3 } {
  const hint = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const xAxis = new THREE.Vector3().crossVectors(hint, normal).normalize();
  const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
  return { xAxis, yAxis };
}

/**
 * The point where a line drawn inward from each face's centroid (along its
 * inverse normal) converges. For a symmetric pyramid this point lies on the
 * central vertical axis but — because the faces lean inward toward the apex —
 * it sits below the volumetric midpoint. Placing the eyeball here (rather than
 * at the literal volumetric center) is what makes it read as visible straight
 * through every socket at once, instead of peeking through at an angle.
 */
export function getPyramidEyeCenter(sides = 3): THREE.Vector3 {
  const [face] = getPyramidFaces(sides);
  const { normal, centroid } = face;
  // Solve centroid + t*(-normal) = (0, y, 0) using whichever horizontal axis
  // has the larger normal component, for numerical stability.
  const t = Math.abs(normal.x) > Math.abs(normal.z) ? centroid.x / normal.x : centroid.z / normal.z;
  return new THREE.Vector3(0, centroid.y - t * normal.y, 0);
}
