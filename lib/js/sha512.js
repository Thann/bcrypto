/*!
 * sha512.js - SHA512 implementation for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 * Parts of this software based on hash.js.
 */

/* eslint camelcase: "off" */

'use strict';

const assert = require('assert');
const HMAC = require('../hmac');

/*
 * Constants
 */

const DESC = Buffer.allocUnsafe(8);
const PADDING = Buffer.allocUnsafe(128);

const K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
  0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
  0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
  0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
  0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
  0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
  0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
  0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
  0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
  0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
  0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
  0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
  0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
  0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
  0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
  0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
  0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
  0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
  0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
  0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
  0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
  0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
  0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
  0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
  0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
];

PADDING.fill(0);
PADDING[0] = 0x80;

let ctx = null;

/**
 * SHA512
 */

class SHA512 {
  /**
   * Create a SHA512 context.
   * @constructor
   */

  constructor() {
    this.s = new Array(16);
    this.w = new Array(160);
    this.block = Buffer.allocUnsafe(128);
    this.bytes = 0;
  }

  /**
   * Initialize SHA512 context.
   */

  init() {
    this.s[0] = 0x6a09e667;
    this.s[1] = 0xf3bcc908;
    this.s[2] = 0xbb67ae85;
    this.s[3] = 0x84caa73b;
    this.s[4] = 0x3c6ef372;
    this.s[5] = 0xfe94f82b;
    this.s[6] = 0xa54ff53a;
    this.s[7] = 0x5f1d36f1;
    this.s[8] = 0x510e527f;
    this.s[9] = 0xade682d1;
    this.s[10] = 0x9b05688c;
    this.s[11] = 0x2b3e6c1f;
    this.s[12] = 0x1f83d9ab;
    this.s[13] = 0xfb41bd6b;
    this.s[14] = 0x5be0cd19;
    this.s[15] = 0x137e2179;
    this.bytes = 0;
    return this;
  }

  /**
   * Update SHA512 context.
   * @param {Buffer} data
   */

  update(data) {
    assert(Buffer.isBuffer(data));
    return this._update(data, data.length);
  }

  /**
   * Finalize SHA512 context.
   * @returns {Buffer}
   */

  final() {
    return this._final(Buffer.allocUnsafe(64));
  }

  /**
   * Update SHA512 context.
   * @private
   * @param {Buffer} data
   * @param {Number} len
   */

  _update(data, len) {
    let size = this.bytes & 0x7f;
    let pos = 0;

    this.bytes += len;

    if (size > 0) {
      let want = 128 - size;

      if (want > len)
        want = len;

      for (let i = 0; i < want; i++)
        this.block[size + i] = data[i];

      size += want;
      len -= want;
      pos += want;

      if (size < 128)
        return this;

      this.transform(this.block, 0);
    }

    while (len >= 128) {
      this.transform(data, pos);
      pos += 128;
      len -= 128;
    }

    for (let i = 0; i < len; i++)
      this.block[i] = data[pos + i];

    return this;
  }

  /**
   * Finalize SHA512 context.
   * @private
   * @param {Buffer} out
   * @returns {Buffer}
   */

  _final(out) {
    writeU32(DESC, this.bytes >>> 29, 0);
    writeU32(DESC, this.bytes << 3, 4);

    // 247 = (bs * 2 - 1) - 8
    this._update(PADDING, 1 + ((247 - (this.bytes % 128)) % 128));
    this._update(DESC, 8);

    for (let i = 0; i < 8; i++) {
      writeU32(out, this.s[i], i * 4);
      this.s[i] = 0;
    }

    return out;
  }

  /**
   * Prepare SHA512 block.
   * @param {Buffer} chunk
   * @param {Number} pos
   */

  prepare(chunk, pos) {
    const w = this.w;

    let i = 0;

    for (; i < 32; i++)
      w[i] = readU32(chunk, pos + i * 4);

    for (; i < w.length; i += 2) {
      const c0_hi = g1_512_hi(w[i - 4], w[i - 3]);  // i - 2
      const c0_lo = g1_512_lo(w[i - 4], w[i - 3]);
      const c1_hi = w[i - 14];  // i - 7
      const c1_lo = w[i - 13];
      const c2_hi = g0_512_hi(w[i - 30], w[i - 29]);  // i - 15
      const c2_lo = g0_512_lo(w[i - 30], w[i - 29]);
      const c3_hi = w[i - 32];  // i - 16
      const c3_lo = w[i - 31];

      w[i] = sum64_4_hi(
        c0_hi, c0_lo,
        c1_hi, c1_lo,
        c2_hi, c2_lo,
        c3_hi, c3_lo);

      w[i + 1] = sum64_4_lo(
        c0_hi, c0_lo,
        c1_hi, c1_lo,
        c2_hi, c2_lo,
        c3_hi, c3_lo);
    }

    return this;
  }

