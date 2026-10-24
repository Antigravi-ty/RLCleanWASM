/**
 * EarlPerceiverEngine.js
 * Pure-Web Float32 EARLPerceiver (Entity-Attention Reinforcement Learning) inference engine
 * for Necto (1-block Perceiver) and Nexto (2-block Pre-LN Perceiver).
 *
 * Uses preallocated Float32Array scratch buffers for zero-GC real-time execution
 * across arbitrary numbers of arena entities (1v1 = 37, 2v2 = 39, 3v3 = 41, up to 8 cars = 43).
 */

const MAX_ENTITIES = 64;
const EMBED_DIM = 128;
const NUM_HEADS = 4;
const HEAD_DIM = 32;
const ATTN_SCALE = 5.656854249492381; // Math.sqrt(32)
const LN_EPS = 1e-5;

/**
 * Dense linear transformation for a single vector: out[outDim] = weight[outDim, inDim] * x[inDim] + bias[outDim]
 */
function linearVec(x, inDim, outDim, weight, bias, out, applyReLU = false) {
  const inDim4 = inDim & ~3;
  for (let o = 0; o < outDim; o++) {
    let sum = bias[o];
    const wOff = o * inDim;
    let i = 0;
    for (; i < inDim4; i += 4) {
      sum +=
        weight[wOff + i] * x[i] +
        weight[wOff + i + 1] * x[i + 1] +
        weight[wOff + i + 2] * x[i + 2] +
        weight[wOff + i + 3] * x[i + 3];
    }
    for (; i < inDim; i++) {
      sum += weight[wOff + i] * x[i];
    }
    out[o] = applyReLU && sum < 0 ? 0 : sum;
  }
}

/**
 * Batched linear transformation over N entity tokens:
 * out[n, outDim] = weight[outDim, inDim] * x[n, inDim] + bias[outDim]
 */
function linearBatch(x, numTokens, inDim, outDim, weight, bias, out, applyReLU = false) {
  const inDim4 = inDim & ~3;
  for (let n = 0; n < numTokens; n++) {
    const inBase = n * inDim;
    const outBase = n * outDim;
    for (let o = 0; o < outDim; o++) {
      let sum = bias[o];
      const wOff = o * inDim;
      let i = 0;
      for (; i < inDim4; i += 4) {
        sum +=
          weight[wOff + i] * x[inBase + i] +
          weight[wOff + i + 1] * x[inBase + i + 1] +
          weight[wOff + i + 2] * x[inBase + i + 2] +
          weight[wOff + i + 3] * x[inBase + i + 3];
      }
      for (; i < inDim; i++) {
        sum += weight[wOff + i] * x[inBase + i];
      }
      out[outBase + o] = applyReLU && sum < 0 ? 0 : sum;
    }
  }
}

/**
 * LayerNorm over the last dimension (128) for N tokens.
 */
function layerNorm128(x, numTokens, weight, bias, out) {
  for (let n = 0; n < numTokens; n++) {
    const base = n * EMBED_DIM;
    let sum = 0;
    for (let d = 0; d < EMBED_DIM; d++) {
      sum += x[base + d];
    }
    const mean = sum / EMBED_DIM;
    let varSum = 0;
    for (let d = 0; d < EMBED_DIM; d++) {
      const diff = x[base + d] - mean;
      varSum += diff * diff;
    }
    const invStd = 1.0 / Math.sqrt(varSum / EMBED_DIM + LN_EPS);
    for (let d = 0; d < EMBED_DIM; d++) {
      out[base + d] = (x[base + d] - mean) * invStd * weight[d] + bias[d];
    }
  }
}

/**
 * 4-Head Cross-Attention where Query has length 1 (128-dim) and Key/Value has length numEntities (numEntities * 128).
 * Matches PyTorch torch.nn.MultiheadAttention with in_proj_weight [384, 128] and in_proj_bias [384].
 */
