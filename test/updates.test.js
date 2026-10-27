const test = require('node:test');
const assert = require('node:assert');
const { imageDe, typeImage } = require('../src/main/updates');

test('imageDe : une ligne qui n’est qu’une image https', () => {
  assert.equal(imageDe('![](https://github.com/x/y/releases/download/v1/nouveaute.gif)'), 'https://github.com/x/y/releases/download/v1/nouveaute.gif');
  assert.equal(imageDe('<img width="640" src="https://exemple.fr/a.png" />'), 'https://exemple.fr/a.png');
  assert.equal(imageDe('![](http://exemple.fr/a.gif)'), null);
  assert.equal(imageDe('- Une puce avec ![](https://exemple.fr/a.gif) dedans'), null);
});

test('typeImage : le format se lit dans les premiers octets', () => {
  assert.equal(typeImage(Buffer.from('GIF89a……')), 'image/gif');
  assert.equal(typeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])), 'image/png');
  assert.equal(typeImage(Buffer.from('<html>')), null);
});
