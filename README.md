# candyget
[![npm](https://img.shields.io/npm/v/candyget)](https://www.npmjs.com/package/candyget)
![npm bundle size](https://img.shields.io/bundlephobia/min/candyget)

> **Warning**
> This project is still in a development phase.

candyget is a small sized HTTP(S) client for Node.js

## Features

- Super small
- No dependency
- HTTP request by one line
- Promise based
- Infer HTTP method automatically
- Stringify/parse JSON automatically
- Decompress gzip/brotli/deflate automatically
- Handle redirects
- User selectable response type
- Full TypeScript Support

## Usage
```js
const candyget = require("candyget");

// simply get 
const { statusCode, body } = await candyget("https://example.com", "string");
// or simply: candyget.string("https://example.com");

// simply post
const { body: json } = await candyget("https://your.site/", "json", null, {
  foo: "bar",
});

// response can be streamed
const { body: stream } = await candyget("https://foo.bar/bin", "stream");
stream.pipe(require("fs").createWriteStream("foo.bin"));

// Customize default options
candyget.defaultOptions.headers["Custom-Header"] = "foo";
```

## API
API documentation is separated from README so that the npm bundle size gets smaller.
See [API documentation site]().

## License
[MIT](LICENSE)
