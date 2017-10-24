/*!
 * random.js - random for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 */

'use strict';

try {
  module.exports = require('./native/random');
} catch (e) {
  module.exports = require('./node/random');
}