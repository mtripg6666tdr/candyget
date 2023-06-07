import { IncomingHttpHeaders } from "http";
import { Readable } from "stream";

export type HttpMethods = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"OPTIONS"|"TRACE"|"PATCH";

export type BodyTypes = {
  string: string,
  buffer: Buffer,
  stream: Readable,
  json: any,
  empty: null,
};

export type Opts = {
  /**
   * timeout ms
   */
  timeout?:number,
  /**
   * request headers
   */
  headers?:{[key:string]:string},
  /**
   * represents max number of redirects that candyget handles
   */
  maxRedirects?:number,
  /**
   * Request body
   */
  body?:any,
  /**
   * Prevent from using fetch API or passing custom fetch implementation
   */
  fetch?:boolean|{
    fetch:(url:string, init:any)=>any,
    AbortController:new () => any,
  },
};

export type CGResult<T extends keyof BodyTypes> = {
  statusCode:number,
  headers:IncomingHttpHeaders,
  body:BodyTypes[T],
  request:unknown,
  response:unknown,
  url:URL,
};

export type CGIntermmidiateParams<T extends keyof BodyTypes> = {
  method:HttpMethods,
  url:URL,
  returnType:T,
  overrideOptions:Opts,
  body:any|null,
};

export interface CandyGetPlugin {
  paramHook?:<T extends keyof BodyTypes>(d:CGIntermmidiateParams<T>)=>CGIntermmidiateParams<T>,
  resultHook?:<T extends keyof BodyTypes>(d:Promise<CGResult<T>>)=>Promise<CGResult<T>>,
}
