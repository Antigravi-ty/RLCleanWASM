/**
 * kickoffDuelConfig.js
 * Pure data configuration and precomputed baseline matrix results for the 4-Model Kickoff Duel Lab.
 */

export const KICKOFF_DUEL_MODELS = Object.freeze([
  {
    id: 'ko_v2',
    name: 'Kickoff PPO v2 (RLRL101 a9a52e7)',
    shortName: 'KO_v2',
    arch: '42D -> 128x128 MLP (SafeTensors)',
    obsBadge: '42D (6D Opp Obs · Solo-Trained)',
    hasOpponentObs: false,
    obsNote: 'Blind (No Opponent Observation)',
    soloAvgFrames: 257.8,
  },
  {
    id: 'ko_v1',
    name: 'Kickoff PPO v1 (Legacy)',
    shortName: 'KO_v1',
    arch: '75D -> 256x256 MLP (SafeTensors)',
    obsBadge: '75D Blind (No Opp Obs)',
    hasOpponentObs: false,
    obsNote: 'Blind (No Opponent Observation)',
    soloAvgFrames: 259.2,
  },
  {
    id: 'nexto',
    name: 'Nexto (EARL Perceiver GC)',
    shortName: 'Nexto',
    arch: 'Perceiver 90-Act (SafeTensors)',
    obsBadge: 'Multi-Car Perceiver Obs',
    hasOpponentObs: true,
    obsNote: 'Opponent-Aware (Multi-Car Perceiver)',
    soloAvgFrames: 303.8,
  },
  {
    id: 'necto',
    name: 'Necto (EARL Perceiver Diamond)',
    shortName: 'Necto',
    arch: 'Perceiver 12-Logit (SafeTensors)',
    obsBadge: 'Multi-Car Perceiver Obs',
    hasOpponentObs: true,
    obsNote: 'Opponent-Aware (Multi-Car Perceiver)',
    soloAvgFrames: 307.0,
  },
]);

export const KICKOFF_DUEL_SLOTS = Object.freeze([
  { slotIndex: 0, code: 'DR', name: 'Diagonal Right', cppIdx: 0, bluePos: [-2048, -2560], blueYaw: 0.25 * Math.PI },
  { slotIndex: 1, code: 'DL', name: 'Diagonal Left', cppIdx: 1, bluePos: [2048, -2560], blueYaw: 0.75 * Math.PI },
  { slotIndex: 2, code: 'BR', name: 'Back Right', cppIdx: 2, bluePos: [-256, -3840], blueYaw: 0.5 * Math.PI },
  { slotIndex: 3, code: 'BL', name: 'Back Left', cppIdx: 3, bluePos: [256, -3840], blueYaw: 0.5 * Math.PI },
  { slotIndex: 4, code: 'CT', name: 'Center Back', cppIdx: 4, bluePos: [0, -4608], blueYaw: 0.5 * Math.PI },
]);

export const KICKOFF_DUEL_PAIRINGS = Object.freeze([
  { id: 'ko_v2_vs_ko_v1', label: 'KO_v2 vs KO_v1', blue: 'ko_v2', orange: 'ko_v1', category: 'cross' },
  { id: 'ko_v2_vs_nexto', label: 'KO_v2 vs Nexto', blue: 'ko_v2', orange: 'nexto', category: 'cross' },
  { id: 'ko_v2_vs_necto', label: 'KO_v2 vs Necto', blue: 'ko_v2', orange: 'necto', category: 'cross' },
  { id: 'ko_v1_vs_nexto', label: 'KO_v1 vs Nexto', blue: 'ko_v1', orange: 'nexto', category: 'cross' },
  { id: 'ko_v1_vs_necto', label: 'KO_v1 vs Necto', blue: 'ko_v1', orange: 'necto', category: 'cross' },
  { id: 'nexto_vs_necto', label: 'Nexto vs Necto', blue: 'nexto', orange: 'necto', category: 'cross' },
  { id: 'ko_v2_vs_ko_v2', label: 'KO_v2 vs KO_v2 (Self)', blue: 'ko_v2', orange: 'ko_v2', category: 'self' },
  { id: 'ko_v1_vs_ko_v1', label: 'KO_v1 vs KO_v1 (Self)', blue: 'ko_v1', orange: 'ko_v1', category: 'self' },
  { id: 'nexto_vs_nexto', label: 'Nexto vs Nexto (Self)', blue: 'nexto', orange: 'nexto', category: 'self' },
  { id: 'necto_vs_necto', label: 'Necto vs Necto (Self)', blue: 'necto', orange: 'necto', category: 'self' },
]);

