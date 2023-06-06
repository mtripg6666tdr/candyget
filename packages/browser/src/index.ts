// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isString = ((target: any) => typeof target == "string") as (target: any) => target is string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObjectType = (<T extends abstract new (...args: any) => any>(target: any, type: T) => target instanceof type) as <T extends abstract new (...args: any) => any>(target: any, type: T) => target is InstanceType<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject = ((target: any) => typeof target == "object") as (target: any) => target is object;

/**
 * Represents options of candyget
 */
type Opts = {
  /**
   * timeout ms
   */
  timeout?: number,
  /**
   * request headers
   */
  headers?: { [key: string]: string },
  /**
   * Request body
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any,
  /**
   * Prevent from using fetch API or passing custom fetch implementation
   */
  fetch?: boolean | {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch: (url: string, init: any) => any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AbortController: new () => any,
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
  validator: (responseBody: any) => responseBody is U,
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
  buffer: ArrayBuffer,
  stream: ReadableStream,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any,
  empty: null,
};

const BodyTypesSet = ["string", "buffer", "stream", "json", "empty"] as const;
type HttpMethods = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "TRACE" | "PATCH";
const HttpMethodsSet = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "PATCH"] as const;
type Url = string | URL;
// eslint-disable-next-line @typescript-eslint/ban-types
type EmptyObject = {};
const CONTENT_TYPE = "Content-Type";
const TIMED_OUT = "timed out";
const objectAlias = Object;
const bufferAlias = ArrayBuffer;
const promiseAlias = Promise;
const urlAlias = URL;
const jsonAlias = JSON;

/**
 * Represents errors emitted manually in candyget
 */
class CandyGetError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "CandyGetError";
  }
}
const genInvalidParamMessage = (name: string) => `Invalid Param:${name}`;
const genError = (message: string) => new CandyGetError(message);
const genRejectedPromise = (message: string) => promiseAlias.reject(genError(message));
const createEmpty = () => objectAlias.create(null) as EmptyObject;
const normalizeKey = (key: string) => key.toLowerCase().startsWith("x-") ? key : key.split("-").map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()).join("-");

/**
 * Represents candyget's result type.
 */
type CGResult<T extends keyof BodyTypes> = {
  statusCode: number,
  headers: Headers,
  body: BodyTypes[T],
  request: unknown,
  response: unknown,
  url: URL,
};

/**
 * Represents candyget's result type, with typed body.
 */
type CGTypedResult<U> = Omit<CGResult<"json">, "body"> & {
  body: U;
};

