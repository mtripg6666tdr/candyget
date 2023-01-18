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
const genParamErrMsg = (name:string) => `Invalid Param:${name}`;
const genRejectedPromise = (message:string) => Promise.reject(new CandyGetError(message));

/**
 * A function that does nothing
 */
const noop = () => {/* empty */};
/**
 * A function that returns a new empty object
 */
const createEmpty = () => Object.create(null) as EmptyObject;

type CGPromiseInner<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:ClientRequest,
  response:IncomingMessage,
  url:URL,
};
type CGReturn<T extends keyof BodyTypes> = Promise<CGPromiseInner<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShortenCG<T extends keyof BodyTypes> = (url:Url, options?:Opts, body?:any) => CGReturn<T>;
type CGExport = typeof candyget & {
  /**
   * Default options used in candyget, which can be overwritten by the argument of candyget
   */
  defaultOptions:Opts,
  /**
   * Shorthand of candyget(url, "string")
   */
  string:ShortenCG<"string">,
  /**
   * Shorthand of candyget(url, "buffer")
   */
  buffer:ShortenCG<"buffer">,
  /**
   * Shorthand of candyget(url, "stream")
   */
  stream:ShortenCG<"stream">,
  /**
   * Shorthand of candyget(url, "json")
   */
  json:ShortenCG<"json">,
  /**
   * Shorthand of candyget(url, "emtpy")
   */
  empty:ShortenCG<"empty">,
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
    body = bodyOrOptions as Body|null;
    // determine method automatically
    method = body ? "POST" : "GET";
  }
  catch{
    if(typeof urlOrMethod !== "string") return genRejectedPromise(genParamErrMsg("url"));
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = urlOrMethod.toUpperCase() as HttpMethods;
    url = typeof returnTypeOrUrl === "string" ? new URL(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as Opts || {};
    body = rawBody || null;
  }
  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) return genRejectedPromise(genParamErrMsg("method"));
  if(!BodyTypesSet.includes(returnType)) return genRejectedPromise(genParamErrMsg("returnType"));
  if(typeof overrideOptions != "object") return genRejectedPromise(genParamErrMsg("options"));
  if(!(url instanceof URL)) return genRejectedPromise(genParamErrMsg("url"));
  // prepare optiosn
  const options = Object.assign(createEmpty(), candyget.defaultOptions, overrideOptions);
  const headers = Object.assign(createEmpty(), candyget.defaultOptions.headers, overrideOptions.headers);
  // once clear headers
  options.headers = createEmpty();
  // assign headers with keys in lower case
  Object.keys(headers).map(key => options.headers![key.toLowerCase()] = headers[key]);
  // if json was passed and content-type is not set, set automatically
  if(typeof body !== "string" && !options.headers[CONTENT_TYPE]){
    options.headers[CONTENT_TYPE] = "application/json";
  }
  if(typeof options.timeout != "number" || options.timeout < 1 || isNaN(options.timeout)) return genRejectedPromise(genParamErrMsg("timeout"));
  if(typeof options.maxRedirects != "number" || options.maxRedirects < 0 || isNaN(options.maxRedirects)) return genRejectedPromise(genParamErrMsg("maxRedirects"));
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
          if(typeof redirectTo == "string"){
            redirectCount++;
            setImmediate(() => resolve(executeRequest(new URL(redirectTo, requestUrl))));
            if(!req.destroyed) req.destroy();
            if(!res.destroyed) res.destroy();
            return;
          }else{
            reject(new CandyGetError("no location header found"));
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
        if(contentEncoding === "gzip"){
          pipelineFragment.push(zlib.createGunzip());
        }else if(contentEncoding === "br"){
          pipelineFragment.push(zlib.createBrotliDecompress());
        }else if(contentEncoding === "deflate"){
          pipelineFragment.push(zlib.createInflate());
        }
        if(returnType == "stream"){
          const stream = new PassThrough(options.transformerOptions);
          stream.once("close", () => {
            if(!req.destroyed) req.destroy();
            if(!res.destroyed) res.destroy();
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
              if(!req.destroyed) req.destroy();
              if(!res.destroyed) res.destroy();
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
      if(!req) throw new CandyGetError(genParamErrMsg("url"));
      req.end(body ? typeof body === "string" ? body : JSON.stringify(body) : undefined);
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
} as Opts;

BodyTypesSet.map((type) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (candyget as CGExport)[type] = function(url:Url, options?:Opts, body?:any){
      return candyget(url, type, options, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
});

export = Object.freeze(candyget) as CGExport;
