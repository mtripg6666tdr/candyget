import http, { IncomingHttpHeaders } from "http";
import https from "https";
import { PassThrough, pipeline, Readable, TransformOptions } from "stream";
import zlib from "zlib";

/**
 * Represents options of candyget
 */
type Options = {
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
  agent?:http.Agent,
  /**
   * options to pass to node Transform stream if return type is stream
   */
  transformerOptions?:TransformOptions,
  /**
   * represents max number of redirects that candyget handles
   */
  maxRedirects?:number,
};

interface BodyReturnTypes {
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

const ReturnTypesSet:Readonly<(keyof BodyReturnTypes)[]> = ["string", "buffer", "stream", "json"];
type HttpMethods = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"OPTIONS"|"TRACE"|"PATCH";
const HttpMethodsSet:Readonly<HttpMethods[]> = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PATCH"];
type UrlResolvable = string|URL;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BodyResolvable = string|any;
const HttpLibs = {
  "http:": http,
  "https:": https,
} as const;
const ProtocolsSet:Readonly<(keyof typeof HttpLibs)[]> = ["http:", "https:"];
const redirectStatuses:Readonly<number[]> = [301, 302, 303, 307, 308];

/**
 * Represents errors emitted manually in candyget
 */
class CandyGetError extends Error {}
const genParamErrMsg = (name:string) => `Invalid Parameter: ${name}`;

/**
 * A function that does nothing
 */
const noop = () => {/* empty */};

type CandyGetPromiseInner<T extends keyof BodyReturnTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyReturnTypes[T],
  request:http.ClientRequest,
  response:http.IncomingMessage,
};
type CandyGetReturn<T extends keyof BodyReturnTypes> = Promise<CandyGetPromiseInner<T>>;
type ShortenCandyGet<T extends keyof BodyReturnTypes> = (url:UrlResolvable) => CandyGetReturn<T>;
type CandyGetExport = typeof candyget & {
  /**
   * Default options used in candyget, which can be overwritten by the argument of candyget
   */
  defaultOptions:Options,
  /**
   * Shorthand of candyget(url, "string")
   */
  string:ShortenCandyGet<"string">,
  /**
   * Shorthand of candyget(url, "buffer")
   */
  buffer:ShortenCandyGet<"buffer">,
  /**
   * Shorthand of candyget(url, "stream")
   */
  stream:ShortenCandyGet<"stream">,
  /**
   * Shorthand of candyget(url, "json")
   */
  json:ShortenCandyGet<"json">,
};

function candyget<T extends keyof BodyReturnTypes>(url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):CandyGetReturn<T>;
function candyget<T extends keyof BodyReturnTypes>(method:HttpMethods, url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):CandyGetReturn<T>;
function candyget<T extends keyof BodyReturnTypes>(urlOrMethod:UrlResolvable|HttpMethods, returnTypeOrUrl:T|UrlResolvable, optionsOrReturnType?:Options|T, bodyOrOptions?:BodyResolvable|Options, rawBody?:BodyResolvable):CandyGetReturn<T>{
  let method:HttpMethods, url:URL, returnType:T, overrideOptions:Options, body:BodyResolvable|null;
  try{
    const objurl = new URL(urlOrMethod);
    // (url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):ReturnTypes[T];
    url = objurl;
    returnType = returnTypeOrUrl as T;
    overrideOptions = optionsOrReturnType as Options || {};
    body = bodyOrOptions as BodyResolvable|null;
    // determine method automatically
    method = body ? "POST" : "GET";
  }
  catch{
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = (urlOrMethod as string).toUpperCase() as HttpMethods;
    url = typeof returnTypeOrUrl === "string" ? new URL(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as Options || {};
    body = rawBody || null;
  }
  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) throw new CandyGetError(genParamErrMsg("method"));
  if(!ReturnTypesSet.includes(returnType)) throw new CandyGetError(genParamErrMsg("returnType"));
  if(!ProtocolsSet.includes(url.protocol as keyof typeof HttpLibs)) throw new CandyGetError(genParamErrMsg("url"));
  if(typeof overrideOptions !== "object") throw new CandyGetError(genParamErrMsg("options"));
  // prepare optiosn
  const options = Object.assign({}, (candyget as CandyGetExport).defaultOptions, overrideOptions);
  options.headers = Object.assign({}, (candyget as CandyGetExport).defaultOptions.headers, overrideOptions.headers);
  if(typeof body !== "string" && !Object.keys(options.headers).some(key => key.toLowerCase() === "content-type")){
    options.headers["Content-Type"] = "application/json";
  }
  if(typeof options.timeout !== "number" || options.timeout === Infinity || options.timeout < 1) throw new CandyGetError("Invalid timeout");
  if(typeof options.maxRedirects !== "number" || options.maxRedirects < 0) throw new CandyGetError("Invalid maxRedirect");
  // execute request
  let redirectCount = 0;
  const executeRequest = function(url:URL){
    return new Promise<CandyGetPromiseInner<T>>(function(resolve, reject){
      const req = HttpLibs[url.protocol as keyof typeof HttpLibs].request(url, {
        method: method,
        headers: options.headers,
        timeout: options.timeout,
        agent: options.agent,
      }, function(res){
        if(redirectCount < (options.maxRedirects as number) && redirectStatuses.includes(res.statusCode as number)){
          const redirectTo = res.headers.location;
          if(typeof redirectTo === "string"){
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
        if(returnType === "stream"){
          const stream = new PassThrough(options.transformerOptions);
          pipelineFragment.push(stream);
          pipeline(pipelineFragment, noop);
          resolve({
            body: stream as unknown as BodyReturnTypes[T],
            headers: res.headers,
            statusCode: res.statusCode as number,
            request: req,
            response: res,
          });
        }else if(returnType === "buffer" || returnType === "string" || returnType === "json"){
          let bufs:Buffer[]|null = [];
          (pipelineFragment.length === 1 ? pipelineFragment[0] : pipeline(pipelineFragment, noop))
            .on("data", buf => (bufs as Buffer[]).push(buf))
            .on("end", () => {
              const result = Buffer.concat((bufs as Buffer[])) as unknown as BodyReturnTypes[T];
              const rawBody = (returnType === "buffer" ? result : result.toString()) as unknown as BodyReturnTypes[T];
              let body = rawBody;
              if(returnType === "json"){
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
        }else{/* empty */}
      })
        .on("error", reject)
      ;
      if(body){
        req.end(typeof body === "string" ? body : JSON.stringify(body));
      }else{
        req.end();
      }
    });
  };
  return executeRequest(url);
}

(function applyCandyGetProperties(candyget:CandyGetExport){
  candyget.defaultOptions = {
    timeout: 10000,
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    },
    maxRedirects: 10,
  };
  ([
    "string",
    "buffer",
    "stream",
    "json",
  ] as const).forEach(function(type){
    Object.defineProperty(candyget, type, {
      value: function(url:UrlResolvable){
        return candyget(url, type);
      },
      enumerable: true,
    });
  });
})(candyget as CandyGetExport);

export = candyget as CandyGetExport;