function crossAttentionSingleQuery(
  qVec,
  kvMat,
  numEntities,
  mask,
  inProjWeight,
  inProjBias,
  outProjWeight,
  outProjBias,
  qProjBuf,
  kProjBuf,
  vProjBuf,
  scoresBuf,
  headConcatBuf,
  outVec
) {
  // 1. Project Query (1 x 128) using first 128 rows of inProjWeight
  for (let o = 0; o < EMBED_DIM; o++) {
    let sum = inProjBias[o];
    const wOff = o * EMBED_DIM;
    for (let i = 0; i < EMBED_DIM; i += 4) {
      sum +=
        inProjWeight[wOff + i] * qVec[i] +
        inProjWeight[wOff + i + 1] * qVec[i + 1] +
        inProjWeight[wOff + i + 2] * qVec[i + 2] +
        inProjWeight[wOff + i + 3] * qVec[i + 3];
    }
    qProjBuf[o] = sum / ATTN_SCALE;
  }

  // 2. Project Keys (rows 128..255) and Values (rows 256..383) for all entities
  const kWeightOffset = EMBED_DIM * EMBED_DIM;
  const vWeightOffset = 2 * EMBED_DIM * EMBED_DIM;
  const kBiasOffset = EMBED_DIM;
  const vBiasOffset = 2 * EMBED_DIM;

  for (let n = 0; n < numEntities; n++) {
    const kvBase = n * EMBED_DIM;
    for (let o = 0; o < EMBED_DIM; o++) {
      let sumK = inProjBias[kBiasOffset + o];
      let sumV = inProjBias[vBiasOffset + o];
      const wkOff = kWeightOffset + o * EMBED_DIM;
      const wvOff = vWeightOffset + o * EMBED_DIM;
      for (let i = 0; i < EMBED_DIM; i += 4) {
        const v0 = kvMat[kvBase + i];
        const v1 = kvMat[kvBase + i + 1];
        const v2 = kvMat[kvBase + i + 2];
        const v3 = kvMat[kvBase + i + 3];
        sumK +=
          inProjWeight[wkOff + i] * v0 +
          inProjWeight[wkOff + i + 1] * v1 +
          inProjWeight[wkOff + i + 2] * v2 +
          inProjWeight[wkOff + i + 3] * v3;
        sumV +=
          inProjWeight[wvOff + i] * v0 +
          inProjWeight[wvOff + i + 1] * v1 +
          inProjWeight[wvOff + i + 2] * v2 +
          inProjWeight[wvOff + i + 3] * v3;
      }
      kProjBuf[kvBase + o] = sumK;
      vProjBuf[kvBase + o] = sumV;
    }
  }

  // 3. Per-head scaled dot-product attention & value aggregation
  for (let h = 0; h < NUM_HEADS; h++) {
    const headOffset = h * HEAD_DIM;
    let maxScore = -Infinity;

    for (let n = 0; n < numEntities; n++) {
      const kBase = n * EMBED_DIM + headOffset;
      let dot = 0;
      for (let d = 0; d < HEAD_DIM; d++) {
        dot += qProjBuf[headOffset + d] * kProjBuf[kBase + d];
      }
      const mVal = mask ? mask[n] : 0;
      const s = mVal !== 0 ? dot + (mVal < 0 ? mVal : -1e9) : dot;
      scoresBuf[n] = s;
      if (s > maxScore) maxScore = s;
    }

    let expSum = 0;
    for (let n = 0; n < numEntities; n++) {
      const e = Math.exp(scoresBuf[n] - maxScore);
      scoresBuf[n] = e;
      expSum += e;
    }
    const invExpSum = expSum > 0 ? 1.0 / expSum : 0;

    for (let d = 0; d < HEAD_DIM; d++) {
      let acc = 0;
      for (let n = 0; n < numEntities; n++) {
        acc += scoresBuf[n] * invExpSum * vProjBuf[n * EMBED_DIM + headOffset + d];
      }
      headConcatBuf[headOffset + d] = acc;
    }
  }

  // 4. Output projection (128 -> 128)
  linearVec(headConcatBuf, EMBED_DIM, EMBED_DIM, outProjWeight, outProjBias, outVec, false);
}

