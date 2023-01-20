import assert from "assert";
import { expect } from "chai";
import fs from "fs";
import zlib from "zlib";
import path from "path";
import nock from "nock";
import candyget from "..";
import crypto from "crypto";
import { Readable } from "stream";

nock.disableNetConnect();

function nockUrl(path:string = "", http:boolean = false){
  return `http${http ? "" : "s"}://nocking-host.candyget${path}`;
}

function sha256Checksum(buf:Buffer|string){
  return crypto.createHash('sha256').update(buf).digest();
}

const JQUERY_HASH = "A6F3F0FAEA4B3D48E03176341BEF0ED3151FFBF226D4C6635F1C6039C0500575";
const VSCODE_PNG_HASH = "E7A0F94AF1BFF6E01E6A4C0C6297F2B2D3E1F7BAEDE6C98143E33728DBDA5ED0";

describe("CandyGet Tests", function(){
  this.afterEach(() => nock.cleanAll())

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

  describe("#Body", function(){
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

  describe("#Shorthand", function(){
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
  });

  describe("#Sending Default Headers", function(){
    it("Status Code is ok", async function(){
      const scope = nock(nockUrl(), {
        reqheaders: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "accept-encoding": "gzip, deflate, br",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
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
        })).then(() => scope.done());
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
          assert.equal(result.headers.location, "/redirect-to")
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
          assert.equal(result.headers.location, "/path4");
        });
      });
  
      describe("no location header", function(){
        it("Error", async function(){
          const scope = nock(nockUrl())
            .get("/redirect")
            .reply(302, "redirected");
          await assert.rejects(candyget(nockUrl("/redirect"), "string"));
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
          }, {
            body: "some big content",
          });
          scope.done();
          assert.equal(result.statusCode, 200);
        });
      });
    });
  });

  describe("#DefaultOptions", function(){
    const originalDefaultOptions = Object.assign({}, candyget.defaultOptions);
    this.afterEach(() => {
      Object.assign(candyget.defaultOptions, originalDefaultOptions);
    });

    describe("#Custom Headers", function(){
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

    describe("#Timeout", function(){
      it("Error", async function(){
        candyget.defaultOptions.timeout = 500;
        const scope = nock(nockUrl())
          .get("/get")
          .delay(1000)
          .reply(200, "foo");
        await assert.rejects(candyget(nockUrl("/get"), "string")).then(() => scope.done());
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
          assert.equal(result.headers.location, "/redirect-to")
          assert.equal(result.body, "redirected");
        });
      });
    });
  });

  describe("#Invalid Params", function(){
    describe("#Method", function(){
      it("Error", async function(){
        assert.rejects(candyget("INVALID_METHOD" as unknown as "GET", "http://example.com", "empty"));
      });
    });

    describe("#URL (invalid path)", function(){
      it("Error", async function(){
        assert.rejects(candyget("file:///path/to/file.txt", "stream"));
      });
    });

    describe("#URL (invalid path, with method)", function(){
      it("Error", async function(){
        assert.rejects(candyget("GET", "file:///path/to/file.txt", "stream"));
      });
    });

    describe("#URL (invalid object)", function(){
      it("Error", async function(){
        assert.rejects(candyget(new (class NotUrl {})() as unknown as URL, "stream"));
      });
    });

    describe("#URL (invalid object, with method)", function(){
      it("Error", async function(){
        assert.rejects(candyget("GET", new (class NotUrl {})() as unknown as URL, "stream"));
      });
    });

    describe("#Return Type", function(){
      it("Error", async function(){
        assert.rejects(candyget("https://example.com", "foo" as unknown as "string"));
      });
    });

    describe("#Return Type (with method)", function(){
      it("Error", async function(){
        assert.rejects(candyget("GET", "https://example.com", "foo" as unknown as "string"));
      });
    });

    describe("#Options", function(){
      it("Error", async function(){
        assert.rejects(candyget("https://example.com", "string", Symbol.for("invalid object") as unknown as {}))
      });

      it("Error (with method)", async function(){
        assert.rejects(candyget("GET", "https://example.com", "string", Symbol.for("invalid object") as unknown as {}))
      });

      describe("timeout", function(){
        it("not a number type; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            timeout: "foo" as unknown as number,
          }));
        });

        it("minus number; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            timeout: -10,
          }));
        });

        it("zero; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            timeout: 0,
          }));
        });

        it("NaN; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            timeout: NaN,
          }));
        });
      });

      describe("maxRedirects", function(){
        it("not a number type; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: "foo" as unknown as number,
          }));
        });

        it("minus number; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: -10,
          }));
        });

        it("NaN; Error", async function(){
          assert.rejects(candyget("https://example.com", "string", {
            maxRedirects: NaN,
          }));
        });
      })
    })
  });
});
