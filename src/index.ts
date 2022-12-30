import type { IncomingHttpHeaders, Agent, ClientRequest, IncomingMessage } from "http";
import type { Readable, TransformOptions } from "stream";

// Import these module by `require` instead of `import` in order to prevent from generating helper methods.
const requireLocal = require;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const http = requireLocal("http") as typeof import("http");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const https = requireLocal("https") as typeof import("https");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PassThrough, pipeline } = requireLocal("stream") as typeof import("stream");
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
}

const BodyTypesSet:Readonly<(keyof BodyTypes)[]> = ["string", "buffer", "stream", "json"];
type HttpMethods = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"OPTIONS"|"TRACE"|"PATCH";
const HttpMethodsSet:Readonly<HttpMethods[]> = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PATCH"];
type Url = string|URL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HttpLibs = {
  "http:": http,
  "https:": https,
} as const;
const redirectStatuses:Readonly<number[]> = [301, 302, 303, 307, 308];

/**
 * Represents errors emitted manually in candyget
 */
class CandyGetError extends Error {}
const genParamErrMsg = (name:string) => `Invalid Param:${name}`;

/**
 * A function that does nothing
 */
const noop = () => {/* empty */};

type CGPromiseInner<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:ClientRequest,
  response:IncomingMessage,
};
type CGReturn<T extends keyof BodyTypes> = Promise<CGPromiseInner<T>>;
type ShortenCG<T extends keyof BodyTypes> = (url:Url) => CGReturn<T>;
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
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts, body?:any):CGReturn<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(method:HttpMethods, url:Url, returnType:T, options?:Opts, body?:any):CGReturn<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(urlOrMethod:Url|HttpMethods, returnTypeOrUrl:T|Url, optionsOrReturnType?:Opts|T, bodyOrOptions?:any|Opts, rawBody?:any):CGReturn<T>{
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
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = (urlOrMethod as string).toUpperCase() as HttpMethods;
    url = typeof returnTypeOrUrl === "string" ? new URL(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as Opts || {};
    body = rawBody || null;
  }
  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) throw new CandyGetError(genParamErrMsg("method"));
  if(!BodyTypesSet.includes(returnType)) throw new CandyGetError(genParamErrMsg("returnType"));
  if(typeof overrideOptions != "object") throw new CandyGetError(genParamErrMsg("options"));
  // prepare optiosn
  const options = Object.assign({}, candyget.defaultOptions, overrideOptions);
  options.headers = Object.assign({}, candyget.defaultOptions.headers, overrideOptions.headers);
  if(typeof body !== "string" && !Object.keys(options.headers).some(key => key.toLowerCase() === "content-type")){
    options.headers["Content-Type"] = "application/json";
  }
  if(typeof options.timeout != "number" || options.timeout === Infinity || options.timeout < 1) throw new CandyGetError("Invalid timeout");
  if(typeof options.maxRedirects != "number" || options.maxRedirects < 0) throw new CandyGetError("Invalid maxRedirect");
  // execute request
  let redirectCount = 0;
  const executeRequest = function(url:URL){
    return new Promise<CGPromiseInner<T>>(function(resolve, reject){
      const req = HttpLibs[url.protocol as keyof typeof HttpLibs]?.request(url, {
        method: method,
        headers: options.headers,
        timeout: options.timeout,
        agent: options.agent,
      }, function(res){
        if(redirectCount < options.maxRedirects && redirectStatuses.includes(res.statusCode as number)){
          const redirectTo = res.headers.location;
          if(typeof redirectTo == "string"){
            redirectCount++;
            resolve(executeRequest(new URL(redirectTo, url)));
            return;
          }
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
          pipelineFragment.push(stream);
          pipeline(pipelineFragment, noop);
          resolve({
            body: stream as unknown as BodyTypes[T],
            headers: res.headers,
            statusCode: res.statusCode as number,
            request: req,
            response: res,
          });
        }else if(["buffer", "string", "json"].some(t => t == returnType)){
          let bufs:Buffer[]|null = [];
          (pipelineFragment.length == 1 ? pipelineFragment[0] : pipeline(pipelineFragment, noop))
            .on("data", buf => (bufs as Buffer[]).push(buf))
            .on("end", () => {
              const result = Buffer.concat((bufs as Buffer[])) as unknown as BodyTypes[T];
              const rawBody = (returnType == "buffer" ? result : result.toString()) as unknown as BodyTypes[T];
              let body = rawBody;
              if(returnType == "json"){
                try{
                  body = JSON.parse(body);
                }
                catch{/* empty */}
              }
              resolve({
                body: body,
                headers: res.headers,
                statusCode: res.statusCode as number,
                request: req,
                response: res,
              });
              bufs = null;
            })
            .on("error", reject)
          ;
        }
      })
        ?.on("error", reject)
      ;
      if(!req) throw new CandyGetError(genParamErrMsg("url"));
      if(body){
        req.end(typeof body === "string" ? body : JSON.stringify(body));
      }else{
        req.end();
      }
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
};

([
  "string",
  "buffer",
  "stream",
  "json",
] as const).map((type) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (candyget as CGExport)[type] = function(url:Url, options?:Opts, body?:any){
      return candyget(url, type, options, body);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
});

export = Object.freeze(candyget) as CGExport;
