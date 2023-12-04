<div align="center">
  <img src="https://raw.githubusercontent.com/mtripg6666tdr/candyget/main/assets/candyget_logo.svg" alt="CandyGet">
  <br>
  <p>A tiny, candy :candy: sized HTTP(S) client for Node.js</p>
  <a href="https://www.npmjs.com/package/candyget"><img src="https://img.shields.io/npm/v/candyget" alt="npm"></a>
  <a href="https://packagephobia.com/result?p=candyget"><img src="https://badgen.net/packagephobia/install/candyget"></a>
  <a href="https://github.com/mtripg6666tdr/candyget/actions/workflows/ci.yml"><img src="https://github.com/mtripg6666tdr/candyget/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://app.codecov.io/github/mtripg6666tdr/candyget"><img alt="Coverage" src="https://img.shields.io/codecov/c/github/mtripg6666tdr/candyget"></a>
  <img alt="License" src="https://img.shields.io/npm/l/candyget">
</div>

---

- [Features](#features)
- [Usage](#usage)
- [API](#api)
  - [candyget(url, returnType, options?, body?)](#candygeturl-returntype-options-body)
  - [candyget(method, url, returnType, options?, body?)](#candygetmethod-url-returntype-options-body)
  - [candyget.defaultOptions](#candygetdefaultoptions)
  - [Shorthand functions](#shorthand-functions)
    - [By return types](#by-return-types)
    - [By HTTP methods](#by-http-methods)
- [For TypeScript users](#for-typescript-users)
  - [Response body validation](#response-body-validation)
  - [Note](#note)
- [License](#license)

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
### candyget(url, returnType, options?, body?)
### candyget(method, url, returnType, options?, body?)
Make HTTP(S) request to the specified URL and return the result.

When no method provided, candyget will automatically infer the method type; if body is present, it will infer as `POST`, otherwise `GET`.
* `url` can be a `string` or a `URL` object.
* `returnType` can be either of the followings:
  * `"string"` - `body` in the returned object will be a `string`.
  * `"buffer"` - `body` will be a `Buffer`.
  * `"stream"` - `body` will be a `Readable`.
  * `"json"` - `body` will be a parsed object. If failed to parse, `body` will be a `string`.
  * `"empty"` - Only make a request. `body` will be `null`. You cannot handle the response (since v0.4.0).
* `options` is an object that can have the following properties. All these properties are optional in most cases. Passing `null` or `undefined` as `options` equals passing `{}`.
  |Option|Default|Description|
  |------|-------|-----------|
  |`timeout`|`10000`|Number to pass to `http.request`, represents the timeout in milliseconds.|
  |`headers`|(See description)|Object that presents HTTP headers. HTTP headers set here and `defaultOptions.headers` will be merged and send in the request. (If same headers are present in both of them, the one in `options.headers` will be used.) By default, `candyget` will send `Accept`, `Accept-Language`, `Accept-Encoding` and `User-Agent` headers. If you want to change the default, refer to the defaultOptions below. |
  |`agent`||`http.Agent` to pass `http.request`.
  |`transformerOptions`|`{autoDestroy:true}`|Optional parameters to pass to `PassThrough`, which will be used if you set the `returnType` to `stream`.|
  |`maxRedirects`|`10`|`Number` that represents the redirect limit. If redirected more than the limit, candyget will return the HTTP redirect response as a resolved result.|
  |`body`||A `string`, `Buffer`, `Stream` or a plain object (with nocyclic reference). You can pass the request body instead of the last argument.|
  |`validator`||A `function` to validate if the response body has the expected type. See [below](#response-body-validation) for more info.|
  |`fetch`|`true`|A `boolean` or an `object` including the fetch API implementation used by candyget. If it is set to `true` and in Node.js (^16.15.0 with `--experimental-fetch` or >=17.5.0), candyget will use [the native `fetch` API](https://nodejs.org/dist/latest-v18.x/docs/api/globals.html#fetch). This can also be set to your custom `fetch` API implementation like below. Both `fetch` and `AbortController` are required. It is not allowed to pass only one of them.|
    ```js
    const fetch = require("your-favorite-fetch-lib");
    const AbortController = require("your-favorite-abortController-polyfill");
    const result = await candyget(METHOD, URL, RETURN_TYPE, {
      fetch: {
        fetch,
        AbortController,
      }
    });
    ```
    > **Note** Not all polyfills are supported and some polyfills will neglect working.
    > For instance, [`undici`](https://npm.im/undici) with [`abort-controller`](https://npm.im/abort-controller) won't work.
* `body` can be a `string`, `Buffer`, `Stream` or a plain object (with no cyclic reference). If `options.body` and `body` are passed at the same time, `body` will be used as a request body.

`candyget` returns a promise.
If a non-HTTP error (e.g., a network error) occurs, the promise will be rejected.

> **Warning**
> If you specify `options.validator` and `candyget` fails to validate the response body, the promise will be rejected, even if there is no non-HTTP error.

Otherwise the promise will be resolved as an object, which has the following properties.
  |Property Name|Description|
  |-------------|-----------|
  |`statusCode`|HTTP status code of the response.|
  |`headers`|[`IncomingHttpHeaders`](https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules__types_node_http_d_._http_.incominghttpheaders.html), the response headers.|
  |`body`|The response body, type of which is what you specified.|
  |`request`(*deprecated*)|If candyget used `http`/`https` module, this will be [`http.ClientRequest`](https://nodejs.org/api/http.html#class-httpclientrequest). On the other hand if `fetch` module or `fetch`-like module, this will be `null`.|
  |`response`(*deprecated*)|If candyget used `http`/`https` module, this will be [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage). On the other hand if `fetch` module or `fetch`-like module, this will be the `Response` object.|
  |`url`|[`URL`](https://developer.mozilla.org/docs/Web/API/URL), which is the resolved url.|

### candyget.defaultOptions

The default options (excluding the `body` property), which are used by candyget.
It is possible to change candyget's default options globally by overriding it.

### Shorthand functions

#### By return types

Instead of passing the return type as a parameter, you can use shorthand functions.
```js
candyget(URL, "string");
// equals
candyget.string(URL);

candyget(URL, "json", OPTIONS, BODY);
// equals
candyget.json(URL, OPTIONS, BODY);
```
Please note that you cannot specify a HTTP method when using these shorthand functions. They automatically infer the correct HTTP method.

#### By HTTP methods

You can use shorthand functions instead of passing the HTTP method as a parameter.
```js
candyget("GET", URL, RETURN_TYPE, OPTIONS, BODY);
// equals
candyget.get(URL, RETURN_TYPE, OPTIONS, BODY);

candyget("HEAD", URL, "empty", OPTIONS);
// equals
candyget.head(URL, OPTIONS);
```
By using these shorthand functions, TypeScript users can benefit in many ways by type checks. (For example, if you use `candyget.post`, TypeScript will throw an error unless you specify the request body)

## For TypeScript users
### Response body validation

When you specify `json` as the return type, the `body` property in the result will be typed as `any`. However, if you include a `validator` property in the options, the response body will be correctly typed.

```ts
type resultType = {
  data: string,
}

const result = await candyget.get<resultType>("https://your.site/great/content", "json", {
  validator(responseBody): responseBody is resultType {
    return typeof responseBody.data === "string";
  },
});
console.log(result.body);
```

It is beneficial to write your custom validation function, with or without using a schema validator such as ajv or zod, in the validator option. 
Please note that if you specify a validator and the response body fails validation, the promise will be rejected even if there is no HTTP error.

### Note
Due to complex overloads, TypeScript may mark some errors at a different location than the actual incorrect location. In this situation, ensure that your parameters are passed correctly, for example, by avoiding duplicated request bodies or by correctly ordering the parameters. However, if you believe that it could be a bug, feel free to create a new issue.

## License
[MIT](LICENSE)
