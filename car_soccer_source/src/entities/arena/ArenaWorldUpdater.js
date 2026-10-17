/**
 * ArenaWorldUpdater.js
 * 120Hz physics state interpolation and visual tick coordinator for the arena world.
 */

import { unrealToThreeCoords, interpolatePhysicsTransform } from './ArenaMath.js';
import { updateCarSuspensionAndSteering } from '../VehicleSuspensionSystem.js';
import { updateCarAirJets, updateBoostVisuals } from './ArenaVehicleAnimator.js';

export function updateArenaFrame(arena, prevState, currState, alpha, delta = 0, throttle = 0, controls, opponentControls, activeVisuals = true, carControlsResolver = null) {
  let actualDelta = delta;
  let actualThrottle = throttle;
  if (actualDelta > 0.1 && actualThrottle > 0 && actualThrottle < 0.05) {
    actualDelta = throttle;
    actualThrottle = delta;
  }

  const header = arena._headerView.attach(currState);
  const currBall = arena._currBallView.attach(currState);
  const prevBall = arena._prevBallView.attach(prevState);
  interpolatePhysicsTransform(arena.ball, prevBall, currBall, alpha, undefined, arena.pA, arena.pB, arena.qA, arena.qB);
  unrealToThreeCoords(arena.ballVelocity, currBall.velX, currBall.velY, currBall.velZ);
  arena.ballSpeedTrail?.update(arena.ball.position, arena.ballVelocity, actualDelta);

  const ballPos = arena.ball.position;
  arena.indicatorRing.position.set(ballPos.x, 2, ballPos.z);
  arena.indicatorHeightRing.position.set(ballPos.x, 2, ballPos.z);
  const height = Math.max(0, ballPos.y - arena.ballRadius);
  const scale = 0.86 - 0.68 * Math.min(1, height / 1600);
  arena.indicatorHeightRing.scale.set(scale, scale, 1);

  const maxCars = Math.max(arena.cars.length, Math.min(8, header.numCars || 0));
  for (let carIndex = 0; carIndex < maxCars; carIndex++) {
    if (carIndex >= header.numCars) {
      if (arena.cars[carIndex]) {
        arena.cars[carIndex].visible = false;
        arena.carDemolitions[carIndex]?.update(actualDelta, false, arena.cars[carIndex].position, false);
      }
      continue;
    }

    const currCar = arena._currCarView.attachCar(currState, carIndex);
    const prevCar = arena._prevCarView.attachCar(prevState, carIndex);

    // Check if this slot is parked in the off-arena inactive staging zone
    const isParkedInactive = currCar.posX < -5000 && currCar.posZ < -200;
    if (isParkedInactive) {
      if (arena.cars[carIndex]) {
        arena.cars[carIndex].visible = false;
      }
      continue;
    }

    if (!arena.cars[carIndex] && typeof arena.ensureCar === 'function') {
      arena.ensureCar(carIndex, carIndex % 2, arena.carVisual || "game-car");
    }
    if (!arena.cars[carIndex]) continue;

    const isLocalCar = carIndex === (arena.playerCarIndex ?? 0);
    const carControls = typeof carControlsResolver === 'function'
      ? carControlsResolver(carIndex)
      : (carIndex === 0 ? controls : opponentControls);
    const carThrottle = isLocalCar ? actualThrottle : (carControls?.throttle ?? 0);

    const isRespawning = prevCar.isDemoed && !currCar.isDemoed;
    interpolatePhysicsTransform(
      arena.cars[carIndex],
      isRespawning ? currCar : prevCar,
      currCar,
      alpha,
      undefined,
      arena.pA,
      arena.pB,
      arena.qA,
      arena.qB
    );

    const isAlive = !currCar.isDemoed;
    arena.carDemolitions[carIndex]?.update(actualDelta, !isAlive, arena.cars[carIndex].position, activeVisuals);
    arena.cars[carIndex].visible = isAlive;

    const gimbal = arena.carGimbals[carIndex];
    if (gimbal && arena.vehicleRegistry.carLoaders.updateRealisticCockpitGimbal) {
      arena.vehicleRegistry.carLoaders.updateRealisticCockpitGimbal(
        arena.cars[carIndex].quaternion,
        currCar.velX,
        currCar.velY,
        actualDelta,
        gimbal
      );
    }

    updateCarSuspensionAndSteering(
      arena.carWheels[carIndex],
      arena.carWheelSpecs[carIndex],
      arena.carSuspension[carIndex],
      arena.wheelSpin[carIndex],
      currCar,
      arena.vehiclePresets[carIndex],
      actualDelta,
      carThrottle
    );

    const jets = arena.carJets[carIndex];
    if (jets) {
      updateCarAirJets(jets, carIndex, carControls, currCar, actualDelta, arena.vehicleRegistry);
    }
  }

  arena.lighting.updateSunIntensities(header.numCars);
  arena.lighting.updateShadows(arena.cars, arena.ball);
  arena.boostPadSystem?.update(currState, undefined, actualDelta, arena.camera);
  updateBoostVisuals(
    arena.cars,
    arena.carBoosts,
    currState,
    actualThrottle,
    actualDelta,
    opponentControls?.throttle ?? 0,
    activeVisuals,
    controls,
    opponentControls,
    arena.playerCarIndex,
    arena._headerView,
    arena._currCarView,
    carControlsResolver
  );
}