type CGExport = typeof CandyGet & {
  /**
   * Default options used in candyget, which can be overwritten by the argument of candyget
   */
  defaultOptions: Omit<Opts, "body" | "validator">,
  /**
   * Shorthand of candyget(url, "string")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  string(url: Url, options?: Opts | null): Promise<CGResult<"string">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  string(url: Url, options?: OmitBody<Opts>, body?: any): Promise<CGResult<"string">>,
  /**
   * Shorthand of candyget(url, "buffer")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  buffer(url: Url, options?: Opts | null): Promise<CGResult<"buffer">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buffer(url: Url, options?: OmitBody<Opts>, body?: any): Promise<CGResult<"buffer">>,
  /**
   * Shorthand of candyget(url, "stream")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  stream(url: Url, options?: Opts | null): Promise<CGResult<"stream">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream(url: Url, options?: OmitBody<Opts>, body?: any): Promise<CGResult<"stream">>,
  /**
   * Shorthand of candyget(url, "json")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  json<U>(url: Url, options: TypedOpts<U>): Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<U>(url: Url, options: OmitBody<TypedOpts<U>>, body?: any): Promise<CGTypedResult<U>>,
  json(url: Url, options?: Opts | null): Promise<CGResult<"json">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(url: Url, options?: OmitBody<Opts>, body?: any): Promise<CGResult<"json">>,
  /**
   * Shorthand of candyget(url, "emtpy")
   * @param url URL
   * @param options the request options
   * @param body the response body
   */
  empty(url: Url, options?: Opts | null): Promise<CGResult<"empty">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empty(url: Url, options?: OmitBody<Opts>, body?: any): Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("GET", url, returnType, options)
   * no request body and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  get<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>): Promise<CGTypedResult<U>>,
  get<T extends keyof BodyTypes>(url: Url, returnType: T, options?: OmitBody<Opts> | null): Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("HEAD", url, "empty", options)
   * no request body or response body
   * @param url URL
   * @param options the request options
   */
  head(url: Url, options?: OmitBody<Opts>): Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("POST", url, returnType, options, body)
   * request body is required and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  post<U>(url: Url, returnType: "json", options: RequireBody<TypedOpts<U>>): Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>, body: any): Promise<CGTypedResult<U>>,
  post<T extends keyof BodyTypes>(url: Url, returnType: T, options: RequireBody<Opts>): Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T extends keyof BodyTypes>(url: Url, returnType: T, options: OmitBody<Opts> | null, body: any): Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("PUT", url, "empty", options, body)
   * request has a body and no response body
   * @param url URL
   * @param options the request options
   * @param body the request body
   */
  put(url: Url, options: RequireBody<Opts>): Promise<CGResult<"empty">>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put(url: Url, options: OmitBody<Opts> | null, body: any): Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("DELETE", url, returnType, options, body)
   * request body and response body are optional
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  delete<U>(url: Url, returnType: "json", options: TypedOpts<U>): Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>, body?: any): Promise<CGTypedResult<U>>,
  delete<T extends keyof BodyTypes>(url: Url, returnType: T, options?: Opts | null): Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete<T extends keyof BodyTypes>(url: Url, returnType: T, options?: OmitBody<Opts> | null, body?: any): Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("OPTIONS", url, returnType, options)
   * no request body and response has a body
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   */
  options<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>): Promise<CGTypedResult<U>>,
  options<T extends keyof BodyTypes>(url: Url, returnType: T, options?: OmitBody<Opts> | null): Promise<CGResult<T>>,
  /**
   * Shorthand of candyget("TRACE", url, "empty", options)
   * no request body or response body
   * @param url URL
   * @param options the request options
   */
  trace(url: Url, options?: OmitBody<Opts> | null): Promise<CGResult<"empty">>,
  /**
   * Shorthand of candyget("PATCH", url, returnType, options, body)
   * request body is required, response has a body.
   * @param url URL
   * @param returnType the type of the response body that will be included in the result.
   * @param options the request options
   * @param body the request body
   */
  patch<U>(url: Url, returnType: "json", options: RequireBody<TypedOpts<U>>): Promise<CGTypedResult<U>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>, body: any): Promise<CGTypedResult<U>>,
  patch<T extends keyof BodyTypes>(url: Url, returnType: T, options: RequireBody<Opts>): Promise<CGResult<T>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T extends keyof BodyTypes>(url: Url, returnType: T, options: OmitBody<Opts> | null, body: any): Promise<CGResult<T>>,
};

// define possible overloads

function CandyGet<U>(url: Url, returnType: "json", options: TypedOpts<U>): Promise<CGTypedResult<U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandyGet<U>(url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>, body?: any): Promise<CGTypedResult<U>>;

function CandyGet<T extends keyof BodyTypes>(url: Url, returnType: T, options?: Opts | null): Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandyGet<T extends keyof BodyTypes>(url: Url, returnType: T, options?: OmitBody<Opts> | null, body?: any): Promise<CGResult<T>>;

function CandyGet<U>(method: HttpMethods, url: Url, returnType: "json", options: TypedOpts<U>): Promise<CGTypedResult<U>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandyGet<U>(method: HttpMethods, url: Url, returnType: "json", options: OmitBody<TypedOpts<U>>, body?: any): Promise<CGTypedResult<U>>;

function CandyGet<T extends keyof BodyTypes>(method: HttpMethods, url: Url, returnType: T, options?: Opts): Promise<CGResult<T>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandyGet<T extends keyof BodyTypes>(method: HttpMethods, url: Url, returnType: T, options?: OmitBody<Opts> | null, body?: any): Promise<CGResult<T>>;

