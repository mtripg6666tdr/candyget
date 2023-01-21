import type { IncomingHttpHeaders, Agent, ClientRequest, IncomingMessage } from "http";
import type { Readable, TransformOptions } from "stream";

// Import these module by `require` instead of `import` in order to prevent from generating helper methods.
const requireLocal = require;
const http = requireLocal("http") as typeof import("http");
const https = requireLocal("https") as typeof import("https");
const { PassThrough, pipeline, Stream } = requireLocal("stream") as typeof import("stream");
const zlib = requireLocal("zlib") as typeof import("zlib");

/**
 * Represents options of candyget
 */
type Opts = {
  /**
   * timeout ms
   */
  timeout?:number,
  /**
   * request headers
   */
  headers?:{[key:string]:string},
  /**
   * agent used by http.request
   */
  agent?:Agent,
  /**
   * options to pass to node Transform stream if return type is stream
   */
  transformerOptions?:TransformOptions,
  /**
   * represents max number of redirects that candyget handles
   */
  maxRedirects?:number,
  /**
   * Request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?:any,
};

/**
 * Options with the validator property
 */
type TypedOpts<T> = Opts & {
  /**
   * Specifies validator
   * @param responseBody the response body 
   * @returns represents if the response body is correct
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validator:(responseBody:any) => responseBody is T,
};

/**
 * Options except the body property
 */
type OmitBody<V extends Opts> = Omit<V, "body">;

/**
 * Options requiring the request body
 */
type RequireBody<V extends Opts> = OmitBody<V> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
};

/**
 * Represents candyget's return types, with typed body
 */
type BodyTypes = {
  /**
   * Requested resource will be return as string
   */
  string: string,
  /**
   * Requested resource will be return as buffer
   */
  buffer: Buffer,
  /**
   * Requested resource will be return as Readable stream
   */
  stream: Readable,
  /**
   * Requested resource will be return as parsed JSON. if failed to parse, return as string;
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: string|any,
  /**
   * Only do a request. Response will not be parsed. You can handle the response if necessary
   */
  empty: null,
};

/**
 * Represents candyget's return types, with typed body
 */
type TypedBodyTypes<U> = Omit<BodyTypes, "json"> & {
  json: U,
};

const BodyTypesSet = ["string", "buffer", "stream", "json", "empty"] as const;
type HttpMethods = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"OPTIONS"|"TRACE"|"PATCH";
const HttpMethodsSet = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PATCH"] as const;
type Url = string|URL;
// eslint-disable-next-line @typescript-eslint/ban-types
type EmptyObject = {};
const HttpLibs = {
  "http:": http,
  "https:": https,
} as const;
const redirectStatuses:Readonly<number[]> = [301, 302, 303, 307, 308];
const CONTENT_TYPE = "content-type";
const objectAlias = Object;
const bufferAlias = Buffer;
const jsonAlias = JSON;

/**
 * Represents errors emitted manually in candyget
 */
class CandyGetError extends Error {
  constructor(message?:string){
    super(message);
    this.name = "CandyGetError";
  }
}
const genInvalidParamMessage = (name:string) => `Invalid Param:${name}`;
const genError = (message:string) => new CandyGetError(message);
const genRejectedPromise = (message:string) => Promise.reject(genError(message));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isString = ((target:any) => typeof target == "string") as (target:any) => target is string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObjectType = (<T extends abstract new (...args: any) => any>(target:any, type:T) => target instanceof type) as <T extends abstract new (...args: any) => any>(target:any, type:T) => target is InstanceType<T>;
const noop = () => {/* empty */};
const createEmpty = () => objectAlias.create(null) as EmptyObject;
const destroy = (...destroyable:{destroyed?:boolean, destroy:()=>void}[]) => destroyable.map(stream => {
  if(!stream.destroyed) stream.destroy();
});

/**
 * Represents candyget's result type.
 */
type CGResult<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:ClientRequest,
  response:IncomingMessage,
  url:URL,
};

/**
 * Represents candyget's result type, with typed body.
 */
type CGTypedResult<T extends keyof TypedBodyTypes<U>, U> = Omit<CGResult<T>, "body"> & {
  body: TypedBodyTypes<U>[T];
};

