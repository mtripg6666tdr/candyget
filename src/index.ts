import type { IncomingHttpHeaders, Agent } from "http";
import type { Readable as ReadableType, TransformOptions } from "stream";
import type { ReadableStream } from "stream/web";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isString = ((target:any) => typeof target == "string") as (target:any) => target is string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObjectType = (<T extends abstract new (...args: any) => any>(target:any, type:T) => target instanceof type) as <T extends abstract new (...args: any) => any>(target:any, type:T) => target is InstanceType<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject = ((target:any) => typeof target == "object") as (target:any) => target is object;

// Import these module by `require` instead of `import` in order to prevent from generating helper methods.
const requireLocal = require;
const http = requireLocal("http") as typeof import("http");
const https = requireLocal("https") as typeof import("https");
const { PassThrough, pipeline, Readable, Stream } = requireLocal("stream") as typeof import("stream");
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
  /**
   * Prevent from using fetch API or passing custom fetch implementation
   */
  fetch?:boolean|{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch:(url:string, init:any)=>any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AbortController:new () => any,
  },
};

/**
 * Options with the validator property
 */
type TypedOpts<U> = Opts & {
  /**
   * Specifies validator
   * @param responseBody the response body 
   * @returns represents if the response body is correct
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validator:(responseBody:any) => responseBody is U,
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
  string: string,
  buffer: Buffer,
  stream: ReadableType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  empty: null,
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
const CONTENT_TYPE = "Content-Type";
const TIMED_OUT = "timed out";
const LOCATION = "location";
const FETCH = "fetch";
const ABORT_CONTROLLER = "AbortController";
const objectAlias = Object;
const bufferAlias = Buffer;
const promiseAlias = Promise;
const urlAlias = URL;
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
const genRejectedPromise = (message:string) => promiseAlias.reject(genError(message));
const noop = () => {/* empty */};
const createEmpty = () => objectAlias.create(null) as EmptyObject;
type destroyable = {destroyed?:boolean, destroy:()=>void};
const destroy = (...destroyable:destroyable[]) => destroyable.map(stream => {
  if(!stream.destroyed) stream.destroy();
});
const normalizeKey = (key:string) => key.toLowerCase().startsWith("x-") ? key : key.split("-").map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()).join("-");

/**
 * Represents candyget's result type.
 */
type CGResult<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:unknown,
  response:unknown,
  url:URL,
};

/**
 * Represents candyget's result type, with typed body.
 */
type CGTypedResult<U> = Omit<CGResult<"json">, "body"> & {
  body: U;
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
  json<U>(url:Url, options:TypedOpts<U>):Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<U>(url:Url, options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<U>>,
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
  get<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>):Promise<CGTypedResult<U>>,
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
  post<U>(url:Url, returnType:"json", options:RequireBody<TypedOpts<U>>):Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body:any):Promise<CGTypedResult<U>>,
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
  delete<U>(url:Url, returnType:"json", options:TypedOpts<U>):Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<U>>,
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
  options<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>):Promise<CGTypedResult<U>>,
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
  patch<U>(url:Url, returnType:"json", options:RequireBody<TypedOpts<U>>):Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body:any):Promise<CGTypedResult<U>>,
  patch<T extends keyof BodyTypes>(url:Url, returnType:T, options:RequireBody<Opts>):Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T extends keyof BodyTypes>(url:Url, returnType:T, options:OmitBody<Opts>|null, body:any):Promise<CGResult<T>>,
};

// define possible overloads

