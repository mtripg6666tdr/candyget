import assert from "assert";
import { expect } from "chai";
import fs from "fs";
import zlib from "zlib";
import path from "path";
import nock from "nock";
import candygetTS from "../src";
import crypto from "crypto";
import { Readable } from "stream";
import nodeFetch from "node-fetch";
import AbortController from "abort-controller";

console.log("Test running on", process.versions.node);

const candyget = (() => {
  try{
    return require("..");
  }
  catch{
    return candygetTS;
  }
})() as typeof candygetTS;

function nockUrl(path:string = "", http:boolean = false){
  return `http${http ? "" : "s"}://nocking-host.candyget${path}`;
}

function sha256Checksum(buf:Buffer|string){
  return crypto.createHash('sha256').update(buf).digest();
}

function genErrorObject(message:string){
  return {
    message,
    name: "CandyGetError"
  };
}

const JQUERY_HASH = "A6F3F0FAEA4B3D48E03176341BEF0ED3151FFBF226D4C6635F1C6039C0500575";
const VSCODE_PNG_HASH = "E7A0F94AF1BFF6E01E6A4C0C6297F2B2D3E1F7BAEDE6C98143E33728DBDA5ED0";

describe("CandyGet Tests", function(){
  this.beforeAll(async function(){
    this.timeout(50 * 500);
    let success = false;
    console.log("Waiting for Mock server...");
    for(let i = 1; i < 10; i++){
      console.log(".");
      await new Promise(resolve => setTimeout(resolve, 500 * i));
      success = await nodeFetch("http://localhost:8891/hello").then(res => res.ok);
      if(success) break;
    }
    if(!success) throw new Error("Mock server has not been ready in time");
    console.log("Mock server ready");

    candyget.defaultOptions.fetch = false;
    nock.disableNetConnect();
  });
  this.afterEach(function(){
    nock.cleanAll()
  });
  this.afterAll(() => new Promise(resolve => {
    nock.enableNetConnect();
    nodeFetch("http://localhost:8891/shutdown").then(res => res.text()).then(resolve);
  }));

  describe("#Http", function(){
    describe("#Get", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl("", true))
          .get("/get")
          .reply(200, "OK");
        const { statusCode } = await candyget(nockUrl("/get", true), "string");
        scope.done();
        assert.equal(statusCode, 200);
      });
    });
  });

  describe("#Methods", function(){
    describe("#Get", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .reply(200);
        const result = await candyget("GET", nockUrl("/get"), "string");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Get (implicit)", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .reply(200);
        const result = await candyget(nockUrl("/get"), "string");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Post", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl())
          .post("/post", JSON.stringify({
            a: 5,
          }))
          .reply(200);
        const result = await candyget("POST", nockUrl("/post"), "string", {}, JSON.stringify({
          a: 5,
        }));
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Post (implicit)", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl())
          .post("/post", JSON.stringify({
            b: 10,
          }))
          .reply(200);
        const result = await candyget(nockUrl("/post"), "string", {}, JSON.stringify({
          b: 10,
        }));
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Patch", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl())
          .patch("/patch")
          .reply(200);
        const result = await candyget("PATCH", nockUrl("/patch"), "string");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });
  });

  describe("#Request Body", function(){
    describe("#Buffer", function(){
      it("status code is ok", async function(){
        const data = [0x46, 0x61, 0x76, 0x66, 0x96, 0xa5, 0xff, 0x0];
        const scope = nock(nockUrl())
          .post("/post", Buffer.from(data))
          .reply(200);
        const result = await candyget(nockUrl("/post"), "empty", {}, Buffer.from(data));
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Stream", function(){
      it("status code is ok", async function(){
        const data = fs.readFileSync(path.join(__dirname, "./vscode.png"));
        const stream = Readable.from(data, {
          autoDestroy: true,
        });
        const scope = nock(nockUrl())
          .post("/post", data)
          .reply(200);
        const result = await candyget(nockUrl("/post"), "empty", {}, stream);
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(stream.destroyed, true);
      });
    });
  });

  describe("#Response Body", function(){
    describe("#Types", function(){
      describe("#String", function(){
        it("received body correctly", async function(){
          const scope = nock(nockUrl())
            .get("/plain")
            .reply(200, "foo bar");
          const result = await candyget("GET", nockUrl("/plain"), "string");
          scope.done();
          assert.equal(result.body, "foo bar");
        })
      });

      describe("#Buffer", function(){
        it("received body correctly", async function(){
          const bufferData = [0x55, 0x66, 0x77, 0x88, 0x99, 0xff];
          const scope = nock(nockUrl())
            .get("/buffer")
            .reply(200, Buffer.from(bufferData));
          const result = await candyget("GET", nockUrl("/buffer"), "buffer");
          scope.done();
          expect(result.body).to.deep.equal(Buffer.from(bufferData));
        })
      });

      describe("#Stream", function(){
        it("received body correctly", async function(){
          const scope = nock(nockUrl())
            .get("/stream")
            .reply(200, Readable.from("hello world"));
          const result = await candyget("GET", nockUrl("/stream"), "stream");
          scope.done();
          expect(result.body).has.a.property("on");
          const resultBuffer = await new Promise<Buffer>((resolve, reject) => {
            const buf:Buffer[] = [];
            result.body.on("data", chunk => buf.push(chunk));
            result.body.on("end", () => resolve(Buffer.concat(buf)));
            result.body.on("error", reject);
          });
          expect(resultBuffer).to.deep.equal(Buffer.from("hello world"));
        });
      });

      describe("#JSON", function(){
        it("received body correctly", async function(){
          const scope = nock(nockUrl())
            .get("/json")
            .reply(200, JSON.stringify({
              fooo: "baa",
              status: "ok",
              num: 5
            }));
          const result = await candyget("GET", nockUrl("/json"), "json");
          scope.done();
          expect(result.body).to.be.an("object").and.deep.equal({
            fooo: "baa",
            status: "ok",
            num: 5
          });
        })
      });

      describe("#Empty", function(){
        it("received body correctly", async function(){
          const scope = nock(nockUrl())
            .get("/empty")
            .reply(200, "nothing");
          const result = await candyget("GET", nockUrl("/empty"), "empty");
          scope.done();
          expect(result.body).is.a("null");
          expect(result.statusCode).equal(200);
        });
      });
    });

    describe("#Accuracy", function(){
      describe("Text", function(){
        it("Correct", async function(){
          const scope = nock(nockUrl())
            .get("/jquery.js")
            .reply(200, () => fs.createReadStream(path.join(__dirname, "./jquery.min.js")));
          const { body } = await candyget(nockUrl("/jquery.js"), "string");
          scope.done();
          assert.equal(sha256Checksum(body).toString("hex").toUpperCase(), JQUERY_HASH);
        });
      });

      describe("Binary", function(){
        it("Correct", async function(){
          const scope = nock(nockUrl())
            .get("/vscode.png")
            .reply(200, () => fs.createReadStream(path.join(__dirname, "./vscode.png")), {
              "Content-Type": "image/png",
            });
          const { body } = await candyget(nockUrl("/vscode.png"), "buffer");
          scope.done();
          assert.equal(sha256Checksum(body).toString("hex").toUpperCase(), VSCODE_PNG_HASH);
        });
      });
    });
  });

  describe("#Shorthand functions", function(){
    describe("#String", function(){
      it("received body correctly", async function(){
        const scope = nock(nockUrl())
        .get("/plain")
        .reply(200, "foo bar");
        const result = await candyget.string(nockUrl("/plain"));
        scope.done();
        assert.equal(result.body, "foo bar");
      })
    });

    describe("#Buffer", function(){
      it("received body correctly", async function(){
        const bufferData = [0x55, 0x66, 0x77, 0x88, 0x99, 0xff];
        const scope = nock(nockUrl())
          .get("/buffer")
          .reply(200, Buffer.from(bufferData));
        const result = await candyget.buffer(nockUrl("/buffer"));
        scope.done();
        expect(result.body).to.deep.equal(Buffer.from(bufferData));
      })
    });

    describe("#Stream", function(){
      it("received body correctly", async function(){
        const scope = nock(nockUrl())
          .get("/stream")
          .reply(200, Readable.from("hello world"));
        const result = await candyget.stream(nockUrl("/stream"));
        scope.done();
        expect(result.body).has.a.property("on");
        const resultBuffer = await new Promise<Buffer>((resolve, reject) => {
          const buf:Buffer[] = [];
          result.body.on("data", chunk => buf.push(chunk));
          result.body.on("end", () => resolve(Buffer.concat(buf)));
          result.body.on("error", reject);
        });
        expect(resultBuffer).to.deep.equal(Buffer.from("hello world"));
      });
    });

    describe("#JSON", function(){
      it("received body correctly", async function(){
        const scope = nock(nockUrl())
          .get("/json")
          .reply(200, JSON.stringify({
            fooo: "baa",
            status: "ok",
            num: 5
          }));
        const result = await candyget.json(nockUrl("/json"));
        scope.done();
        expect(result.body).to.be.an("object").and.deep.equal({
          fooo: "baa",
          status: "ok",
          num: 5
        });
      })
    });

    describe("#Empty", function(){
      it("received body correctly", async function(){
        const scope = nock(nockUrl())
          .get("/empty")
          .reply(200, "nothing");
        const result = await candyget.empty(nockUrl("/empty"));
        scope.done();
        expect(result.body).is.a("null");
        expect(result.statusCode).equal(200);
      });
    });

    describe("#Get", function(){
      it("status code is ok, body is fine", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .reply(200, "foo");
        const result = await candyget.get(nockUrl("/get"), "string");
        scope.done();
        assert.equal(result.body, "foo");
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Head", function(){
      it("status code is ok", async function(){
        const scope = nock(nockUrl())
          .head("/head")
          .reply(200);
        const result = await candyget.head(nockUrl("/head"));
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Post", function(){
      it("status code is ok, body is fine", async function(){
        const scope = nock(nockUrl())
          .post("/post", JSON.stringify({
            foo: "bar"
          }))
          .reply(200, "fine");
        const result = await candyget.post(nockUrl("/post"), "string", {}, {
          foo: "bar"
        });
        scope.done();
        assert.equal(result.body, "fine");
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Put", function(){
      it("status code is ok", async function(){
        const scope = nock(nockUrl())
          .put("/put", "PUT CONTENT")
          .reply(200);
        const result = await candyget.put(nockUrl("/put"), {}, "PUT CONTENT");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Delete", function(){
      it("status code is ok, body is fine", async function(){
        const scope = nock(nockUrl())
          .delete("/delete", "this is what to delete")
          .reply(200, "ok");
        const result = await candyget.delete(nockUrl("/delete"), "string", {}, "this is what to delete");
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(result.body, "ok");
      });
    });

    describe("#Options", function(){
      it("status code is ok, body is fine", async function(){
        const scope = nock(nockUrl())
          .options("/options")
          .reply(200, "finefinefine");
        const result = await candyget.options(nockUrl("/options"), "string");
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(result.body, "finefinefine");
      });
    });

    describe("#Trace", function(){
      it("status code is ok", async function(){
        const scope = nock(nockUrl())
          .intercept("/trace", "TRACE")
          .reply(200, undefined, {
            "Content-Type": "message/http"
          });
        const result = await candyget.trace(nockUrl("/trace"));
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(result.headers["content-type"], "message/http");
      });
    });

    describe("#Patch", function(){
      it("status code is ok, body is fine", async function(){
        const scope = nock(nockUrl())
          .patch("/patch", "this is correct")
          .reply(200, "correct content");
        const result = await candyget.patch(nockUrl("/patch"), "string", {}, "this is correct");
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(result.body, "correct content");
      });
    });
  });

  describe("#Decompress", function(){
    describe("#gzip", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/gzip")
          .reply(200, () => fs.createReadStream(path.join(__dirname, "./jquery.min.js")).pipe(zlib.createGzip()), {
            "Content-Encoding": "gzip"
          });
        const result = await candyget(nockUrl("/gzip"), "string");
        scope.done();
        assert.equal(sha256Checksum(result.body).toString("hex").toUpperCase(), JQUERY_HASH);
      });
    });

    describe("#br", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/gzip")
          .reply(200, () => fs.createReadStream(path.join(__dirname, "./jquery.min.js")).pipe(zlib.createBrotliCompress()), {
            "Content-Encoding": "br"
          });
        const result = await candyget(nockUrl("/gzip"), "string");
        scope.done();
        assert.equal(sha256Checksum(result.body).toString("hex").toUpperCase(), JQUERY_HASH);
      });
    });

    describe("#deflate", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/gzip")
          .reply(200, () => fs.createReadStream(path.join(__dirname, "./jquery.min.js")).pipe(zlib.createDeflate()), {
            "Content-Encoding": "deflate"
          });
        const result = await candyget(nockUrl("/gzip"), "string");
        scope.done();
        assert.equal(sha256Checksum(result.body).toString("hex").toUpperCase(), JQUERY_HASH);
      });
    });

    describe("#gzip identity", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/gzip")
          .reply(200, () => fs.createReadStream(path.join(__dirname, "./jquery.min.js")).pipe(zlib.createGzip()), {
            "Content-Encoding": "gzip, identity",
          });
        const result = await candyget(nockUrl("/gzip"), "string");
        scope.done();
        assert.equal(sha256Checksum(result.body).toString("hex").toUpperCase(), JQUERY_HASH);
      });
    });

    describe("#deflate gzip", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/deflate-gzip")
          .reply(
            200,
            () => fs.createReadStream(path.join(__dirname, "./jquery.min.js"))
              .pipe(zlib.createDeflate())
              .pipe(zlib.createGzip()),
            {
              "Content-Encoding": "deflate, gzip",
            }
          );
        const result = await candyget(nockUrl("/deflate-gzip"), "string");
        scope.done();
        assert.equal(sha256Checksum(result.body).toString("hex").toUpperCase(), JQUERY_HASH);
      });
    });

    describe("#deflate gzip", function(){
      it("correct body", async function(){
        const scope = nock(nockUrl())
          .get("/unknown")
          .reply(
            200,
            () => Buffer.from(Array.from({length: 7}, (_, i) => 36 * i)),
            {
              "Content-Encoding": "super-compression, identity"
            }
          );
        const result = await candyget(nockUrl("/unknown"), "buffer");
        scope.done();
        expect(result.body).to.deep.equal(Buffer.from(Array.from({length: 7}, (_, i) => 36 * i)));
      });
    });
  });

  describe("#Sending Default Headers", function(){
    it("Status Code is ok", async function(){
      const scope = nock(nockUrl(), {
        reqheaders: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "accept-Language": "*",
          "accept-encoding": "gzip, deflate, br",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Candyget/0.0.0",
        }
      })
        .get("/get")
        .reply(200);
      const result = await candyget.json(nockUrl("/get"));
      scope.done();
      assert.equal(result.statusCode, 200);
    });
  });

  describe("#Passing URL object instead of string", function(){
    it("Status Code is ok", async function(){
      const scope = nock(nockUrl())
        .get("/get")
        .reply(200);
      const result = await candyget(new URL(nockUrl("/get")), "string");
      scope.done();
      assert.equal(result.statusCode, 200);
    });
  });

  describe("#Automated Method Selecting", function(){
    it("Status Code is ok", async function(){
      const scope = nock(nockUrl())
        .post("/post", JSON.stringify({
          test: true
        }))
        .reply(200);
      const result = await candyget(nockUrl("/post"), "json", null, JSON.stringify({
        test: true,
      }));
      scope.done();
      assert.equal(result.statusCode, 200);
    });
  });

  describe("#Automated JSON Stringifying", function(){
    it("Status Code is ok", async function(){
      const scope = nock(nockUrl())
        .post("/post", JSON.stringify({
          b: 10,
        }))
        .reply(200);
      const result = await candyget(nockUrl("/post"), "string", {}, {
        b: 10,
      });
      scope.done();
      assert.equal(result.statusCode, 200);
    });
  });

  describe("#Options", function(){
    describe("#Custom Headers", function(){
      it("Status Code is ok", async function(){
        const scope = nock(nockUrl(), {
          reqheaders: {
            "x-requested-with": "XmlHttpRequest",
            "x-for-test": "1",
          }
        })
          .get("/get")
          .reply(200);
        const result = await candyget(nockUrl("/get"), "json", {
          headers: {
            "x-requested-with": "XmlHttpRequest",
            "X-for-test": "1",
          }
        });
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Timeout", function(){
      it("Error", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .delay(1000)
          .reply(200, "foo");
        await assert.rejects(candyget(nockUrl("/get"), "string", {
          timeout: 500
        }), genErrorObject("timed out"));
        scope.done();
      });
    });
  
    describe("#Redirect", function(){
      it("Handle correctly in the same host", async function(){
        const scope = nock(/^https:\/\/example-redir.\.com/)
          .get("/redirect")
          .reply(302, undefined, {
            "Location": "/ok"
          })
          .get("/ok")
          .reply(200);
        const result = await candyget("https://example-redir0.com/redirect", "string");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
  
      it("Handle correctly in a different host", async function(){
        const scope = nock(/^https:\/\/example-redir.\.com/)
          .get("/redirect-to-other-domain")
          .reply(302, undefined, {
            "Location": "https://example-redir2.com/ok"
          })
          .get("/ok")
          .reply(200);
        const result = await candyget("https://example-redir0.com/redirect-to-other-domain", "string");
        scope.done();
        assert.equal(result.url.host, "example-redir2.com");
      });

      it("Handle correctly in a different host on POST method", async function(){
        const scope = nock(/^https:\/\/example-redir.\.com/)
          .post("/redirect-to-other-domain", "some content", {
            reqheaders:  {
              "Host": "example-redir0.com",
              "Content-Type": "application/x-some-content",
              "Content-Length": Buffer.byteLength("some content").toString(),
            }
          })
          .reply(302, undefined, {
            "Location": "https://example-redir2.com/ok"
          })
          .get("/ok", undefined, {
            reqheaders: {
              "Host": "example-redir2.com",
            },
            badheaders: ["Content-Type", "Content-Length"]
          })
          .reply(200);
        const result = await candyget("https://example-redir0.com/redirect-to-other-domain", "string", {
          headers: {
            "Host": "example-redir0.com",
            "Content-Type": "application/x-some-content"
          }
        }, "some content");
        scope.done();
        assert.equal(result.url.host, "example-redir2.com");
      });
  
      describe("prevent from redirecting", function(){
        it("status code is 302, parsing the body successfully", async function(){
          const scope = nock(nockUrl())
            .get("/redirect")
            .reply(302, "redirected", {
              "Location": "/redirect-to"
            });
          const result = await candyget(nockUrl("/redirect"), "string", {
            maxRedirects: 0
          });
          scope.done();
          assert.equal(result.statusCode, 302);
          assert.equal(result.headers.location, nockUrl("/redirect-to"))
          assert.equal(result.body, "redirected");
        });
      });

      describe("limit redirecting", function(){
        it("status code is 302, parsing the body successfully", async function(){
          const scope = nock(nockUrl())
            .get("/path1")
            .reply(302, "redirected", {
              "Location": "/path2"
            })
            .get("/path2")
            .reply(302, "redirected", {
              "Location": "/path3"
            })
            .get("/path3")
            .reply(302, "redirected", {
              "Location": "/path4"
            })
          const result = await candyget(nockUrl("/path1"), "string", {
            maxRedirects: 2
          });
          scope.done();
          assert.equal(result.statusCode, 302);
          assert.equal(result.url.pathname, "/path3");
          assert.equal(result.body, "redirected");
          assert.equal(result.headers.location, nockUrl("/path4"));
        });
      });
  
      describe("no location header", function(){
        it("Error", async function(){
          const scope = nock(nockUrl())
            .get("/redirect")
            .reply(302, "redirected");
          await assert.rejects(candyget(nockUrl("/redirect"), "string"), genErrorObject("no location header found"));
          scope.done();
        });
      });
    });

    describe("#Body", function(){
      it("Status code is ok", async function(){
        const scope = nock(nockUrl())
          .post("/post", "some big content")
          .reply(200, "ok");
        const result = await candyget(nockUrl("/post"), "string", {
          body: "some big content"
        });
        scope.done();
        assert.equal(result.statusCode, 200);
      });

      describe("override body params", function(){
        it("Status code is ok", async function(){
          const scope = nock(nockUrl())
            .post("/post", "some big content")
            .reply(200, "ok");
          const result = await candyget(nockUrl("/post"), "string", {
            body: "some wrong content",
          } as {}, "some big content");
          scope.done();
          assert.equal(result.statusCode, 200);
        });
      });
    });

    type TestStruct = {
      num: number,
      text: string,
    };

    describe("#Validator", function(){
      it("body typed correctly", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .reply(200, JSON.stringify({
            num: 5,
            text: "five"
          }));
        const result = await candyget<TestStruct>(nockUrl("/get"), "json", {
          validator(responseBody):responseBody is TestStruct {
            return typeof responseBody.num === "number" && typeof responseBody.text === "string"
          },
        });
        scope.done();
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.num, 5);
        assert.equal(result.body.text, "five");
      });

      it("invalid typed body", async function(){
        const scope = nock(nockUrl())
          .get("/get")
          .reply(200, JSON.stringify({
            error: 1104
          }));
        await assert.rejects(candyget<TestStruct>(nockUrl("/get"), "json", {
          validator(responseBody):responseBody is TestStruct {
            return typeof responseBody.num === "number" && typeof responseBody.text === "string"
          },
        }), genErrorObject("invalid response body"));
        scope.done();
      });

      describe("#Shorthand functions", function(){
        describe("#json", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .get("/get")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.json<TestStruct>(nockUrl("/get"), {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            });
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });

        describe("#get", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .get("/get")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.get<TestStruct>(nockUrl("/get"), "json", {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            });
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });

        describe("#post", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .post("/post", "post content")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.post<TestStruct>(nockUrl("/post"), "json", {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            }, "post content");
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });

        describe("#delete", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .delete("/delete", "post content")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.delete<TestStruct>(nockUrl("/delete"), "json", {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            }, "post content");
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });

        describe("#options", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .options("/options")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.options<TestStruct>(nockUrl("/options"), "json", {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            });
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });

        describe("#patch", function(){
          it("typed body is fine", async function(){
            const scope = nock(nockUrl())
              .patch("/patch", "patch content")
              .reply(200, JSON.stringify({
                num: 5,
                text: "five"
              }));
            const result = await candyget.patch<TestStruct>(nockUrl("/patch"), "json", {
              validator(responseBody):responseBody is TestStruct {
                return typeof responseBody.num === "number" && typeof responseBody.text === "string"
              },
            }, "patch content");
            scope.done();
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.num, 5);
            assert.equal(result.body.text, "five");
          });
        });
      });
    });
  });

  describe("#DefaultOptions", function(){
    const originalDefaultOptions = Object.assign({}, candyget.defaultOptions);
    this.afterEach(() => {
      Object.assign(candyget.defaultOptions, originalDefaultOptions);
    });

    describe("#Custom headers", function(){
      it("Status Code is ok", async function(){
        candyget.defaultOptions.headers = Object.assign(candyget.defaultOptions.headers || {}, {
          "x-requested-with": "XmlHttpRequest",
          "X-for-test": "1",
        });
        const scope = nock(nockUrl(), {
          reqheaders: {
            "x-requested-with": "XmlHttpRequest",
            "x-for-test": "1",
          }
        })
          .get("/get")
          .reply(200);
        const result = await candyget(nockUrl("/get"), "json");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Overriden custom headers", function(){
      it("Status Code is ok", async function(){
        candyget.defaultOptions.headers = Object.assign(candyget.defaultOptions.headers || {}, {
          "x-requested-with": "NoXmlHttpRequest",
          "X-for-test": "-1",
        });
        const scope = nock(nockUrl(), {
          reqheaders: {
            "x-requested-with": "XmlHttpRequest",
            "x-for-test": "1",
            "accept": "*/*",
          }
        })
          .get("/get")
          .reply(200);
        const result = await candyget(nockUrl("/get"), "json", {
          headers: {
            "x-requested-with": "XmlHttpRequest",
            "X-for-test": "1",
            "Accept": "*/*",
          }
        });
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#No default custom headers", function(){
      it("Status Code is ok", async function(){
        delete candyget.defaultOptions.headers;
        const scope = nock(nockUrl(), {
          badheaders: ["content-type", "accept", "accept-encoding", "accept-language", "user-agent"]
        })
          .get("/get")
          .reply(200);
        const result = await candyget(nockUrl("/get"), "json");
        scope.done();
        assert.equal(result.statusCode, 200);
      });
    });

    describe("#Timeout", function(){
      it("Error", async function(){
        candyget.defaultOptions.timeout = 500;
        const scope = nock(nockUrl())
          .get("/get")
          .delay(1000)
          .reply(200, "foo");
        await assert.rejects(candyget(nockUrl("/get"), "string"), genErrorObject("timed out"));
        scope.done();
      });
    });
  
    describe("#Redirect", function(){
      describe("prevent from redirecting", function(){
        it("status code is 302, parsing the body successfully", async function(){
          candyget.defaultOptions.maxRedirects = 0;
          const scope = nock(nockUrl())
            .get("/redirect")
            .reply(302, "redirected", {
              "Location": "/redirect-to"
            });
          const result = await candyget(nockUrl("/redirect"), "string");
          scope.done();
          assert.equal(result.statusCode, 302);
          assert.equal(result.headers.location, nockUrl("/redirect-to"))
          assert.equal(result.body, "redirected");
        });
      });
    });
  });

  describe("#Invalid Params", function(){
    describe("#Method", function(){
      it("Error", async function(){
        await assert.rejects(candyget("INVALID_METHOD" as unknown as "GET", "http://example.com", "empty"), genErrorObject("Invalid Param:method"));
      });
    });

    describe("#URL (invalid path)", function(){
      it("Error", async function(){
        await assert.rejects(candyget("file:///path/to/file.txt", "stream"), genErrorObject("Invalid Param:url"));
      });
    });

    describe("#URL (invalid path, with method)", function(){
      it("Error", async function(){
        await assert.rejects(candyget("GET", "file:///path/to/file.txt", "stream"), genErrorObject("Invalid Param:url"));
      });
    });

    describe("#URL (invalid object)", function(){
      it("Error", async function(){
        await assert.rejects(candyget(new (class NotUrl {})() as unknown as URL, "stream"), genErrorObject("Invalid Param:url"));
      });
    });

    describe("#URL (invalid object, with method)", function(){
      it("Error", async function(){
        await assert.rejects(candyget("GET", new (class NotUrl {})() as unknown as URL, "stream"), genErrorObject("Invalid Param:url"));
      });
    });

    describe("#Return Type", function(){
      it("Error", async function(){
        await assert.rejects(candyget("https://example.com", "foo" as unknown as "string"), genErrorObject("Invalid Param:returnType"));
      });
    });

    describe("#Return Type (with method)", function(){
      it("Error", async function(){
        await assert.rejects(candyget("GET", "https://example.com", "foo" as unknown as "string"), genErrorObject("Invalid Param:returnType"));
      });
    });

    describe("#Options", function(){
      it("Error", async function(){
        await assert.rejects(
          candyget("https://example.com", "string", Symbol.for("invalid object") as unknown as {}),
          genErrorObject("Invalid Param:options")
        );
      });

      it("Error (with method)", async function(){
        await assert.rejects(
          candyget("GET", "https://example.com", "string", Symbol.for("invalid object") as unknown as {}),
          genErrorObject("Invalid Param:options")
        );
      });

      describe("timeout", function(){
        it("not a number type; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            timeout: "foo" as unknown as number,
          }), genErrorObject("Invalid Param:timeout"));
        });

        it("minus number; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            timeout: -10,
          }), genErrorObject("Invalid Param:timeout"));
        });

        it("zero; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            timeout: 0,
          }), genErrorObject("Invalid Param:timeout"));
        });

        it("NaN; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            timeout: NaN,
          }), genErrorObject("Invalid Param:timeout"));
        });
      });

      describe("maxRedirects", function(){
        it("not a number type; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: "foo" as unknown as number,
          }), genErrorObject("Invalid Param:maxRedirects"));
        });

        it("minus number; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: -10,
          }), genErrorObject("Invalid Param:maxRedirects"));
        });

        it("NaN; Error", async function(){
          await assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: NaN,
          }), genErrorObject("Invalid Param:maxRedirects"));
        });
      });
    });

    describe("#Body that occurs an error", async function(){
      it("Error", async function(){
        nock(nockUrl())
          .post("/validate")
          .reply(200);
        const file = new Readable({
          read(){
            this.destroy(new Error("some error!"));
          }
        });
        await assert.rejects(candyget(nockUrl("/validate"), "string", {}, file));
        file.destroy();
      });
    });
  });

  describe("#Fetch API", function(){
    // @ts-expect-error 2322
    let fromWeb:typeof Readable.fromWeb = null;
    this.beforeAll(() => {
      nock.enableNetConnect();
      fromWeb = Readable.fromWeb;
    });
    this.afterAll(() => {
      delete candyget.defaultOptions.fetch;
      nock.disableNetConnect();
      Readable.fromWeb = fromWeb;
    });

    function testFetch(tag:string, fetchImplement?:any, disableFromWeb:boolean = false){
      describe(tag, function(){
        this.timeout(10 * 1000);
        this.beforeAll(() => {
          candyget.defaultOptions.fetch = fetchImplement ? {
            fetch: fetchImplement,
            AbortController: AbortController
          } : true;
          if(disableFromWeb){
            // @ts-expect-error 2322
            delete Readable.fromWeb
          }
        });
        
        describe("#Get", function(){
          it("request is fine", async function(){
            const result = await candyget("http://localhost:8891/get", "json", {
              headers: {
                "X-Custom-Header": "1"
              }
            });
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.headers["x-custom-header"], 1);
          });
        });

        describe("#Post", function(){
          it("request is fine", async function(){
            const result = await candyget.post("http://localhost:8891/post", "json", {}, Readable.from(Buffer.from("foo bar request here")));
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.data, "foo bar request here");
          });
        });

        describe("#Post (Object mode stream)", function(){
          it("request is fine", async function(){
            const result = await candyget.post("http://localhost:8891/post", "json", {}, Readable.from("foo bar request here"));
            assert.equal(result.statusCode, 200);
            assert.equal(result.body.data, "foo bar request here");
          });
        });

        describe("#Head", function(){
          it("request is fine", async function(){
            const result = await candyget.head("http://localhost:8891/get");
            assert.equal(result.statusCode, 200);
          });
        });

        describe("#Patch (No content)", function(){
          it("request is fine", async function(){
            const result = await candyget.patch("http://localhost:8891/patch", "json", {}, "some patch content");
            assert.equal(result.statusCode, 204);
            assert.strictEqual(result.body, "");
          });
        });

        describe("#Redirect", function(){
          it("response is 302", async function(){
            const result = await candyget.empty("http://localhost:8891/absolute-redirect/10", {
              maxRedirects: 2
            });
            assert.equal(result.statusCode, 302);
          });

          it("response is 200", async function(){
            const result = await candyget.stream("http://localhost:8891/absolute-redirect/0");
            assert.equal(result.statusCode, 200);
            const bufs:Buffer[] = [];
            result.body.on("data", chunk => bufs.push(chunk));
            result.body.on("end", () => {
              const resp = JSON.parse(Buffer.concat(bufs).toString());
              assert.ok(resp.args);
            })
          });
        });

        describe("#Invalid URL", function(){
          it("Error", async function(){
            await assert.rejects(candyget("http://thisisnotexistshost.foobar/", "json"));
          });
        });

        describe("#Time out", function(){
          it("request is fine", async function(){
            await assert.rejects(candyget("http://localhost:8891/delay", "string", {
              timeout: 500
            }), genErrorObject("timed out"));
          });
        });
      });
    }

    testFetch("Default");
    testFetch("node-fetch", nodeFetch);
    testFetch("node-fetch, but body is null when HEAD", new Proxy(nodeFetch, {
      apply(target, thisArg, argArray) {
        const promise = Reflect.apply(target, thisArg, argArray) as ReturnType<typeof nodeFetch>;
        return promise.then(res => new Proxy(res, {
          get(target, p, receiver) {
            return (argArray[1]?.method?.toLowerCase() === "head" || res.status == 204) && p === "body" ? null : Reflect.get(target, p, receiver);
          },
        }));
      },
    }))
    testFetch("Default without fromWeb", undefined, true);

    describe("#Invalid fetch implementation", function(){
      it("fetch throws an error", async function(){
        await assert.rejects(candyget("http://localhost:8891/get", "json", {
          fetch: {
            fetch(){
              return Promise.reject(new Error("This method is not implemented"));
            },
            AbortController,
          }
        }), {
          message: "This method is not implemented"
        });
      });

      it("fetch throws a string", async function(){
        await assert.rejects(candyget("http://localhost:8891/get", "json", {
          fetch: {
            fetch(){
              return Promise.reject("This method is not implemented");
            },
            AbortController,
          }
        }));
      });
    });
  });
});