type CGExport = typeof candyget & {
  /**
   * Default options used in candyget, which can be overwritten by the argument of candyget
   */
  defaultOptions:Omit<Opts, "body"|"validator">,
  /**
   * Shorthand of candyget(url, "string")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  string(url:Url, options?:Opts|null):Promise<CGResult<"string">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  string(url:Url, options?:OmitBody<Opts>, body?:any):Promise<CGResult<"string">>,
  /**
   * Shorthand of candyget(url, "buffer")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  buffer(url:Url, options?:Opts|null):Promise<CGResult<"buffer">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buffer(url:Url, options?:OmitBody<Opts>, body?:any):Promise<CGResult<"buffer">>,
  /**
   * Shorthand of candyget(url, "stream")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  stream(url:Url, options?:Opts|null):Promise<CGResult<"stream">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream(url:Url, options?:OmitBody<Opts>, body?:any):Promise<CGResult<"stream">>,
  /**
   * Shorthand of candyget(url, "json")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  json<U>(url:Url, options:TypedOpts<U>):Promise<CGTypedResult<"json", U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<U>(url:Url, options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<"json", U>>,
  json(url:Url, options?:Opts|null):Promise<CGResult<"json">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(url:Url, options?:OmitBody<Opts>, body?:any):Promise<CGResult<"json">>,
  /**
   * Shorthand of candyget(url, "emtpy")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  empty(url:Url, options?:Opts|null):Promise<CGResult<"empty">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empty(url:Url, options?:OmitBody<Opts>, body?:any):Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("GET", url, returnType, options)
   * no request body and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  get<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>):Promise<CGTypedResult<"json", U>>,
  get<T extends keyof BodyTypes>(url:Url, returnType:T, options?:OmitBody<Opts>|null):Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("HEAD", url, "empty", options)
   * no request body or response body
   * @param url URL
   * @param options the request options
   */
  head(url:Url, options?:OmitBody<Opts>):Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("POST", url, returnType, options, body)
   * request body is required and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  post<U>(url:Url, returnType:"json", options:RequireBody<TypedOpts<U>>):Promise<CGTypedResult<"json", U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body:any):Promise<CGTypedResult<"json", U>>,
  post<T extends keyof BodyTypes>(url:Url, returnType:T, options:RequireBody<Opts>):Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T extends keyof BodyTypes>(url:Url, returnType:T, options:OmitBody<Opts>|null, body:any):Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("PUT", url, "empty", options, body)
   * request has a body and no response body
   * @param url URL
   * @param options the request options
   * @param body the request body
   */
  put(url:Url, options:RequireBody<Opts>):Promise<CGResult<"empty">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(url:Url, options:OmitBody<Opts>|null, body:any):Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("DELETE", url, returnType, options, body)
   * request body and response body are optional
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  delete<U>(url:Url, returnType:"json", options:TypedOpts<U>):Promise<CGTypedResult<"json", U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<"json", U>>,
  delete<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null):Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<T extends keyof BodyTypes>(url:Url, returnType:T, options?:OmitBody<Opts>|null, body?:any):Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("OPTIONS", url, returnType, options)
   * no request body and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  options<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>):Promise<CGTypedResult<"json", U>>,
  options<T extends keyof BodyTypes>(url:Url, returnType:T, options?:OmitBody<Opts>|null):Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("TRACE", url, "empty", options)
   * no request body or response body
   * @param url URL
   * @param options the request options
   */
  trace(url:Url, options?:OmitBody<Opts>|null):Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("PATCH", url, returnType, options, body)
   * request body is required, response has a body.
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  patch<U>(url:Url, returnType:"json", options:RequireBody<TypedOpts<U>>):Promise<CGTypedResult<"json", U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body:any):Promise<CGTypedResult<"json", U>>,
  patch<T extends keyof BodyTypes>(url:Url, returnType:T, options:RequireBody<Opts>):Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T extends keyof BodyTypes>(url:Url, returnType:T, options:OmitBody<Opts>|null, body:any):Promise<CGResult<T>>,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<U>(url:Url, returnType:"json", options?:TypedOpts<U>, body?:any):Promise<CGTypedResult<"json", U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null, body?:any):Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<U>(method:HttpMethods, url:Url, returnType:"json", options?:TypedOpts<U>, body?:any):Promise<CGTypedResult<"json", U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(method:HttpMethods, url:Url, returnType:T, options?:Opts|null, body?:any):Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes, U>(urlOrMethod:Url|HttpMethods, returnTypeOrUrl:T|Url, optionsOrReturnType?:TypedOpts<U>|Opts|null|T, bodyOrOptions?:any|TypedOpts<U>|Opts|null, rawBody?:any):Promise<CGResult<T>>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let method:HttpMethods, url:URL, returnType:T, overrideOptions:Opts|TypedOpts<U>, body:any|null;
  try{
    const objurl = new URL(urlOrMethod);
    // (url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):ReturnTypes[T];
    url = objurl;
    returnType = returnTypeOrUrl as T;
    overrideOptions = optionsOrReturnType as TypedOpts<U>|Opts || {};
    body = bodyOrOptions || overrideOptions.body as Body|null;
    // determine method automatically
    method = body ? "POST" : "GET";
  }
  catch{
    if(!isString(urlOrMethod)) return genRejectedPromise(genInvalidParamMessage("url"));
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = urlOrMethod.toUpperCase() as HttpMethods;
    url = isString(returnTypeOrUrl) ? new URL(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as TypedOpts<U>|Opts || {};
    body = rawBody || overrideOptions.body || null;
  }
  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) return genRejectedPromise(genInvalidParamMessage("method"));
  if(!BodyTypesSet.includes(returnType)) return genRejectedPromise(genInvalidParamMessage("returnType"));
  if(typeof overrideOptions != "object") return genRejectedPromise(genInvalidParamMessage("options"));
  if(!isObjectType(url, URL)) return genRejectedPromise(genInvalidParamMessage("url"));
  // prepare optiosn
  const options = objectAlias.assign(createEmpty(), (candyget as CGExport).defaultOptions, overrideOptions);
  const headers = objectAlias.assign(createEmpty(), (candyget as CGExport).defaultOptions.headers, overrideOptions.headers);
  // once clear headers
  options.headers = createEmpty();
  // assign headers with keys in lower case
  objectAlias.keys(headers).map(key => options.headers![key.toLowerCase()] = headers[key]);
  // if json was passed and content-type is not set, set automatically
  if(!isString(body) && !isObjectType(body, bufferAlias) && !isObjectType(body, Stream) && !options.headers[CONTENT_TYPE]){
    options.headers[CONTENT_TYPE] = "application/json";
  }
  if(typeof options.timeout != "number" || options.timeout < 1 || isNaN(options.timeout)) return genRejectedPromise(genInvalidParamMessage("timeout"));
  if(typeof options.maxRedirects != "number" || options.maxRedirects < 0 || isNaN(options.maxRedirects)) return genRejectedPromise(genInvalidParamMessage("maxRedirects"));
  // execute request
  let redirectCount = 0;
  // store the original url
  const originalUrl = url;
  const executeRequest = (requestUrl:URL) => {
    // delete credentials to prevent from leaking credentials
    if(redirectCount > 0 && originalUrl.host !== requestUrl.host){
      delete options.headers!["cookie"];
      delete options.headers!["authorization"];
    }
    return new Promise<CGResult<T>>((resolve, reject) => {
      const req = HttpLibs[requestUrl.protocol as keyof typeof HttpLibs]?.request(requestUrl, {
        method: method,
        headers: options.headers,
        timeout: options.timeout,
        agent: options.agent,
      }, (res) => {
        const statusCode = res.statusCode!;
        if(redirectCount < options.maxRedirects! && redirectStatuses.includes(statusCode)){
          const redirectTo = res.headers.location;
          if(isString(redirectTo)){
            redirectCount++;
            setImmediate(() => resolve(executeRequest(new URL(redirectTo, requestUrl))));
            destroy(req, res);
            return;
          }else{
            reject(genError("no location header found"));
          }
        }
        const partialResult = {
          headers: res.headers,
          statusCode,
          request: req,
          response: res,
          url: requestUrl,
        };
        if(returnType == "empty"){
          resolve({
            body: null as unknown as BodyTypes[T],
            ...partialResult,
          });
        }
        const pipelineFragment:Readable[] = [res];
        const contentEncoding = res.headers["content-encoding"]?.toLowerCase();
        if(contentEncoding == "gzip"){
          pipelineFragment.push(zlib.createGunzip());
        }else if(contentEncoding == "br"){
          pipelineFragment.push(zlib.createBrotliDecompress());
        }else if(contentEncoding == "deflate"){
          pipelineFragment.push(zlib.createInflate());
        }
        if(returnType == "stream"){
          const stream = new PassThrough(options.transformerOptions);
          stream.once("close", () => {
            destroy(req, res);
          });
          pipelineFragment.push(stream);
          pipeline(pipelineFragment, noop);
          resolve({
            body: stream as unknown as BodyTypes[T],
            ...partialResult,
          });
        }else{
          let bufs:Buffer[]|null = [];
          (pipelineFragment.length == 1 ? pipelineFragment[0] : pipeline(pipelineFragment, noop))
            .on("data", buf => bufs!.push(buf))
            .on("end", () => {
              destroy(req, res);
              const result = bufferAlias.concat(bufs!) as unknown as BodyTypes[T];
              const rawBody = (returnType == "buffer" ? result : result.toString()) as unknown as BodyTypes[T];
              let body = rawBody;
              if(returnType == "json"){
                if("validator" in options && typeof options.validator === "function"){
                  body = jsonAlias.parse(body);
                  if(!options.validator(body)) reject(genError("invalid response body"));
                }else{
                  try{
                    body = jsonAlias.parse(body);
                  }
                  catch{/* empty */}
                }
              }
              resolve({
                body,
                ...partialResult
              });
              bufs = null;
            })
            .on("error", reject)
          ;
        }
      })
        ?.on("error", reject)
        ?.on("timeout", () => reject(genError("timed out")))
      ;
      if(!req) reject(genError(genInvalidParamMessage("url")));
      if(body && isObjectType(body, Stream)){
        body
          .on("error", reject)
          .pipe(req);
      }else{
        req.end(
          !body
          ? undefined
          : isString(body) || isObjectType(body, bufferAlias)
          ? body
          : jsonAlias.stringify(body)
        );
      }
    });
  };
  return executeRequest(url);
}