export class EarlPerceiverEngine {
  constructor() {
    this.qH1 = new Float32Array(EMBED_DIM);
    this.qEmbed = new Float32Array(EMBED_DIM);
    this.kvH1 = new Float32Array(MAX_ENTITIES * EMBED_DIM);
    this.kvEmbed = new Float32Array(MAX_ENTITIES * EMBED_DIM);

    this.qNorm = new Float32Array(EMBED_DIM);
    this.kvNorm = new Float32Array(MAX_ENTITIES * EMBED_DIM);

    this.qProj = new Float32Array(EMBED_DIM);
    this.kProj = new Float32Array(MAX_ENTITIES * EMBED_DIM);
    this.vProj = new Float32Array(MAX_ENTITIES * EMBED_DIM);
    this.scores = new Float32Array(MAX_ENTITIES);
    this.headConcat = new Float32Array(EMBED_DIM);
    this.attnOut = new Float32Array(EMBED_DIM);

    this.res1 = new Float32Array(EMBED_DIM);
    this.res1Norm = new Float32Array(EMBED_DIM);
    this.ffnHidden = new Float32Array(512);
    this.ffnOut = new Float32Array(EMBED_DIM);
    this.blockOut = new Float32Array(EMBED_DIM);

    this.postReLU = new Float32Array(EMBED_DIM);
    this.nectoLogits = new Float32Array(12);
    this.nextoEmb32 = new Float32Array(32);
    this.nextoLogits = new Float32Array(90);
  }

  /**
   * Forward pass for Necto (1-block Perceiver without LayerNorm, 12-dim discrete output head).
   * @param {Float32Array} query [32]
   * @param {Float32Array} entities [numEntities * 24]
   * @param {number} numEntities
   * @param {Object} tensors Parsed SafeTensors dictionary
   * @param {Float32Array} [mask] Optional [numEntities] mask
   * @returns {Float32Array} [12] raw logits ([3 throttle, 3 steer, 2 jump, 2 boost, 2 handbrake])
   */
  forwardNecto(query, entities, numEntities, tensors, mask = null) {
    if (numEntities > MAX_ENTITIES) {
      throw new Error(`[EarlPerceiverEngine] numEntities (${numEntities}) exceeds MAX_ENTITIES (${MAX_ENTITIES}).`);
    }

    // 1. Query preprocess: Linear(32->128) -> ReLU -> Linear(128->128) -> ReLU
    linearVec(
      query, 32, 128,
      tensors['net.earl.query_preprocess.0.weight'].data,
      tensors['net.earl.query_preprocess.0.bias'].data,
      this.qH1, true
    );
    linearVec(
      this.qH1, 128, 128,
      tensors['net.earl.query_preprocess.2.weight'].data,
      tensors['net.earl.query_preprocess.2.bias'].data,
      this.qEmbed, true
    );

    // 2. Key-Value preprocess: Linear(24->128) -> ReLU -> Linear(128->128) -> ReLU
    linearBatch(
      entities, numEntities, 24, 128,
      tensors['net.earl.key_value_preprocess.0.weight'].data,
      tensors['net.earl.key_value_preprocess.0.bias'].data,
      this.kvH1, true
    );
    linearBatch(
      this.kvH1, numEntities, 128, 128,
      tensors['net.earl.key_value_preprocess.2.weight'].data,
      tensors['net.earl.key_value_preprocess.2.bias'].data,
      this.kvEmbed, true
    );

    // 3. Block 0: Cross-Attention + Residual + FFN (128 -> 256 -> 128) + Residual
    crossAttentionSingleQuery(
      this.qEmbed,
      this.kvEmbed,
      numEntities,
      mask,
      tensors['net.earl.blocks.0.attention.in_proj_weight'].data,
      tensors['net.earl.blocks.0.attention.in_proj_bias'].data,
      tensors['net.earl.blocks.0.attention.out_proj.weight'].data,
      tensors['net.earl.blocks.0.attention.out_proj.bias'].data,
      this.qProj,
      this.kProj,
      this.vProj,
      this.scores,
      this.headConcat,
      this.attnOut
    );

    for (let d = 0; d < EMBED_DIM; d++) {
      this.res1[d] = this.qEmbed[d] + this.attnOut[d];
    }

    linearVec(
      this.res1, 128, 256,
      tensors['net.earl.blocks.0.linear1.weight'].data,
      tensors['net.earl.blocks.0.linear1.bias'].data,
      this.ffnHidden, true
    );
    linearVec(
      this.ffnHidden, 256, 128,
      tensors['net.earl.blocks.0.linear2.weight'].data,
      tensors['net.earl.blocks.0.linear2.bias'].data,
      this.ffnOut, false
    );

    for (let d = 0; d < EMBED_DIM; d++) {
      const v = this.res1[d] + this.ffnOut[d];
      this.postReLU[d] = v > 0 ? v : 0;
    }

    // 4. Output head: Linear(128 -> 12)
    linearVec(
      this.postReLU, 128, 12,
      tensors['net.output.linear.weight'].data,
      tensors['net.output.linear.bias'].data,
      this.nectoLogits, false
    );

    return this.nectoLogits;
  }

