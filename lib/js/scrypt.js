/*!
 * scrypt.js - scrypt for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 *
 * Ported from:
 * https://github.com/Tarsnap/scrypt/blob/master/lib/crypto/crypto_scrypt-ref.c
 *
 * Copyright 2009 Colin Percival
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

/* eslint camelcase: "off" */

'use strict';

const assert = require('assert');
const pbkdf2 = require('../pbkdf2');
const SHA256 = require('../sha256');

/*
 * Constants
 */

const B32 = new Uint32Array(16);
const X = new Uint32Array(16);

/**
 * Javascript scrypt implementation. Scrypt is
 * used in bip38. Bcoin doesn't support bip38
 * yet, but here it is, just in case.
 * @alias module:crypto/scrypt.derive
 * @param {Buffer} passwd
 * @param {Buffer} salt
 * @param {Number} N
 * @param {Number} r
 * @param {Number} p
 * @param {Number} len
 * @returns {Buffer}
 */

function derive(passwd, salt, N, r, p, len) {
  assert(Buffer.isBuffer(passwd));
  assert(Buffer.isBuffer(salt));
  assert((N >>> 0) === N);
  assert((r >>> 0) === r);
  assert((p >>> 0) === p);
  assert((len >>> 0) === len);

  if (r * p >= (1 << 30))
    throw new Error('EFBIG');

  if ((N & (N - 1)) !== 0 || N === 0)
    throw new Error('EINVAL');

  if (N > 0xffffffff)
    throw new Error('EINVAL');

  const XY = Buffer.allocUnsafe(256 * r);
  const V = Buffer.allocUnsafe(128 * r * N);

  const B = pbkdf2.derive(SHA256, passwd, salt, 1, p * 128 * r);

  for (let i = 0; i < p; i++)
    smix(B, i * 128 * r, r, N, V, XY);

  return pbkdf2.derive(SHA256, passwd, B, 1, len);
}

/**
 * Asynchronous scrypt implementation.
 * @alias module:crypto/scrypt.deriveAsync
 * @function
 * @param {Buffer} passwd
 * @param {Buffer} salt
 * @param {Number} N
 * @param {Number} r
 * @param {Number} p
 * @param {Number} len
 * @returns {Promise}
 */

async function deriveAsync(passwd, salt, N, r, p, len) {
  assert(Buffer.isBuffer(passwd));
  assert(Buffer.isBuffer(salt));
  assert((N >>> 0) === N);
  assert((r >>> 0) === r);
  assert((p >>> 0) === p);
  assert((len >>> 0) === len);

  if (r * p >= (1 << 30))
    throw new Error('EFBIG');

  if ((N & (N - 1)) !== 0 || N === 0)
    throw new Error('EINVAL');

  if (N > 0xffffffff)
    throw new Error('EINVAL');

  const XY = Buffer.allocUnsafe(256 * r);
  const V = Buffer.allocUnsafe(128 * r * N);

  const B = await pbkdf2.deriveAsync(SHA256, passwd, salt, 1, p * 128 * r);

  for (let i = 0; i < p; i++)
    await smixAsync(B, i * 128 * r, r, N, V, XY);

  return await pbkdf2.deriveAsync(SHA256, passwd, B, 1, len);
}

/*
 * Helpers
 */