export const INITIAL_SOLO_RESULTS = [
  { modelId: 'ko_v2', shortName: 'KO_v2', hasOpponentObs: false, slotTicks: [232, 232, 262, 262, 301], avgTicks: 257.8, avgSec: 2.15 },
  { modelId: 'ko_v1', shortName: 'KO_v1', hasOpponentObs: false, slotTicks: [232, 232, 264, 264, 304], avgTicks: 259.2, avgSec: 2.16 },
  { modelId: 'nexto', shortName: 'Nexto', hasOpponentObs: true, slotTicks: [287, 287, 302, 303, 340], avgTicks: 303.8, avgSec: 2.53 },
  { modelId: 'necto', shortName: 'Necto', hasOpponentObs: true, slotTicks: [283, 271, 328, 309, 344], avgTicks: 307.0, avgSec: 2.56 },
];

export const PRECOMPUTED_MATRIX_RESULTS = [
  {
    pairId: 'ko_v2_vs_ko_v1', label: 'KO_v2 vs KO_v1', category: 'cross', blue: 'ko_v2', orange: 'ko_v1', blueWins: 3, orangeWins: 0, ties: 2,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: -48, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 48, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 205, endBallX: -140, endBallY: -220, endBallVy: -185, outcome: 'Toward Blue (-Y) (KO_v1 Late Block)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 205, endBallX: 140, endBallY: -220, endBallVy: -185, outcome: 'Toward Blue (-Y) (KO_v1 Late Block)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 301, touchSec: 2.51, winner: 'BLUE', blueDist: 158, orangeDist: 221, endBallX: 0, endBallY: -310, endBallVy: -240, outcome: 'Toward Blue (-Y) (KO_v1 Late Block)' },
    ],
  },
  {
    pairId: 'ko_v2_vs_nexto', label: 'KO_v2 vs Nexto', category: 'cross', blue: 'ko_v2', orange: 'nexto', blueWins: 5, orangeWins: 0, ties: 0,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1094, endBallX: 980, endBallY: 3250, endBallVy: 1980, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1094, endBallX: -980, endBallY: 3250, endBallVy: 1980, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 822, endBallX: -120, endBallY: 3680, endBallVy: 2210, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 838, endBallX: 120, endBallY: 3680, endBallVy: 2210, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 301, touchSec: 2.51, winner: 'BLUE', blueDist: 158, orangeDist: 816, endBallX: 0, endBallY: 4120, endBallVy: 2540, outcome: 'Toward Orange (+Y)' },
    ],
  },
  {
    pairId: 'ko_v2_vs_necto', label: 'KO_v2 vs Necto', category: 'cross', blue: 'ko_v2', orange: 'necto', blueWins: 5, orangeWins: 0, ties: 0,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1020, endBallX: 960, endBallY: 3210, endBallVy: 1960, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 753, endBallX: -910, endBallY: 3100, endBallVy: 1890, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 1208, endBallX: -150, endBallY: 3740, endBallVy: 2260, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 262, touchSec: 2.18, winner: 'BLUE', blueDist: 161, orangeDist: 938, endBallX: 150, endBallY: 3710, endBallVy: 2230, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 301, touchSec: 2.51, winner: 'BLUE', blueDist: 158, orangeDist: 865, endBallX: 0, endBallY: 4150, endBallVy: 2560, outcome: 'Toward Orange (+Y)' },
    ],
  },
  {
    pairId: 'ko_v1_vs_nexto', label: 'KO_v1 vs Nexto', category: 'cross', blue: 'ko_v1', orange: 'nexto', blueWins: 5, orangeWins: 0, ties: 0,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1094, endBallX: 970, endBallY: 3240, endBallVy: 1975, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1094, endBallX: -970, endBallY: 3240, endBallVy: 1975, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 264, touchSec: 2.20, winner: 'BLUE', blueDist: 165, orangeDist: 782, endBallX: -110, endBallY: 3590, endBallVy: 2150, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 264, touchSec: 2.20, winner: 'BLUE', blueDist: 165, orangeDist: 798, endBallX: 110, endBallY: 3590, endBallVy: 2150, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 304, touchSec: 2.53, winner: 'BLUE', blueDist: 161, orangeDist: 753, endBallX: 0, endBallY: 4010, endBallVy: 2480, outcome: 'Toward Orange (+Y)' },
    ],
  },
  {
    pairId: 'ko_v1_vs_necto', label: 'KO_v1 vs Necto', category: 'cross', blue: 'ko_v1', orange: 'necto', blueWins: 5, orangeWins: 0, ties: 0,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 1020, endBallX: 955, endBallY: 3200, endBallVy: 1950, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'BLUE', blueDist: 162, orangeDist: 753, endBallX: -905, endBallY: 3090, endBallVy: 1880, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 264, touchSec: 2.20, winner: 'BLUE', blueDist: 165, orangeDist: 1170, endBallX: -140, endBallY: 3690, endBallVy: 2210, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 264, touchSec: 2.20, winner: 'BLUE', blueDist: 165, orangeDist: 901, endBallX: 140, endBallY: 3660, endBallVy: 2190, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 304, touchSec: 2.53, winner: 'BLUE', blueDist: 161, orangeDist: 806, endBallX: 0, endBallY: 4060, endBallVy: 2510, outcome: 'Toward Orange (+Y)' },
    ],
  },
  {
    pairId: 'nexto_vs_necto', label: 'Nexto vs Necto', category: 'cross', blue: 'nexto', orange: 'necto', blueWins: 3, orangeWins: 2, ties: 0,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 283, touchSec: 2.36, winner: 'ORANGE', blueDist: 231, orangeDist: 160, endBallX: 210, endBallY: 280, endBallVy: 190, outcome: 'Toward Orange (+Y) (Nexto Counter)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 271, touchSec: 2.26, winner: 'ORANGE', blueDist: 447, orangeDist: 164, endBallX: -420, endBallY: -890, endBallVy: -610, outcome: 'Toward Blue (-Y)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 302, touchSec: 2.52, winner: 'BLUE', blueDist: 164, orangeDist: 534, endBallX: -190, endBallY: 1640, endBallVy: 1120, outcome: 'Toward Orange (+Y)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 303, touchSec: 2.53, winner: 'BLUE', blueDist: 165, orangeDist: 277, endBallX: 140, endBallY: -260, endBallVy: -195, outcome: 'Toward Blue (-Y) (Necto Block)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 340, touchSec: 2.83, winner: 'BLUE', blueDist: 164, orangeDist: 229, endBallX: 0, endBallY: -210, endBallVy: -180, outcome: 'Toward Blue (-Y) (Necto Block)' },
    ],
  },
  {
    pairId: 'ko_v2_vs_ko_v2', label: 'KO_v2 vs KO_v2 (Self)', category: 'self', blue: 'ko_v2', orange: 'ko_v2', blueWins: 0, orangeWins: 0, ties: 5,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 262, touchSec: 2.18, winner: 'TIE', blueDist: 161, orangeDist: 161, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 262, touchSec: 2.18, winner: 'TIE', blueDist: 161, orangeDist: 161, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 301, touchSec: 2.51, winner: 'TIE', blueDist: 158, orangeDist: 158, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
    ],
  },
  {
    pairId: 'ko_v1_vs_ko_v1', label: 'KO_v1 vs KO_v1 (Self)', category: 'self', blue: 'ko_v1', orange: 'ko_v1', blueWins: 0, orangeWins: 0, ties: 5,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 232, touchSec: 1.93, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 264, touchSec: 2.20, winner: 'TIE', blueDist: 165, orangeDist: 165, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 264, touchSec: 2.20, winner: 'TIE', blueDist: 165, orangeDist: 165, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 304, touchSec: 2.53, winner: 'TIE', blueDist: 161, orangeDist: 161, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
    ],
  },
  {
    pairId: 'nexto_vs_nexto', label: 'Nexto vs Nexto (Self)', category: 'self', blue: 'nexto', orange: 'nexto', blueWins: 0, orangeWins: 0, ties: 5,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 287, touchSec: 2.39, winner: 'TIE', blueDist: 164, orangeDist: 164, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 287, touchSec: 2.39, winner: 'TIE', blueDist: 164, orangeDist: 164, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 302, touchSec: 2.52, winner: 'TIE', blueDist: 164, orangeDist: 164, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 303, touchSec: 2.53, winner: 'TIE', blueDist: 165, orangeDist: 165, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 340, touchSec: 2.83, winner: 'TIE', blueDist: 164, orangeDist: 164, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
    ],
  },
  {
    pairId: 'necto_vs_necto', label: 'Necto vs Necto (Self)', category: 'self', blue: 'necto', orange: 'necto', blueWins: 0, orangeWins: 0, ties: 5,
    slots: [
      { slotIndex: 0, slotCode: 'DR', touchTick: 283, touchSec: 2.36, winner: 'TIE', blueDist: 160, orangeDist: 160, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 1, slotCode: 'DL', touchTick: 271, touchSec: 2.26, winner: 'TIE', blueDist: 164, orangeDist: 164, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 2, slotCode: 'BR', touchTick: 328, touchSec: 2.73, winner: 'TIE', blueDist: 161, orangeDist: 161, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 3, slotCode: 'BL', touchTick: 309, touchSec: 2.58, winner: 'TIE', blueDist: 162, orangeDist: 162, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
      { slotIndex: 4, slotCode: 'CT', touchTick: 344, touchSec: 2.87, winner: 'TIE', blueDist: 163, orangeDist: 163, endBallX: 0, endBallY: 0, endBallVy: 0, outcome: 'Dead-Ball Neutral (0,0)' },
    ],
  },
];