// implementation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CandyGet<T extends keyof BodyTypes, U>(urlOrMethod: Url | HttpMethods, returnTypeOrUrl: T | Url, optionsOrReturnType?: TypedOpts<U> | Opts | null | T, bodyOrOptions?: any | TypedOpts<U> | Opts | null, rawBody?: any): Promise<CGResult<T>> {
  // parse arguments.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let method: HttpMethods, url: URL, returnType: T, overrideOptions: Opts | TypedOpts<U>, body: any | null;
  try {
    const urlStr = isString(urlOrMethod) ? urlOrMethod : urlOrMethod.href;
    const objurl = new urlAlias(urlStr, HttpMethodsSet.includes(urlStr as HttpMethods) ? undefined : window.location.href);
    // (url:UrlResolvable, returnType:T, options?:Options, body?:BodyResolvable):ReturnTypes[T];
    url = objurl;
    returnType = returnTypeOrUrl as T;
    overrideOptions = optionsOrReturnType as TypedOpts<U> | Opts || {};
    body = bodyOrOptions || overrideOptions.body;
    // determine method automatically
    method = body ? "POST" : "GET";
  }
  catch {
    if (!isString(urlOrMethod)) return genRejectedPromise(genInvalidParamMessage("url"));
    // (method:HttpMethods, url:UrlResolvable, returnType:T, body?:BodyResolvable):ReturnTypes[T];
    method = urlOrMethod.toUpperCase() as HttpMethods;
    url = isString(returnTypeOrUrl) ? new urlAlias(returnTypeOrUrl) : returnTypeOrUrl;
    returnType = optionsOrReturnType as T;
    overrideOptions = bodyOrOptions as TypedOpts<U> | Opts || {};
    body = rawBody || overrideOptions.body || null;
  }


  // validate params (not strictly)
  if (!HttpMethodsSet.includes(method)) return genRejectedPromise(genInvalidParamMessage("method"));
  if (!BodyTypesSet.includes(returnType)) return genRejectedPromise(genInvalidParamMessage("returnType"));
  if (!isObject(overrideOptions)) return genRejectedPromise(genInvalidParamMessage("options"));
  if (!isObjectType(url, URL) || (url.protocol != "http:" && url.protocol != "https:")) return genRejectedPromise(genInvalidParamMessage("url"));


  // prepare option
  const options = objectAlias.assign(createEmpty(), defaultOptions, (CandyGet as CGExport).defaultOptions, overrideOptions);
  // normalize headers in defaultOptions
  const defaultOptionsHeaders: { [key: string]: string } = createEmpty();
  if (!(CandyGet as CGExport).defaultOptions.headers) (CandyGet as CGExport).defaultOptions.headers = {};
  objectAlias.keys((CandyGet as CGExport).defaultOptions.headers!).map(key => defaultOptionsHeaders[normalizeKey(key)] = (CandyGet as CGExport).defaultOptions.headers![key]);


  // normalize headers in override options
  const overrideOptionsHeaders: { [key: string]: string } = createEmpty();
  if (!overrideOptions.headers) overrideOptions.headers = {};
  objectAlias.keys(overrideOptions.headers).map(key => overrideOptionsHeaders[normalizeKey(key)] = overrideOptions.headers![key]);
  // merge headers
  options.headers = objectAlias.assign(defaultOptionsHeaders, overrideOptionsHeaders);


  // if json was passed and content-type is not set, set automatically
  if (body && !isString(body) && !isObjectType(body, bufferAlias) && !(body instanceof ReadableStream) && !options.headers[CONTENT_TYPE]) {
    options.headers[CONTENT_TYPE] = "application/json";
  }


  // validate options
  if (typeof options.timeout != "number" || options.timeout < 1 || isNaN(options.timeout)) return genRejectedPromise(genInvalidParamMessage("timeout"));
  if (typeof options.maxRedirects != "number" || options.maxRedirects < 0 || isNaN(options.maxRedirects)) return genRejectedPromise(genInvalidParamMessage("maxRedirects"));

  return new promiseAlias<CGResult<T>>((resolve, reject) => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, options.timeout);
    window.fetch(url.href, {
      method: method,
      headers: options.headers,
      signal: abortController.signal,
      body: !body
        ? undefined
        : isString(body) || isObjectType(body, bufferAlias)
          ? body
          : jsonAlias.stringify(body),
    } as RequestInit)
      .then(async res => {
        clearTimeout(timeout);
        const partialResult = {
          headers: res.headers,
          statusCode: res.status,
          request: null,
          response: res,
          url: url,
        };
        if (returnType == "empty" || !res.body) {
          resolve({
            body: (returnType == "empty" ? null : "") as unknown as BodyTypes[T],
            ...partialResult,
          });
          return;
        }
        if (returnType == "stream") {
          resolve({
            body: res.body as unknown as BodyTypes[T],
            ...partialResult,
          });
        } else if (returnType === "buffer") {
          res.arrayBuffer().then(body => {
            resolve({
              body: body as unknown as BodyTypes[T],
              ...partialResult,
            });
          });
        } else {
          res.text().then(str => {
            if (returnType === "json") {
              try {
                resolve({
                  body: jsonAlias.parse(str),
                  ...partialResult,
                });
                return;
              }
              catch {
                /* empty */
              }
            }
            resolve({
              body: str as unknown as BodyTypes[T],
              ...partialResult,
            });
          });
        }
      })
      .catch(er => {
        // TODO: implement better way to judge the aborted error or not
        if (er.message?.includes("abort")) {
          reject(genError(TIMED_OUT));
        } else {
          reject(er);
        }
      })
      ;
  });
}

