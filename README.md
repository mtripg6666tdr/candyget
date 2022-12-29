# candyget
> This project is still in development phase.

candyget is a small sized http(s) client for Node.js

## Features

- Super small
- No dependency
- HTTP request by one line
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
const { body: json } = await candyget("https://httpbin.org/post", "json", null, {
  "foo": "bar",
});
// ready to read as a parsed object
console.log("result:", json);

// response can be streamed
const { body: stream } = await candyget("https://github.com/favicon.ico", "stream");
stream.pipe(require("fs").createWriteStream("github.ico"));

// Customize default options
candyget.defaultOptions.headers["Custom-Header"] = "foo";
```

## Install
```sh
npm i candyget
```

## API
`candyget` has only one exported function.

### candyget(url, returnType, options?, body?)

`candyget` will automatically infer the method type; if body is present, infer as `GET`, otherwise `POST`.  
If you want to specify the other method you can use:

### candyget(method, url, returnType, options?, body?)

Make http(s) request to the given url and return its result.  
* `url` can be a `string` or a `URL` object.
* `returnType` can be either of `"string"`, `"buffer"`, `"stream"` or `"json"`.
  * `"string"` - `body` in the returned object will be a `string`.
  * `"buffer"` - `body` will be a [`Buffer`](https://nodejs.org/api/buffer.html#class-buffer).
  * `"stream"` - `body` will be a [`Readable`](https://nodejs.org/api/stream.html#class-streamreadable).
  * `"json"` - `body` will be a parsed object. If failed to parse, `body` will be a `string`.
* `options` can be an object that can have the following properties:
  * `timeout` - Number to pass to `http.request`, represents the timeout in milliseconds.
  * `headers` - Object that presents HTTP headers. By default, `candyget` will pass `Accept`, `Accept-Encoding` and `User-Agent` (If you want to change this behavior, please refer to the `defaultOptions` below).
  * `agent` - `http.Agent` to pass `http.request`.
  * `transformerOptions` - Optional parameters to pass to `PassThrough`, which will be used if you set the `returnType` to `stream`.
  * `maxRedirects` - `Number` that represents the redirect limit. If redirected more than the limit, candyget will return the HTTP redirect response as a resolved result. Default is `10`.
  * All these properties are optional.
* `body` can be a `string` or a plain object (with no cyclic reference).

`candyget` returns promise. When no-http errors such as network errors occur, the promise will be rejected.  
The promise will be resolved as an object, which has the following properties:
* `statusCode` - [HTTP status code](https://developer.mozilla.org/docs/Web/HTTP/Status)
* `headers` - [`IncomingHttpHeaders`](https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules__types_node_http_d_._http_.incominghttpheaders.html)
* `body` - response body
* `request` - [`http.ClientRequest`](https://nodejs.org/api/http.html#class-httpclientrequest)
* `response` - [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)

### candyget.defaultOptions

The default options that are used by candyget. You can override this to change the defaults.

## License
[MIT](LICENSE)