  /**
   * Forward pass for Nexto (2-block Pre-LN Perceiver, 90-action dot-product output head).
   * @param {Float32Array} query [32]
   * @param {Float32Array} entities [numEntities * 24]
   * @param {number} numEntities
   * @param {Object} tensors Parsed SafeTensors dictionary
   * @param {Float32Array} [mask] Optional [numEntities] mask
   * @returns {Float32Array} [90] action logits
   */
  forwardNexto(query, entities, numEntities, tensors, mask = null) {
    if (numEntities > MAX_ENTITIES) {
      throw new Error(`[EarlPerceiverEngine] numEntities (${numEntities}) exceeds MAX_ENTITIES (${MAX_ENTITIES}).`);
    }

    // 1. Query preprocess: Linear(32->128) -> ReLU -> Linear(128->128) -> ReLU
    linearVec(
      query, 32, 128,
      tensors['net.earl.query_preprocess.0.weight'].data,
      tensors['net.earl.query_preprocess.0.bias'].data,
      this.qH1, true
    );
    linearVec(
      this.qH1, 128, 128,
      tensors['net.earl.query_preprocess.2.weight'].data,
      tensors['net.earl.query_preprocess.2.bias'].data,
      this.qEmbed, true
    );

    // 2. Key-Value preprocess: Linear(24->128) -> ReLU -> Linear(128->128) -> ReLU
    linearBatch(
      entities, numEntities, 24, 128,
      tensors['net.earl.key_value_preprocess.0.weight'].data,
      tensors['net.earl.key_value_preprocess.0.bias'].data,
      this.kvH1, true
    );
    linearBatch(
      this.kvH1, numEntities, 128, 128,
      tensors['net.earl.key_value_preprocess.2.weight'].data,
      tensors['net.earl.key_value_preprocess.2.bias'].data,
      this.kvEmbed, true
    );

    // 3. Block 0 (Pre-LN)
    layerNorm128(
      this.qEmbed, 1,
      tensors['net.earl.blocks.0.norm1.weight'].data,
      tensors['net.earl.blocks.0.norm1.bias'].data,
      this.qNorm
    );
    layerNorm128(
      this.kvEmbed, numEntities,
      tensors['net.earl.blocks.0.norm2.weight'].data,
      tensors['net.earl.blocks.0.norm2.bias'].data,
      this.kvNorm
    );
    crossAttentionSingleQuery(
      this.qNorm,
      this.kvNorm,
      numEntities,
      mask,
      tensors['net.earl.blocks.0.attention.in_proj_weight'].data,
      tensors['net.earl.blocks.0.attention.in_proj_bias'].data,
      tensors['net.earl.blocks.0.attention.out_proj.weight'].data,
      tensors['net.earl.blocks.0.attention.out_proj.bias'].data,
      this.qProj,
      this.kProj,
      this.vProj,
      this.scores,
      this.headConcat,
      this.attnOut
    );
    for (let d = 0; d < EMBED_DIM; d++) {
      this.res1[d] = this.qEmbed[d] + this.attnOut[d];
    }
    layerNorm128(
      this.res1, 1,
      tensors['net.earl.blocks.0.norm3.weight'].data,
      tensors['net.earl.blocks.0.norm3.bias'].data,
      this.res1Norm
    );
    linearVec(
      this.res1Norm, 128, 512,
      tensors['net.earl.blocks.0.linear1.weight'].data,
      tensors['net.earl.blocks.0.linear1.bias'].data,
      this.ffnHidden, true
    );
    linearVec(
      this.ffnHidden, 512, 128,
      tensors['net.earl.blocks.0.linear2.weight'].data,
      tensors['net.earl.blocks.0.linear2.bias'].data,
      this.ffnOut, false
    );
    for (let d = 0; d < EMBED_DIM; d++) {
      this.blockOut[d] = this.res1[d] + this.ffnOut[d];
    }

    // 4. Block 1 (Pre-LN, reuses kvEmbed from step 2)
    layerNorm128(
      this.blockOut, 1,
      tensors['net.earl.blocks.1.norm1.weight'].data,
      tensors['net.earl.blocks.1.norm1.bias'].data,
      this.qNorm
    );
    layerNorm128(
      this.kvEmbed, numEntities,
      tensors['net.earl.blocks.1.norm2.weight'].data,
      tensors['net.earl.blocks.1.norm2.bias'].data,
      this.kvNorm
    );
    crossAttentionSingleQuery(
      this.qNorm,
      this.kvNorm,
      numEntities,
      mask,
      tensors['net.earl.blocks.1.attention.in_proj_weight'].data,
      tensors['net.earl.blocks.1.attention.in_proj_bias'].data,
      tensors['net.earl.blocks.1.attention.out_proj.weight'].data,
      tensors['net.earl.blocks.1.attention.out_proj.bias'].data,
      this.qProj,
      this.kProj,
      this.vProj,
      this.scores,
      this.headConcat,
      this.attnOut
    );
    for (let d = 0; d < EMBED_DIM; d++) {
      this.res1[d] = this.blockOut[d] + this.attnOut[d];
    }
    layerNorm128(
      this.res1, 1,
      tensors['net.earl.blocks.1.norm3.weight'].data,
      tensors['net.earl.blocks.1.norm3.bias'].data,
      this.res1Norm
    );
    linearVec(
      this.res1Norm, 128, 512,
      tensors['net.earl.blocks.1.linear1.weight'].data,
      tensors['net.earl.blocks.1.linear1.bias'].data,
      this.ffnHidden, true
    );
    linearVec(
      this.ffnHidden, 512, 128,
      tensors['net.earl.blocks.1.linear2.weight'].data,
      tensors['net.earl.blocks.1.linear2.bias'].data,
      this.ffnOut, false
    );
    for (let d = 0; d < EMBED_DIM; d++) {
      const v = this.res1[d] + this.ffnOut[d];
      this.postReLU[d] = v > 0 ? v : 0;
    }

    // 5. Output head (ControlsPredictorDot): emb_convertor (128 -> 32) dot precomputed.action_embeddings (90 x 32)
    linearVec(
      this.postReLU, 128, 32,
      tensors['net.output.emb_convertor.weight'].data,
      tensors['net.output.emb_convertor.bias'].data,
      this.nextoEmb32, false
    );

    const actEmb = tensors['precomputed.action_embeddings'].data;
    for (let a = 0; a < 90; a++) {
      const aOff = a * 32;
      let dot = 0;
      for (let d = 0; d < 32; d++) {
        dot += actEmb[aOff + d] * this.nextoEmb32[d];
      }
      this.nextoLogits[a] = dot;
    }

    return this.nextoLogits;
  }
}
