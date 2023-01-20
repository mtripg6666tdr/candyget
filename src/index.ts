import type { IncomingHttpHeaders, Agent, ClientRequest, IncomingMessage } from "http";
import type { Readable, TransformOptions } from "stream";

// Import these module by `require` instead of `import` in order to prevent from generating helper methods.
const requireLocal = require;
const http = requireLocal("http") as typeof import("http");
const https = requireLocal("https") as typeof import("https");
const { PassThrough, pipeline } = requireLocal("stream") as typeof import("stream");
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

interface BodyTypes {
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
}

const BodyTypesSet:Readonly<(keyof BodyTypes)[]> = ["string", "buffer", "stream", "json", "empty"];
type HttpMethods = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"OPTIONS"|"TRACE"|"PATCH";
const HttpMethodsSet:Readonly<HttpMethods[]> = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PATCH"];
type Url = string|URL;
// eslint-disable-next-line @typescript-eslint/ban-types
type EmptyObject = {};
const HttpLibs = {
  "http:": http,
  "https:": https,
} as const;
const redirectStatuses:Readonly<number[]> = [301, 302, 303, 307, 308];
const CONTENT_TYPE = "content-type";

/**
 * Represents errors emitted manually in candyget
 */
class CandyGetError extends Error {}
const genInvalidParamMessage = (name:string) => `Invalid Param:${name}`;
const genError = (message:string) => new CandyGetError(message);
const genRejectedPromise = (message:string) => Promise.reject(genError(message));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isString = ((target:any) => typeof target == "string") as (target:any)=>target is string;
const noop = () => {/* empty */};
const createEmpty = () => Object.create(null) as EmptyObject;
const destroy = (...destroyable:{destroyed:boolean, destroy:()=>void}[]) => destroyable.map(stream => {
  if(!stream.destroyed) stream.destroy();
});

/**
 * Represents candyget's result type.
 */
type CGPromiseInner<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:ClientRequest,
  response:IncomingMessage,
  url:URL,
};
/**
 * Represents the promise that will be resolved as candyget's result type.
 */