  /**
   * Transform SHA512 block.
   * @param {Buffer} chunk
   * @param {Number} pos
   */

  transform(chunk, pos) {
    this.prepare(chunk, pos);

    const W = this.W;

    let ah = this.s[0];
    let al = this.s[1];
    let bh = this.s[2];
    let bl = this.s[3];
    let ch = this.s[4];
    let cl = this.s[5];
    let dh = this.s[6];
    let dl = this.s[7];
    let eh = this.s[8];
    let el = this.s[9];
    let fh = this.s[10];
    let fl = this.s[11];
    let gh = this.s[12];
    let gl = this.s[13];
    let hh = this.s[14];
    let hl = this.s[15];

    for (let i = 0; i < W.length; i += 2) {
      let c0_hi = hh;
      let c0_lo = hl;
      let c1_hi = s1_512_hi(eh, el);
      let c1_lo = s1_512_lo(eh, el);

      const c2_hi = ch64_hi(eh, el, fh, fl, gh, gl);
      const c2_lo = ch64_lo(eh, el, fh, fl, gh, gl);
      const c3_hi = K[i];
      const c3_lo = K[i + 1];
      const c4_hi = W[i];
      const c4_lo = W[i + 1];

      const T1_hi = sum64_5_hi(
        c0_hi, c0_lo,
        c1_hi, c1_lo,
        c2_hi, c2_lo,
        c3_hi, c3_lo,
        c4_hi, c4_lo);
      const T1_lo = sum64_5_lo(
        c0_hi, c0_lo,
        c1_hi, c1_lo,
        c2_hi, c2_lo,
        c3_hi, c3_lo,
        c4_hi, c4_lo);

      c0_hi = s0_512_hi(ah, al);
      c0_lo = s0_512_lo(ah, al);
      c1_hi = maj64_hi(ah, al, bh, bl, ch, cl);
      c1_lo = maj64_lo(ah, al, bh, bl, ch, cl);

      const T2_hi = sum64_hi(c0_hi, c0_lo, c1_hi, c1_lo);
      const T2_lo = sum64_lo(c0_hi, c0_lo, c1_hi, c1_lo);

      hh = gh;
      hl = gl;

      gh = fh;
      gl = fl;

      fh = eh;
      fl = el;

      eh = sum64_hi(dh, dl, T1_hi, T1_lo);
      el = sum64_lo(dl, dl, T1_hi, T1_lo);

      dh = ch;
      dl = cl;

      ch = bh;
      cl = bl;

      bh = ah;
      bl = al;

      ah = sum64_hi(T1_hi, T1_lo, T2_hi, T2_lo);
      al = sum64_lo(T1_hi, T1_lo, T2_hi, T2_lo);
    }

    sum64(this.s, 0, ah, al);
    sum64(this.s, 2, bh, bl);
    sum64(this.s, 4, ch, cl);
    sum64(this.s, 6, dh, dl);
    sum64(this.s, 8, eh, el);
    sum64(this.s, 10, fh, fl);
    sum64(this.s, 12, gh, gl);
    sum64(this.s, 14, hh, hl);

    return this;
  }

  static hash() {
    return new SHA512();
  }

  static hmac() {
    return new HMAC(SHA512, 128);
  }

  static digest(data) {
    return ctx.init().update(data).final();
  }

  static root(left, right) {
    assert(Buffer.isBuffer(left) && left.length === 64);
    assert(Buffer.isBuffer(right) && right.length === 64);
    return ctx.init().update(left).update(right).final();
  }

  static mac(data, key) {
    return this.hmac().init(key).update(data).final();
  }
}

ctx = new SHA512();

/*
 * Helpers
 */

function sum64(buf, pos, ah, al) {
  const bh = buf[pos];
  const bl = buf[pos + 1];

  const lo = (al + bl) >>> 0;
  const hi = (lo < al ? 1 : 0) + ah + bh;
  buf[pos] = hi >>> 0;
  buf[pos + 1] = lo;
}

function sum64_hi(ah, al, bh, bl) {
  const lo = (al + bl) >>> 0;
  const hi = (lo < al ? 1 : 0) + ah + bh;
  return hi >>> 0;
}

function sum64_lo(ah, al, bh, bl) {
  const lo = al + bl;
  return lo >>> 0;
}

function sum64_4_hi(ah, al, bh, bl, ch, cl, dh, dl) {
  let carry = 0;
  let lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;

  const hi = ah + bh + ch + dh + carry;
  return hi >>> 0;
}

