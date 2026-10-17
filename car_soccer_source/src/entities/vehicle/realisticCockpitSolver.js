import { REALISTIC_DIMENSIONS } from './vehicleDescriptors.js';
import * as THREE from 'three';

/**
 * Normalizes an angle into [-PI, PI].
 */
export function normalizeAngle(angle) {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  else if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Steps an angle toward a target angle by at most maxStep.
 */
export function approachAngle(current, target, maxStep) {
  let diff = normalizeAngle(target - current);
  if (diff > maxStep) diff = maxStep;
  else if (diff < -maxStep) diff = -maxStep;
  return current + diff;
}

/**
 * Newton-Raphson 2-DOF gimbal orientation solver & velocity heading alignment.
 * Stabilizes cockpit attitude by aligning inner cradle normal with body-relative world UP.
 */
export function updateRealisticCockpitGimbal(quat, vx, vy, dt, gimbals) {
  if (!gimbals || !gimbals.rollRing || !gimbals.cradle || !gimbals.seat) return;
  const { Quaternion, Vector3 } = THREE;
  const invQuat = new Quaternion().copy(quat).invert();
  const upVec = new Vector3(0, 1, 0).applyQuaternion(invQuat);

  const targetUpX = upVec.x, targetUpY = upVec.y, targetUpZ = upVec.z;
  let roll = gimbals.rollAngle;
  let cradle = gimbals.cradleAngle;

  const REGULARIZATION = 0.01;
  const DAMPING = 0.4;
  const MAX_SLEW_RATE = 8;

  // 4 Newton-Raphson optimization iterations
  for (let iter = 0; iter < 4; iter++) {
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cosCradle = Math.cos(cradle);
    const sinCradleNeg = -Math.sin(cradle);

    const forwardNormalY = cosCradle * cosRoll;
    const forwardNormalZ = cosCradle * sinRoll;

    const errorX = targetUpX - sinCradleNeg;
    const errorY = targetUpY - forwardNormalY;
    const errorZ = targetUpZ - forwardNormalZ;

    const jacobianRollY = -forwardNormalZ;
    const jacobianRollZ = forwardNormalY;

    const jacobianCradleX = -sinRoll * forwardNormalZ - cosRoll * forwardNormalY;
    const jacobianCradleY = cosRoll * sinCradleNeg;
    const jacobianCradleZ = sinRoll * sinCradleNeg;

    const rollMagnitudeSq = jacobianRollY * jacobianRollY + jacobianRollZ * jacobianRollZ;
    const j11 = rollMagnitudeSq + REGULARIZATION + DAMPING * (1 - rollMagnitudeSq);
    const j22 = jacobianCradleX * jacobianCradleX + jacobianCradleY * jacobianCradleY + jacobianCradleZ * jacobianCradleZ + REGULARIZATION;
    const j12 = jacobianRollY * jacobianCradleY + jacobianRollZ * jacobianCradleZ;

    const gradientRoll = jacobianRollY * errorY + jacobianRollZ * errorZ;
    const gradientCradle = jacobianCradleX * errorX + jacobianCradleY * errorY + jacobianCradleZ * errorZ;

    const determinant = j11 * j22 - j12 * j12 || 1e-9;
    roll += (j22 * gradientRoll - j12 * gradientCradle) / determinant;
    cradle += (j11 * gradientCradle - j12 * gradientRoll) / determinant;
  }

  const maxStep = MAX_SLEW_RATE * dt;
  const clampedRollDelta = Math.max(-maxStep, Math.min(maxStep, roll - gimbals.rollAngle));
  gimbals.rollAngle += clampedRollDelta;
  gimbals.cradleAngle = cradle;
  gimbals.rollRing.rotation.x = gimbals.rollAngle;
  gimbals.cradle.rotation.z = cradle;

  const cosCradle = Math.cos(gimbals.cradleAngle);
  const sinCradle = Math.sin(gimbals.cradleAngle);
  const forwardDir = new Vector3(cosCradle, Math.cos(gimbals.rollAngle) * sinCradle, Math.sin(gimbals.rollAngle) * sinCradle).applyQuaternion(quat);
  const yawAngle = Math.atan2(forwardDir.z, forwardDir.x);

  if (Number.isNaN(gimbals.seatHeading)) {
    gimbals.seatHeading = yawAngle;
  }
  const speed = Math.hypot(vx, vy);
  const targetHeading = speed > REALISTIC_DIMENSIONS.minSteerVelocity ? Math.atan2(vy, vx) : gimbals.seatHeading;
  gimbals.seatHeading = approachAngle(gimbals.seatHeading, targetHeading, REALISTIC_DIMENSIONS.seatYawRate * dt);
  gimbals.seat.rotation.y = normalizeAngle(yawAngle - gimbals.seatHeading);
}