// setup shorthand functions
BodyTypesSet.map(<T extends keyof BodyTypes>(type: T) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (CandyGet as CGExport)[type] = <T extends keyof BodyTypes>(url: Url, options?: Opts, body?: any) => {
    return CandyGet(url, type, options, body) as unknown as Promise<CGResult<T>>;
  };
});
(CandyGet as CGExport).get = <T extends keyof BodyTypes, U>(url: Url, returnType: T, options?: TypedOpts<U> | Opts) => CandyGet(url, returnType, options);
(CandyGet as CGExport).head = (url: Url, options?: Opts) => CandyGet("HEAD", url, "empty", options);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CandyGet as CGExport).post = <T extends keyof BodyTypes, U>(url: Url, returnType: T, options: TypedOpts<U> | Opts, body?: any) => CandyGet("POST", url, returnType, options, body);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CandyGet as CGExport).put = (url: Url, options: Opts, body?: any) => CandyGet("PUT", url, "empty", options, body);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CandyGet as CGExport).delete = <T extends keyof BodyTypes, U>(url: Url, returnType: T, options?: TypedOpts<U> | Opts, body?: any) => CandyGet("DELETE", url, returnType, options, body);
(CandyGet as CGExport).options = <T extends keyof BodyTypes, U>(url: Url, returnType: T, options?: TypedOpts<U> | Opts) => CandyGet("OPTIONS", url, returnType, options);
(CandyGet as CGExport).trace = (url: Url, options?: Opts) => CandyGet("TRACE", url, "empty", options);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(CandyGet as CGExport).patch = <T extends keyof BodyTypes, U>(url: Url, returnType: T, options: TypedOpts<U> | Opts, body?: any) => CandyGet("PATCH", url, returnType, options, body);

const defaultOptions = {
  timeout: 10000,
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Accept-Language": "*",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Candyget/0.0.0",
  } as { [key: string]: string },
  maxRedirects: 10,
  transformerOptions: {
    autoDestroy: true,
  },
  fetch: false,
};

(CandyGet as CGExport).defaultOptions = objectAlias.assign({}, defaultOptions);

const candyget = objectAlias.freeze(CandyGet) as CGExport;
export default candyget;