function sum64_4_lo(ah, al, bh, bl, ch, cl, dh, dl) {
  const lo = al + bl + cl + dl;
  return lo >>> 0;
}

function sum64_5_hi(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  let carry = 0;
  let lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;
  lo = (lo + el) >>> 0;
  carry += lo < el ? 1 : 0;

  const hi = ah + bh + ch + dh + eh + carry;
  return hi >>> 0;
}

function sum64_5_lo(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  const lo = al + bl + cl + dl + el;
  return lo >>> 0;
}

function rotr64_hi(ah, al, num) {
  const r = (al << (32 - num)) | (ah >>> num);
  return r >>> 0;
}

function rotr64_lo(ah, al, num) {
  const r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}

function shr64_hi(ah, al, num) {
  return ah >>> num;
}

function shr64_lo(ah, al, num) {
  const r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}

function ch64_hi(xh, xl, yh, yl, zh) {
  let r = (xh & yh) ^ ((~xh) & zh);

  if (r < 0)
    r += 0x100000000;

  return r;
}

function ch64_lo(xh, xl, yh, yl, zh, zl) {
  let r = (xl & yl) ^ ((~xl) & zl);

  if (r < 0)
    r += 0x100000000;

  return r;
}

function maj64_hi(xh, xl, yh, yl, zh) {
  let r = (xh & yh) ^ (xh & zh) ^ (yh & zh);

  if (r < 0)
    r += 0x100000000;

  return r;
}

function maj64_lo(xh, xl, yh, yl, zh, zl) {
  let r = (xl & yl) ^ (xl & zl) ^ (yl & zl);

  if (r < 0)
    r += 0x100000000;

  return r;
}

function s0_512_hi(xh, xl) {
  const c0_hi = rotr64_hi(xh, xl, 28);
  const c1_hi = rotr64_hi(xl, xh, 2);  // 34
  const c2_hi = rotr64_hi(xl, xh, 7);  // 39

  let r = c0_hi ^ c1_hi ^ c2_hi;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function s0_512_lo(xh, xl) {
  const c0_lo = rotr64_lo(xh, xl, 28);
  const c1_lo = rotr64_lo(xl, xh, 2);  // 34
  const c2_lo = rotr64_lo(xl, xh, 7);  // 39

  let r = c0_lo ^ c1_lo ^ c2_lo;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function s1_512_hi(xh, xl) {
  const c0_hi = rotr64_hi(xh, xl, 14);
  const c1_hi = rotr64_hi(xh, xl, 18);
  const c2_hi = rotr64_hi(xl, xh, 9);  // 41

  let r = c0_hi ^ c1_hi ^ c2_hi;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function s1_512_lo(xh, xl) {
  const c0_lo = rotr64_lo(xh, xl, 14);
  const c1_lo = rotr64_lo(xh, xl, 18);
  const c2_lo = rotr64_lo(xl, xh, 9);  // 41

  let r = c0_lo ^ c1_lo ^ c2_lo;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function g0_512_hi(xh, xl) {
  const c0_hi = rotr64_hi(xh, xl, 1);
  const c1_hi = rotr64_hi(xh, xl, 8);
  const c2_hi = shr64_hi(xh, xl, 7);

  let r = c0_hi ^ c1_hi ^ c2_hi;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function g0_512_lo(xh, xl) {
  const c0_lo = rotr64_lo(xh, xl, 1);
  const c1_lo = rotr64_lo(xh, xl, 8);
  const c2_lo = shr64_lo(xh, xl, 7);

  let r = c0_lo ^ c1_lo ^ c2_lo;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function g1_512_hi(xh, xl) {
  const c0_hi = rotr64_hi(xh, xl, 19);
  const c1_hi = rotr64_hi(xl, xh, 29);  // 61
  const c2_hi = shr64_hi(xh, xl, 6);

  let r = c0_hi ^ c1_hi ^ c2_hi;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function g1_512_lo(xh, xl) {
  const c0_lo = rotr64_lo(xh, xl, 19);
  const c1_lo = rotr64_lo(xl, xh, 29);  // 61
  const c2_lo = shr64_lo(xh, xl, 6);

  let r = c0_lo ^ c1_lo ^ c2_lo;

  if (r < 0)
    r += 0x100000000;

  return r;
}

function writeU32(buf, value, offset) {
  buf[offset] = value >>> 24;
  buf[offset + 1] = (value >> 16) & 0xff;
  buf[offset + 2] = (value >> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function readU32(buf, offset) {
  return ((buf[offset] & 0xff) * 0x1000000)
    + ((buf[offset + 1] & 0xff) << 16)
    | ((buf[offset + 2] & 0xff) << 8)
    | (buf[offset + 3] & 0xff);
}

/*
 * Expose
 */

module.exports = SHA512;