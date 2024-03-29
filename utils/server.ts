import http from "http";

const server = http.createServer((req, res) => {
  if(req.url === "/shutdown"){
    console.log("Shutdown test mock server...");
    server.close(() => {
      console.log("Test mock server shutdown completed");
      process.exit(0);
    });
    res.end("OK");
    return;
  }else if(req.url === "/hello"){
    console.log("Triggered Server Hello");
    res.end("hello");
    return;
  } if(req.url === "/get" && req.method === "GET"){
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({
      headers: req.headers,
      args: "this is an arg",
    }));
    return;
  }else if(req.url === "/get" && req.method === "HEAD"){
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end();
    return;
  }else if(req.url === "/post" && req.method === "POST"){
    const buf:Buffer[] = [];
    req.on("data", chunk => buf.push(chunk));
    req.on("end", () => {
      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({
        headers: req.headers,
        data: Buffer.concat(buf).toString(),
      }));
    });
    return;
  }else if(req.url === "/patch" && req.method === "PATCH"){
    res.writeHead(204);
    res.end();
    return;
  }else if(req.url === "/absolute-redirect/0"){
    res.writeHead(302, {
      "Location": "/get"
    });
    res.end();
    return;
  }else if(req.url!.startsWith("/absolute-redirect/")){
    const last = Number(req.url!.split("/absolute-redirect/")[1]) - 1;
    res.writeHead(302, {
      "Location": "/absolute-redirect/" + last.toString(),
    });
    res.end();
    return;
  }else if(req.url === "/delay" && req.method === "GET"){
    setTimeout(() => {
      if(!res.destroyed){
        res.writeHead(200);
        res.end("OK!");
      }
    }, 10 * 1000);
    return;
  }else{
    res.writeHead(400);
    res.end();
  }
}).listen(8891).once("listening", () => {
  console.log("Test mock server started listening");
});