type CGReturn<T extends keyof BodyTypes> = Promise<CGPromiseInner<T>>;
type CGExport = typeof candyget & {
  /**
   * Default options used in candyget, which can be overwritten by the argument of candyget
   */
  defaultOptions:Omit<Opts, "body">,
  /**
   * Shorthand of candyget(url, "string")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  string(url:Url, options?:Opts|null, body?:any):CGReturn<"string">,
  /**
   * Shorthand of candyget(url, "buffer")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buffer(url:Url, options?:Opts|null, body?:any):CGReturn<"buffer">,
  /**
   * Shorthand of candyget(url, "stream")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream(url:Url, options?:Opts|null, body?:any):CGReturn<"stream">,
  /**
   * Shorthand of candyget(url, "json")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(url:Url, options?:Opts|null, body?:any):CGReturn<"json">,
  /**
   * Shorthand of candyget(url, "emtpy")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empty(url:Url, options?:Opts|null, body?:any):CGReturn<"empty">,
  /**
   * Shorthand of candyget("GET", url, returnType, options)
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  get<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null): CGReturn<T>,
  /**
   * Shorthand of candyget("HEAD", url, "empty", options)
   * @param url URL
   * @param options the request options
   */
  head(url:Url, options?:Opts):CGReturn<"empty">,
  /**
   * Shorthand of candyget("POST", url, returnType, options, body)
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T extends keyof BodyTypes>(url:Url, returnType:T, options:Opts|null, body:any):CGReturn<T>,
  /**
   * Shorthand of candyget("PUT", url, "empty", options, body)
   * @param url URL
   * @param options the request options
   * @param body the request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(url:Url, options:Opts|null, body:any):CGReturn<"empty">,
  /**
   * Shorthand of candyget("DELETE", url, returnType, options, body)
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null, body?:any):CGReturn<T>,
  /**
   * Shorthand of candyget("OPTIONS", url, returnType, options)
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  options<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null):CGReturn<T>,
  /**
   * Shorthand of candyget("TRACE", url, "empty", options)
   * @param url URL
   * @param options the request options
   */
  trace(url:Url, options?:Opts|null):CGReturn<"empty">,
  /**
   * Shorthand of candyget("PATCH", url, returnType, options, body)
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T extends keyof BodyTypes>(url:Url, returnType:T, options:Opts|null, body:any):CGReturn<T>,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null, body?:any):CGReturn<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(method:HttpMethods, url:Url, returnType:T, options?:Opts|null, body?:any):CGReturn<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(urlOrMethod:Url|HttpMethods, returnTypeOrUrl:T|Url, optionsOrReturnType?:Opts|null|T, bodyOrOptions?:any|Opts|null, rawBody?:any):CGReturn<T>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let method:HttpMethods, url:URL, returnType:T, overrideOptions:Opts, body:any|null;
  try{
    const objurl = new URL(urlOrMethod);
    // (url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):ReturnTypes[T];
    url = objurl;
    returnType = returnTypeOrUrl as T;
    overrideOptions = optionsOrReturnType as Opts || {};
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
    overrideOptions = bodyOrOptions as Opts || {};
    body = rawBody || overrideOptions.body || null;
  }
  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) return genRejectedPromise(genInvalidParamMessage("method"));
  if(!BodyTypesSet.includes(returnType)) return genRejectedPromise(genInvalidParamMessage("returnType"));
  if(typeof overrideOptions != "object") return genRejectedPromise(genInvalidParamMessage("options"));
  if(!(url instanceof URL)) return genRejectedPromise(genInvalidParamMessage("url"));
  // prepare optiosn
  const options = Object.assign(createEmpty(), candyget.defaultOptions, overrideOptions);
  const headers = Object.assign(createEmpty(), candyget.defaultOptions.headers, overrideOptions.headers);
  // once clear headers
  options.headers = createEmpty();
  // assign headers with keys in lower case
  Object.keys(headers).map(key => options.headers![key.toLowerCase()] = headers[key]);
  // if json was passed and content-type is not set, set automatically
  if(!isString(body) && !options.headers[CONTENT_TYPE]){
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
    return new Promise<CGPromiseInner<T>>((resolve, reject) => {
      const req = HttpLibs[requestUrl.protocol as keyof typeof HttpLibs]?.request(requestUrl, {
        method: method,
        headers: options.headers,
        timeout: options.timeout,
        agent: options.agent,
      }, (res) => {
        const statusCode = res.statusCode as number;
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
            .on("data", buf => (bufs as Buffer[]).push(buf))
            .on("end", () => {
              destroy(req, res);
              const result = Buffer.concat(bufs!) as unknown as BodyTypes[T];
              const rawBody = (returnType == "buffer" ? result : result.toString()) as unknown as BodyTypes[T];
              let body = rawBody;
              if(returnType == "json"){
                try{
                  body = JSON.parse(body);
                }
                catch{/* empty */}
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
        ?.on("timeout", () => reject("timed out"))
      ;
      if(!req) reject(genError(genInvalidParamMessage("url")));
      req.end(body ? isString(body) ? body : JSON.stringify(body) : undefined);
    });
  };
  return executeRequest(url);
}

candyget.defaultOptions = {
  timeout: 10000,
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
  } as {[key:string]:string},
  maxRedirects: 10,
} as Omit<Opts, "body">;

// setup shorthand
BodyTypesSet.map((type) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (candyget as CGExport)[type] = function(url:Url, options?:Opts, body?:any){
      return candyget(url, type, options, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
});

const candygetType = candyget as CGExport;
candygetType.get = (url, returnType, options?) => candygetType(url, returnType, options);
candygetType.head = (url, options?) => candygetType("HEAD", url, "empty", options);
candygetType.post = (url, returnType, options, body) => candygetType("POST", url, returnType, options, body);
candygetType.put = (url, options, body) => candygetType("PUT", url, "empty", options, body);
candygetType.delete = (url, returnType, options?, body?) => candygetType("DELETE", url, returnType, options, body);
candygetType.options = (url, returnType, options?) => candygetType("OPTIONS", url, returnType, options);
candygetType.trace = (url, options?) => candygetType("TRACE", url, "empty", options);
candygetType.patch = (url, returnType, options, body) => candygetType("PATCH", url, returnType, options, body);

export = Object.freeze(candyget) as CGExport;
