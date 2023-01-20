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

## API
### candyget(url, returnType, options?, body?)

`candyget` will automatically infer the method type; if body is present, infer as `GET`, otherwise `POST`.  
If you want to specify the other method you can use:

### candyget(method, url, returnType, options?, body?)

Make http(s) request to the given url and return its result.  
* `url` can be a `string` or a `URL` object.
* `returnType` can be either of the followings:
  * `"string"` - `body` in the returned object will be a `string`.
  * `"buffer"` - `body` will be a `Buffer`.
  * `"stream"` - `body` will be a `Readable`.
  * `"json"` - `body` will be a parsed object. If failed to parse, `body` will be a `string`.
  * `"empty"` - Only do a request. `body` will be `null`. You can handle the response if necessary.
* `options` can be an object that can have the following properties:
  * `timeout` - Number to pass to `http.request`, represents the timeout in milliseconds.
  * `headers` - Object that presents HTTP headers. By default, `candyget` will pass `Accept`, `Accept-Encoding` and `User-Agent` (If you want to change, refer to the `defaultOptions` below).
  * `agent` - `http.Agent` to pass `http.request`.
  * `transformerOptions` - Optional parameters to pass to `PassThrough`, which will be used if you set the `returnType` to `stream`.
  * `maxRedirects` - `Number` that represents the redirect limit. If redirected more than the limit, candyget will return the HTTP redirect response as a resolved result. Default is `10`.
  * `body` - a `string` or a plain object (with nocyclic reference). You can pass the request body instead of the last argument.
  * `validator` - a `function` to validate if the response body has the expected type. See [below](#response-body-validation-for-typescript-users) for more info.
  
  > All these properties are optional in most cases.  
  > Passing `null` or `undefined` as `options` equals passing `{}`.  
* `body` can be a `string` or a plain object (with no cyclic reference). If `options.body` and `body` are passed at the same time, `body` will be used as a request body.

`candyget` returns a promise.
When no-http errors such as network errors occur, the promise will be rejected.

> **Warning**
> If you specify `options.validator` and candyget fails the validation of the response body, the promise will be rejected even if there is no no-http error.

Otherwise the promise will be resolved as an object, which has the following properties:
* `statusCode` - HTTP status code
* `headers` - [`IncomingHttpHeaders`](https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules__types_node_http_d_._http_.incominghttpheaders.html)
* `body` - response body, type of which is what you specified.
* `request` - [`http.ClientRequest`](https://nodejs.org/api/http.html#class-httpclientrequest)
* `response` - [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage)
* `url` - [`URL`](https://developer.mozilla.org/docs/Web/API/URL), which is the resolved url.

### candyget.defaultOptions

You can override this to change the default options (except a `body` property), which are used by candyget.

### Shorthand functions

#### By return types

You can use shorthand functions instead of passing the return type as a parameter.
```js
candyget(URL, "string");
// equals
candyget.string(URL);

candyget(URL, "json", OPTIONS, BODY);
// equals
candyget.json(URL, OPTIONS, BODY);
```
Note that you cannot specify a HTTP method if you use these shorthand functions. They always infer the HTTP method.

#### By HTTP methods

You can use shorthand functions instead of passing the http method as a parameter.

```js
candyget("GET", URL, RETURN_TYPE,  OPTIONS, BODY);
// equals
candyget.get(URL, RETURN_TYPE,  OPTIONS, BODY);

candyget("HEAD", URL, RETURN_TYPE,  OPTIONS, BODY);
// equals
candyget.head(URL, RETURN_TYPE,  OPTIONS, BODY);
```
Note that by using these shorthand functions TypeScript users can benefit in many ways by type checks. (For example, if you use `candyget.post` TypeScript throws an error unless you specify the request body)

## Response body validation (for TypeScript users)

If you specify `json` as the return type, you will get the body property in your result typed `any`.
Here if you specify `validator` property in the options, the response body will be typed correctly.

```ts
type resultType = {
  data:string,
}

const result = await candyget.get<resultType>("https://your.site/great/content", "json", {
  validator(responseBody): responseBody is resultType {
    return typeof responseBody.data === "string";
  },
});
console.log(result.body);
```

It's good you write your custom validation function with or without your favorite schema validator such as `ajv`, `zod` and so on in the `validator` option.  
Note that if you specify `validator` and candyget fails the validation of the response body, the promise will be rejected even if there is no no-http error.