function salsa20_8(B) {
  for (let i = 0; i < 16; i++)
    B32[i] = B.readUInt32LE(i * 4, true);

  for (let i = 0; i < 16; i++)
    X[i] = B32[i];

  for (let i = 0; i < 8; i += 2) {
    X[4] ^= R(X[0] + X[12], 7);
    X[8] ^= R(X[4] + X[0], 9);
    X[12] ^= R(X[8] + X[4], 13);
    X[0] ^= R(X[12] + X[8], 18);

    X[9] ^= R(X[5] + X[1], 7);
    X[13] ^= R(X[9] + X[5], 9);
    X[1] ^= R(X[13] + X[9], 13);
    X[5] ^= R(X[1] + X[13], 18);

    X[14] ^= R(X[10] + X[6], 7);
    X[2] ^= R(X[14] + X[10], 9);
    X[6] ^= R(X[2] + X[14], 13);
    X[10] ^= R(X[6] + X[2], 18);

    X[3] ^= R(X[15] + X[11], 7);
    X[7] ^= R(X[3] + X[15], 9);
    X[11] ^= R(X[7] + X[3], 13);
    X[15] ^= R(X[11] + X[7], 18);

    X[1] ^= R(X[0] + X[3], 7);
    X[2] ^= R(X[1] + X[0], 9);
    X[3] ^= R(X[2] + X[1], 13);
    X[0] ^= R(X[3] + X[2], 18);

    X[6] ^= R(X[5] + X[4], 7);
    X[7] ^= R(X[6] + X[5], 9);
    X[4] ^= R(X[7] + X[6], 13);
    X[5] ^= R(X[4] + X[7], 18);

    X[11] ^= R(X[10] + X[9], 7);
    X[8] ^= R(X[11] + X[10], 9);
    X[9] ^= R(X[8] + X[11], 13);
    X[10] ^= R(X[9] + X[8], 18);

    X[12] ^= R(X[15] + X[14], 7);
    X[13] ^= R(X[12] + X[15], 9);
    X[14] ^= R(X[13] + X[12], 13);
    X[15] ^= R(X[14] + X[13], 18);
  }

  for (let i = 0; i < 16; i++)
    B32[i] += X[i];

  for (let i = 0; i < 16; i++)
    B.writeUInt32LE(B32[i], 4 * i, true);
}

function R(a, b) {
  return (a << b) | (a >>> (32 - b));
}

function blockmix_salsa8(B, Y, Yo, r) {
  const X = Buffer.allocUnsafe(64);

  blkcpy(X, B, 0, (2 * r - 1) * 64, 64);

  for (let i = 0; i < 2 * r; i++) {
    blkxor(X, B, 0, i * 64, 64);
    salsa20_8(X);
    blkcpy(Y, X, Yo + i * 64, 0, 64);
  }

  for (let i = 0; i < r; i++)
    blkcpy(B, Y, i * 64, Yo + (i * 2) * 64, 64);

  for (let i = 0; i < r; i++)
    blkcpy(B, Y, (i + r) * 64, Yo + (i * 2 + 1) * 64, 64);
}

function integerify(B, r) {
  return B.readUInt32LE((2 * r - 1) * 64, true);
}

function smix(B, Bo, r, N, V, XY) {
  const X = XY;
  const Y = XY;

  blkcpy(X, B, 0, Bo, 128 * r);

  for (let i = 0; i < N; i++) {
    blkcpy(V, X, i * (128 * r), 0, 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
  }

  for (let i = 0; i < N; i++) {
    const j = integerify(X, r) & (N - 1);
    blkxor(X, V, 0, j * (128 * r), 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
  }

  blkcpy(B, X, Bo, 0, 128 * r);
}

async function smixAsync(B, Bo, r, N, V, XY) {
  const X = XY;
  const Y = XY;

  blkcpy(X, B, 0, Bo, 128 * r);

  for (let i = 0; i < N; i++) {
    blkcpy(V, X, i * (128 * r), 0, 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
    await wait();
  }

  for (let i = 0; i < N; i++) {
    const j = integerify(X, r) & (N - 1);
    blkxor(X, V, 0, j * (128 * r), 128 * r);
    blockmix_salsa8(X, Y, 128 * r, r);
    await wait();
  }

  blkcpy(B, X, Bo, 0, 128 * r);
}

function blkcpy(dest, src, s1, s2, len) {
  src.copy(dest, s1, s2, s2 + len);
}

function blkxor(dest, src, s1, s2, len) {
  for (let i = 0; i < len; i++)
    dest[s1 + i] ^= src[s2 + i];
}

function wait() {
  return new Promise(r => setImmediate(r));
}

/*
 * Expose
 */

exports.derive = derive;
exports.deriveAsync = deriveAsync;