// setup shorthand functions
const candygetType = candyget as CGExport;
BodyTypesSet.map(<T extends keyof BodyTypes>(type:T) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candygetType[type] = <T extends keyof BodyTypes> (url:Url, options?:Opts, body?:any) => {
      return candyget(url, type, options, body) as unknown as Promise<CGResult<T>>;
  };
});
candygetType.get = <T extends keyof BodyTypes, U>(url:Url, returnType:T, options?:TypedOpts<U>|Opts) => candyget(url, returnType, options);
candygetType.head = (url:Url, options?:Opts) => candyget("HEAD", url, "empty", options);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
candygetType.post = <T extends keyof BodyTypes, U>(url:Url, returnType:T, options:TypedOpts<U>|Opts, body?:any) => candyget("POST", url, returnType, options, body);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
candygetType.put = (url:Url, options:Opts, body?:any) => candyget("PUT", url, "empty", options, body);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
candygetType.delete = <T extends keyof BodyTypes, U>(url:Url, returnType:T, options?:TypedOpts<U>|Opts, body?:any) => candyget("DELETE", url, returnType, options, body);
candygetType.options = <T extends keyof BodyTypes, U>(url:Url, returnType:T, options?:TypedOpts<U>|Opts) => candyget("OPTIONS", url, returnType, options);
candygetType.trace = (url:Url, options?:Opts) => candyget("TRACE", url, "empty", options);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
candygetType.patch = <T extends keyof BodyTypes, U>(url:Url, returnType:T, options:TypedOpts<U>|Opts, body?:any) => candyget("PATCH", url, returnType, options, body);

candygetType.defaultOptions = {
  timeout: 10000,
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
  } as {[key:string]:string},
  maxRedirects: 10,
  transformerOptions: {
    autoDestroy: true,
  }
};

export = objectAlias.freeze(candyget) as CGExport;
