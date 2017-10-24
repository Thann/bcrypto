/*!
 * blake2b.js - BLAKE2b implementation for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 *
 * Parts of this software are based on blakejs:
 *   https://github.com/dcposch/blakejs/blob/master/blake2b.js
 */

'use strict';

const assert = require('assert');

let ctx = null;

/*
 * Constants
 */

const FINALIZED = 0x80000000;

const IV = [
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85,
  0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
  0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
  0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19
];

const SIGMA = [
  0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e,
  0x10, 0x12, 0x14, 0x16, 0x18, 0x1a, 0x1c, 0x1e,
  0x1c, 0x14, 0x08, 0x10, 0x12, 0x1e, 0x1a, 0x0c,
  0x02, 0x18, 0x00, 0x04, 0x16, 0x0e, 0x0a, 0x06,
  0x16, 0x10, 0x18, 0x00, 0x0a, 0x04, 0x1e, 0x1a,
  0x14, 0x1c, 0x06, 0x0c, 0x0e, 0x02, 0x12, 0x08,
  0x0e, 0x12, 0x06, 0x02, 0x1a, 0x18, 0x16, 0x1c,
  0x04, 0x0c, 0x0a, 0x14, 0x08, 0x00, 0x1e, 0x10,
  0x12, 0x00, 0x0a, 0x0e, 0x04, 0x08, 0x14, 0x1e,
  0x1c, 0x02, 0x16, 0x18, 0x0c, 0x10, 0x06, 0x1a,
  0x04, 0x18, 0x0c, 0x14, 0x00, 0x16, 0x10, 0x06,
  0x08, 0x1a, 0x0e, 0x0a, 0x1e, 0x1c, 0x02, 0x12,
  0x18, 0x0a, 0x02, 0x1e, 0x1c, 0x1a, 0x08, 0x14,
  0x00, 0x0e, 0x0c, 0x06, 0x12, 0x04, 0x10, 0x16,
  0x1a, 0x16, 0x0e, 0x1c, 0x18, 0x02, 0x06, 0x12,
  0x0a, 0x00, 0x1e, 0x08, 0x10, 0x0c, 0x04, 0x14,
  0x0c, 0x1e, 0x1c, 0x12, 0x16, 0x06, 0x00, 0x10,
  0x18, 0x04, 0x1a, 0x0e, 0x02, 0x08, 0x14, 0x0a,
  0x14, 0x04, 0x10, 0x08, 0x0e, 0x0c, 0x02, 0x0a,
  0x1e, 0x16, 0x12, 0x1c, 0x06, 0x18, 0x1a, 0x00,
  0x00, 0x02, 0x04, 0x06, 0x08, 0x0a, 0x0c, 0x0e,
  0x10, 0x12, 0x14, 0x16, 0x18, 0x1a, 0x1c, 0x1e,
  0x1c, 0x14, 0x08, 0x10, 0x12, 0x1e, 0x1a, 0x0c,
  0x02, 0x18, 0x00, 0x04, 0x16, 0x0e, 0x0a, 0x06
];

const V = new Uint32Array(32);
const M = new Uint32Array(32);

class Blake2b {
  /**
   * Blake2b
   * @constructor
   */

  constructor() {
    this.size = 32;
    this.state = new Array(16);
    this.block = Buffer.allocUnsafe(128);
    this.total = 0;
    this.rest = 0;
  }

  init(size = 32, key = null) {
    assert((size >>> 0) === size);

    if (size === 0 || size > 64)
      throw new Error('Bad output length.');

    this.size = size;

    assert(!key || Buffer.isBuffer(key));

    if (key && key.length > 64)
      throw new Error('Bad key length.');

    for (let i = 0; i < 16; i++)
      this.state[i] = IV[i];

    this.block.fill(0);
    this.total = 0;
    this.rest = 0;

    const keylen = key ? key.length : 0;

    this.state[0] ^= 0x01010000 ^ (keylen << 8) ^ this.size;

    if (key) {
      this.update(key);
      this.rest = 128;
    }
  }

  update(data) {
    assert(Buffer.isBuffer(data));

    if (this.rest & FINALIZED)
      return;

    const index = this.rest;

    let size = data.length;
    let off = 0;

    this.rest = (this.rest + size) % 128;

    if (index) {
      const left = 128 - index;
      const len = size < left ? size : left;

      data.copy(this.block, index, off, off + len);

      if (size < left)
        return;

      this.total += 128;
      this.compress(this.block, off, false);

      off += left;
      size -= left;
    }

    while (size >= 128) {
      this.total += 128;
      this.compress(data, off, false);
      off += 128;
      size -= 128;
    }

    if (size)
      data.copy(this.block, 0, off, off + size);
  }