function candyget<U>(url:Url, returnType:"json", options:TypedOpts<U>):Promise<CGTypedResult<U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<U>(url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<U>>;

function candyget<T extends keyof BodyTypes>(url:Url, returnType:T, options?:Opts|null):Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(url:Url, returnType:T, options?:OmitBody<Opts>|null, body?:any):Promise<CGResult<T>>;

function candyget<U>(method:HttpMethods, url:Url, returnType:"json", options:TypedOpts<U>):Promise<CGTypedResult<U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<U>(method:HttpMethods, url:Url, returnType:"json", options:OmitBody<TypedOpts<U>>, body?:any):Promise<CGTypedResult<U>>;

function candyget<T extends keyof BodyTypes>(method:HttpMethods, url:Url, returnType:T, options?:Opts):Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes>(method:HttpMethods, url:Url, returnType:T, options?:OmitBody<Opts>|null, body?:any):Promise<CGResult<T>>;

// implementation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function candyget<T extends keyof BodyTypes, U>(urlOrMethod:Url|HttpMethods, returnTypeOrUrl:T|Url, optionsOrReturnType?:TypedOpts<U>|Opts|null|T, bodyOrOptions?:any|TypedOpts<U>|Opts|null, rawBody?:any):Promise<CGResult<T>>{
  // parse arguments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let method:HttpMethods, url:URL, returnType:T, overrideOptions:Opts|TypedOpts<U>, body:any|null;
  try{
    const objurl = new urlAlias(isString(urlOrMethod) ? urlOrMethod : urlOrMethod.href);
    // (url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):ReturnTypes[T];
    url = objurl;
    returnType = returnTypeOrUrl as T;
    overrideOptions = optionsOrReturnType as TypedOpts<U>|Opts || {};
    body = bodyOrOptions || overrideOptions.body;
    // determine method automatically
    method = body ? "POST" : "GET";
  }
  catch{
    if(!isString(urlOrMethod)) return genRejectedPromise(genInvalidParamMessage("url"));
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = urlOrMethod.toUpperCase() as HttpMethods;
    url = isString(returnTypeOrUrl) ? new urlAlias(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as TypedOpts<U>|Opts || {};
    body = rawBody || overrideOptions.body || null;
  }


  // validate params (not strictly)
  if(!HttpMethodsSet.includes(method)) return genRejectedPromise(genInvalidParamMessage("method"));
  if(!BodyTypesSet.includes(returnType)) return genRejectedPromise(genInvalidParamMessage("returnType"));
  if(!isObject(overrideOptions)) return genRejectedPromise(genInvalidParamMessage("options"));
  if(!isObjectType(url, URL) || (url.protocol != "http:" && url.protocol != "https:")) return genRejectedPromise(genInvalidParamMessage("url"));


  // prepare option
  const options = objectAlias.assign(createEmpty(), defaultOptions, (candyget as CGExport).defaultOptions, overrideOptions);
  // normalize headers in defaultOptions
  const defaultOptionsHeaders:{[key:string]:string} = createEmpty();
  if(!(candyget as CGExport).defaultOptions.headers) (candyget as CGExport).defaultOptions.headers = {};
  objectAlias.keys((candyget as CGExport).defaultOptions.headers!).map(key => defaultOptionsHeaders[normalizeKey(key)] = (candyget as CGExport).defaultOptions.headers![key]);


  // normalize headers in override options
  const overrideOptionsHeaders:{[key:string]:string} = createEmpty();
  if(!overrideOptions.headers) overrideOptions.headers = {};
  objectAlias.keys(overrideOptions.headers).map(key => overrideOptionsHeaders[normalizeKey(key)] = overrideOptions.headers![key]);
  // merge headers
  options.headers = objectAlias.assign(defaultOptionsHeaders, overrideOptionsHeaders);


  // if json was passed and content-type is not set, set automatically
  if(body && !isString(body) && !isObjectType(body, bufferAlias) && !isObjectType(body, Stream) && !options.headers[CONTENT_TYPE]){
    options.headers[CONTENT_TYPE] = "application/json";
  }


  // validate options
  if(typeof options.timeout != "number" || options.timeout < 1 || isNaN(options.timeout)) return genRejectedPromise(genInvalidParamMessage("timeout"));
  if(typeof options.maxRedirects != "number" || options.maxRedirects < 0 || isNaN(options.maxRedirects)) return genRejectedPromise(genInvalidParamMessage("maxRedirects"));


  let redirectCount = 0;
  // store the original url
  const originalUrl = url;
  

  // define request executor
  const executeRequest = (requestUrl:URL) => {
    // do jobs if the request was fired by redirection
    if(redirectCount > 0){
      if(originalUrl.host !== requestUrl.host || originalUrl.protocol !== requestUrl.protocol){
        // delete credentials to prevent from leaking credentials
        delete options.headers["Cookie"];
        delete options.headers["Authorization"];
      }
      // delete host header if present
      delete options.headers["Host"];
      // change http method to get
      if(method == "POST"){
        method = "GET";
        body = null;
        delete options.headers["Content-Type"];
        delete options.headers["Content-Length"];
      }
    }


    // handle redirect if redirected, return true, otherwise false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redirect = (statusCode:number, location:string|undefined|null, resolve:(value:CGResult<T>|PromiseLike<CGResult<T>>)=>void, reject:(reason:any)=>void) => {
      if(redirectCount < options.maxRedirects && redirectStatuses.includes(statusCode)){
        const redirectTo = location;
        if(redirectTo){
          redirectCount++;
          setImmediate(() => resolve(executeRequest(new urlAlias(redirectTo, requestUrl))));
        }else{
          reject(genError("no location header found"));
        }
        return true;
      }
      return false;
    };


    // handle the response body as stream and resolve as raw stream, or as json, string, and so on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveStream = (resources:destroyable[], partialResult:Omit<CGResult<T>, "body">, stream:ReadableType, resolve:(value:CGResult<T>|PromiseLike<CGResult<T>>)=>void, reject:(reason:any)=>void) => {
      let bufs:Buffer[]|null = [];
      stream
        .on("data", buf => bufs!.push(buf))
        .on("end", () => {
          destroy(...resources);
          const result = bufferAlias.concat(bufs!) as unknown as BodyTypes[T];
          const rawBody = (returnType == "buffer" ? result : result.toString()) as unknown as BodyTypes[T];
          let body = rawBody;
          if(returnType == "json"){
            if("validator" in options && typeof options.validator == "function"){
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
    };


    // resolve body into sendable form
    const resolveBody = () => {
      return !body
      ? undefined
      : isString(body) || isObjectType(body, bufferAlias)
      ? body
      : jsonAlias.stringify(body);
    };


    return new promiseAlias<CGResult<T>>((resolve, reject) => {
      // prepare fetch implementation
      const [ fetch, AbortController ] = (() => {
        if(options[FETCH]){
          if(isObject(options[FETCH])){
            return [options[FETCH][FETCH], options[FETCH][ABORT_CONTROLLER]];
          }else{
            return [global[FETCH], global[ABORT_CONTROLLER]];
          }
        }else{
          return [];
        }
      })() as [(typeof global)["fetch"]|undefined, (typeof global)["AbortController"]|undefined];


      // if fetch api is ready, use them instead of 
      if(fetch && AbortController){
        const abortController = new AbortController();
        const timeout = setTimeout(() => {
          abortController.abort();
        }, options.timeout);
        new promiseAlias<string|Buffer|undefined>((childResolve, childReject) => {
          if(isObjectType(body, Stream)){
            const buf:Buffer[] = [];
            body
              .on("data", chunk => buf.push(chunk))
              .on("end", () => childResolve(buf.every(e => isString(e)) ? buf.join("") : bufferAlias.concat(buf)))
              .on("error", childReject)
            ;
          }else{
            childResolve(resolveBody());
          }
        })
          .then(fineBody => fetch(requestUrl.href, {
            method: method,
            headers: options.headers,
            agent: options.agent,
            redirect: "manual",
            signal: abortController.signal,
            body: fineBody,
          } as RequestInit))
          .then(async res => {
            clearTimeout(timeout);
            if(redirect(res.status, res.headers.get(LOCATION), resolve, reject)){
              res.arrayBuffer().catch(noop);
              return;
            }
            const headers:{[key:string]:string} = createEmpty();
            [...res.headers.keys()].map(key => headers[key.toLowerCase()] = res.headers.get(key)!);
            const partialResult = {
              headers,
              statusCode: res.status,
              request: null,
              response: res,
              url: requestUrl,
            };
            if(returnType == "empty" || !res.body){
              res.arrayBuffer().catch(noop);
              resolve({
                body: (returnType == "empty" ? null : "") as unknown as BodyTypes[T],
                ...partialResult,
              });
              return;
            }
            const stream = new PassThrough(options.transformerOptions);
            if("pipe" in res.body){
              // handle node-fetch's fetch
              pipeline(res.body as unknown as ReadableStream, stream, noop);
            }else if("fromWeb" in Readable){
              pipeline(Readable.fromWeb(res.body as unknown as ReadableStream), stream, noop);
            }else{
              setImmediate(async () => {
                const reader = (res.body! as ReadableStream<Uint8Array>).getReader();
                let done = false;
                while(!done){
                  const chunk = await reader.read().catch(() => ({done: true, value: undefined}));
                  done = chunk.done;
                  if(chunk.value){
                    stream.write(chunk.value);
                  }
                }
                stream.end();
              });
            }
            if(returnType == "stream"){
              resolve({
                body: stream as unknown as BodyTypes[T],
                ...partialResult,
              });
            }else{
              resolveStream([], partialResult, stream, resolve, reject);
            }
          })
          .catch(er => {
            // TODO: implement better way to judge the aborted error or not
            if(er.message?.includes("abort")){
              reject(genError(TIMED_OUT));
            }else{
              reject(er);
            }
          })
        ;
        return;
      }
      

      // fallback to the default requests by http/https module.
      const req = HttpLibs[requestUrl.protocol as keyof typeof HttpLibs].request(requestUrl, {
        method: method,
        headers: options.headers,
        timeout: options.timeout,
        agent: options.agent,
      }, (res) => {
        const statusCode = res.statusCode!;


        // handle redirect
        if(redirect(statusCode, res.headers[LOCATION], resolve, reject)){
          destroy(req, res);
          return;
        }


        // normalize the location header
        if(res.headers[LOCATION]) res.headers[LOCATION] = new urlAlias(res.headers[LOCATION], requestUrl.href).href;
        const partialResult = {
          headers: res.headers,
          statusCode,
          request: req,
          response: res,
          url: requestUrl,
        };

        // early return if the return type is empty
        if(returnType == "empty"){
          destroy(req, res);
          resolve({
            body: null as unknown as BodyTypes[T],
            ...partialResult,
          });
          return;
        }

        // decompress based on the content-encoding header
        const pipelineFragment:ReadableType[] = [];
        const contentEncodings = (res.headers["content-encoding"]?.toLowerCase().split(",") || []).map(e => e.trim());
        contentEncodings.map(contentEncoding => {
          if(contentEncoding == "gzip"){
            pipelineFragment.push(zlib.createGunzip());
          }else if(contentEncoding == "br"){
            pipelineFragment.push(zlib.createBrotliDecompress());
          }else if(contentEncoding == "deflate"){
            pipelineFragment.push(zlib.createInflate());
          }else if(contentEncoding == "identity"){
            /* empty */
          }else{
            console.warn("Detected not supported content-encoding");
          }
        });
        pipelineFragment.push(res);
        pipelineFragment.reverse();


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
          return;
        }else{
          resolveStream([req, res], partialResult, pipelineFragment.length == 1 ? pipelineFragment[0] : pipeline(pipelineFragment, noop) as unknown as ReadableType, resolve, reject);
          return;
        }
      })
        .on("error", reject)
        .on("timeout", () => reject(genError(TIMED_OUT)))
      ;

      // consume the request body
      if(body && isObjectType(body, Stream)){
        body
          .on("error", (er) => {
            reject(er);
            req.destroy();
          })
          .pipe(req);
      }else{
        req.end(resolveBody());
      }
    });
  };

  // execute request
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

const defaultOptions = {
  timeout: 10000,
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Language": "*",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Candyget/0.0.0",
  } as {[key:string]:string},
  maxRedirects: 10,
  transformerOptions: {
    autoDestroy: true,
  },
  fetch: false,
};

candygetType.defaultOptions = objectAlias.assign({}, defaultOptions);

export = objectAlias.freeze(candyget) as CGExport;
