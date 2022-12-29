const assert = require("assert");
const candyget = require("..");
const crypto = require("crypto");

function sha256Checksum(buf){
  return crypto.createHash('sha256').update(buf).digest();
}

describe("CandyGet Tests", function(){
  describe("#Http Get", function(){
    const url = "http://httpbin.org/get";
    it("Status Code", async function(){
      const { statusCode } = await candyget(url, "string");
      assert.equal(statusCode, 200);
    });
  });

  describe("#Get", function(){
    const url = "https://httpbin.org/get";
    const promise = candyget(url, "json");

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });

    it("Accept-Encoding", async function(){
      assert.equal((await promise).body.headers["Accept-Encoding"], "gzip, deflate, br");
    });
  });

  describe("#Shorthand", function(){
    const url = "https://httpbin.org/get";
    const promise = candyget.json(url);

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });

    it("Accept-Encoding", async function(){
      assert.equal((await promise).body.headers["Accept-Encoding"], "gzip, deflate, br");
    });
  });

  describe("#Patch", function(){
    const url = "https://httpbin.org/patch";
    const promise = candyget("PATCH", url, "string");

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });
  });

  describe("#Automated Method Selecting", function(){
    const url = "https://httpbin.org/post";
    const promise = candyget(url, "json", null, JSON.stringify({
      test: true,
    }));

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });

    it("Body", async function(){
      assert.equal(JSON.parse((await promise).body?.data || {}).test, true);
    });
  });

  describe("#Automated JSON stringifying", function(){
    const url = "https://httpbin.org/post";
    const promise = candyget(url, "json", null, {
      test: true,
    });

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });

    it("Body", async function(){
      assert.equal(JSON.parse((await promise).body?.data || {}).test, true);
    });

    it("Content-Type", async function(){
      assert.equal((await promise).body?.headers?.["Content-Type"], "application/json");
    });
  });

  describe("#Custom Headers", function(){
    const url = "https://httpbin.org/post";
    const promise = candyget(url, "json", {
      headers: {
        "X-Requested-With": "XmlHttpRequest",
        "X-For-Test": "1",
      }
    }, {
      test: true,
    });

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });

    it("Body", async function(){
      assert.equal(JSON.parse((await promise).body?.data || {}).test, true);
    });

    it("Custom Header", async function(){
      assert.equal((await promise).body?.headers?.["X-Requested-With"], "XmlHttpRequest");
      assert.equal((await promise).body?.headers?.["X-For-Test"], "1");
    });
  });

  describe("#Redirect", function(){
    const url = "https://httpbin.org/redirect-to?url=https%3A%2F%2Fhttpbin.org%2Fget&status_code=302";
    const promise = candyget(url, "json");

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 200);
    });
  });

  describe("#Prevent from redirecting", function(){
    const url = "https://httpbin.org/redirect-to?url=https%3A%2F%2Fhttpbin.org%2Fget&status_code=302";
    const promise = candyget(url, "json", {
      maxRedirects: 0,
    });

    it("Status Code", async function(){
      assert.equal((await promise).statusCode, 302);
    });
  });

  describe("#Download text file", function(){
    const url = "https://cdn.jsdelivr.net/npm/jquery@3.6.3/dist/jquery.min.js";

    it("Correct", async function(){
      const { body } = await candyget(url, "string");
      assert.equal(sha256Checksum(body).toString("hex").toUpperCase(), "A6F3F0FAEA4B3D48E03176341BEF0ED3151FFBF226D4C6635F1C6039C0500575");
    });
  });

  describe("#Download binary file", function(){
    const url = "https://user-images.githubusercontent.com/35271042/118224532-3842c400-b438-11eb-923d-a5f66fa6785a.png";

    it("Correct", async function(){
      const { body } = await candyget(url, "buffer");
      assert.equal(sha256Checksum(body).toString("hex").toUpperCase(), "E7A0F94AF1BFF6E01E6A4C0C6297F2B2D3E1F7BAEDE6C98143E33728DBDA5ED0");
    });
  });

  describe("#Invalid URL", function(){
    it("Error", async function(){
      assert.rejects(candyget.bind(undefined, "file:///path/to/file.txt", "stream"));
    });
  });
});