  compress(block, off, last) {
    for (let i = 0; i < 16; i++) {
      V[i] = this.state[i];
      V[i + 16] = IV[i];
    }

    V[24] ^= this.total;
    V[25] ^= this.total * (1 / 0x100000000);

    if (last) {
      V[28] = ~V[28];
      V[29] = ~V[29];
    }

    for (let i = 0; i < 32; i++) {
      M[i] = B2B_GET32(block, off);
      off += 4;
    }

    for (let i = 0; i < 12; i++) {
      B2B_G(V, M, 0, 8, 16, 24, SIGMA[i * 16 + 0], SIGMA[i * 16 + 1]);
      B2B_G(V, M, 2, 10, 18, 26, SIGMA[i * 16 + 2], SIGMA[i * 16 + 3]);
      B2B_G(V, M, 4, 12, 20, 28, SIGMA[i * 16 + 4], SIGMA[i * 16 + 5]);
      B2B_G(V, M, 6, 14, 22, 30, SIGMA[i * 16 + 6], SIGMA[i * 16 + 7]);
      B2B_G(V, M, 0, 10, 20, 30, SIGMA[i * 16 + 8], SIGMA[i * 16 + 9]);
      B2B_G(V, M, 2, 12, 22, 24, SIGMA[i * 16 + 10], SIGMA[i * 16 + 11]);
      B2B_G(V, M, 4, 14, 16, 26, SIGMA[i * 16 + 12], SIGMA[i * 16 + 13]);
      B2B_G(V, M, 6, 8, 18, 28, SIGMA[i * 16 + 14], SIGMA[i * 16 + 15]);
    }

    for (let i = 0; i < 16; i++)
      this.state[i] ^= V[i] ^ V[i + 16];
  }

  final() {
    if (!(this.rest & FINALIZED)) {
      this.total += this.rest;
      this.block.fill(0, this.rest, 128);
      this.compress(this.block, 0, true);
      this.rest = FINALIZED;
    }

    const out = Buffer.allocUnsafe(this.size);

    for (let i = 0; i < this.size; i++)
      out[i] = this.state[i >> 2] >> (8 * (i & 3));

    return out;
  }

  static hash() {
    return new Blake2b();
  }

  static hmac() {
    return new BlakeHmac();
  }

  static digest(data, size = 32, key = null) {
    ctx.init(size, key);
    ctx.update(data);
    return ctx.final();
  }

  static root(left, right, size = 32) {
    ctx.init(size);
    ctx.update(left);
    ctx.update(right);
    return ctx.final();
  }

  static mac(data, key, size = 32) {
    assert(Buffer.isBuffer(key));
    return Blake2b.digest(data, size, key);
  }
}

ctx = new Blake2b();

class BlakeHmac extends Blake2b {
  constructor() {
    super();
  }
  init(key, size = 32) {
    assert(Buffer.isBuffer(key));
    return super.init(size, key);
  }
}

/*
 * Helpers
 */

function ADD64AA(v, a, b) {
  const o0 = v[a] + v[b];

  let o1 = v[a + 1] + v[b + 1];
  if (o0 >= 0x100000000)
    o1++;

  v[a] = o0;
  v[a + 1] = o1;
}

function ADD64AC(v, a, b0, b1) {
  let o0 = v[a] + b0;
  if (b0 < 0)
    o0 += 0x100000000;

  let o1 = v[a + 1] + b1;
  if (o0 >= 0x100000000)
    o1++;

  v[a] = o0;
  v[a + 1] = o1;
}

function B2B_GET32(data, off) {
  return data[off]
    ^ (data[off + 1] << 8)
    ^ (data[off + 2] << 16)
    ^ (data[off + 3] << 24);
}

function B2B_G(v, m, a, b, c, d, ix, iy) {
  const x0 = m[ix];
  const x1 = m[ix + 1];
  const y0 = m[iy];
  const y1 = m[iy + 1];
  let xor0, xor1;

  // v[a,a+1] += v[b,b+1]
  ADD64AA(v, a, b);
  // v[a, a+1] += x
  ADD64AC(v, a, x0, x1);

  // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotr 32
  xor0 = v[d] ^ v[a];
  xor1 = v[d + 1] ^ v[a + 1];
  v[d] = xor1;
  v[d + 1] = xor0;

  ADD64AA(v, c, d);

  // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotr 24
  xor0 = v[b] ^ v[c];
  xor1 = v[b + 1] ^ v[c + 1];
  v[b] = (xor0 >>> 24) ^ (xor1 << 8);
  v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);

  ADD64AA(v, a, b);
  ADD64AC(v, a, y0, y1);

  // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotr 16
  xor0 = v[d] ^ v[a];
  xor1 = v[d + 1] ^ v[a + 1];
  v[d] = (xor0 >>> 16) ^ (xor1 << 16);
  v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);

  ADD64AA(v, c, d);

  // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotr 63
  xor0 = v[b] ^ v[c];
  xor1 = v[b + 1] ^ v[c + 1];
  v[b] = (xor1 >>> 31) ^ (xor0 << 1);
  v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
}

/*
 * Expose
 */

module.exports = Blake2b;