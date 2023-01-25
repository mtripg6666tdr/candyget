import http from "http";

const server = http.createServer((req, res) => {
  if(req.url === "/shutdown"){
    server.close();
    res.end("OK");
  }else if(req.url === "/hello"){
    res.end("hello");
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
  }
  res.writeHead(400);
  res.end();
}).listen(8891);
