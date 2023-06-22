const http = require('http')
const request = require('request')
const fs = require('fs')
const path = require('path')
const baseDirectory = path.normalize(`__dirname/..`)   // or whatever base directory you want

const blockstreamAmpHost = process.env.BLOCKSTREAM_AMP_HOST

const port = process.env.PORT

function serveFile(requestUrl, response, mimeType) {
  try {
    // need to use path.normalize so people can't access directories underneath baseDirectory
    const fsPath = baseDirectory + path.normalize(requestUrl)

    const fileStream = fs.createReadStream(fsPath)
    fileStream.pipe(response)
    fileStream.on('open', function () {
      response.writeHead(200, { 'Content-Type': mimeType })
    })
    fileStream.on('error', function (e) {
      response.writeHead(404)     // assume the file doesn't exist
      response.end()
    })
  } catch (e) {
    response.writeHead(500)
    response.end()     // end the response so browsers don't hang
    console.log(e.stack)
  }
}

function serveApi(req, rsp) {
  const endpoint = new URL(req.url, 'https://' + blockstreamAmpHost)

  var reqBody = ''
  req.on('data', (d) => {
    reqBody += d.toString()
  })
  req.on('end', () => {
    request({
      "url": endpoint,
      "method": req.method,
      "headers": {
        "Content-Type": req.headers['content-type'],
        "Authorization": req.headers['authorization'] ? req.headers['authorization'] : ''
      },
      "body": reqBody
    }, (err, res, body) => {
      if (err) {
        console.error(err)
        rsp.writeHead(500)
        rsp.end()     // end the response so browsers don't hang
      } else {
        rsp.writeHead(200, { 'Content-Type': 'application/json' })
        rsp.write(body)
        rsp.end()
      }
    })
  })
}

function handleRequest(request, response) {
  const requestDirname = path.dirname(request.url)
  const requestBasename = path.basename(request.url).split('?')[0]

  switch (true) {
    case /^$/.test(requestBasename):
      serveFile('/client/index.html', response, 'text/html')
      break
    case /\.(ico)$/.test(requestBasename):
      serveFile(`/client/${requestBasename}`, response, 'image/x-icon')
      break
    case /\.(html)$/.test(requestBasename):
      serveFile(`/client/${requestBasename}`, response, 'text/html')
      break
    case /\.(css|css.map)$/.test(requestBasename):
      serveFile(`/client/css/${requestBasename}`, response, 'text/css')
      break
    case /\.(js|js.map)$/.test(requestBasename):
      serveFile(`/client/js/${requestBasename}`, response, 'application/javascript')
      break
    case /\/api\/[a-z0-9_\-\/\\?]+$/.test(requestDirname + '/' + requestBasename):
      serveApi(request, response)
      break
    default:
      console.log(`requesting ${request.url}`)
      response.end()
      break
  }
}

http.createServer(handleRequest).listen(port)

console.log(`listening on ${port}`)