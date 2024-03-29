import http from "http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import * as crypto from "crypto";

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    type(req) {
      return true;
    },
  })
);
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

const userState = [];
app.post("/new-user", async (request, response) => {
  if (Object.keys(request.body).length === 0) {
    const result = {
      status: "error",
      message: "This name is already taken!",
    };
    response.status(400).send(JSON.stringify(result)).end();
  }
  const { name } = request.body;
  const isExist = userState.find((user) => user.name === name);
  if (!isExist) {
    const newUser = {
      id: crypto.randomUUID(),
      name: name,
    };
    userState.push(newUser);
    console.log(`User entered the chat and saved on the server: ${JSON.stringify(newUser)}`);
    const result = {
      status: "ok",
      user: newUser,
    };
    response.send(JSON.stringify(result)).end();
  } else {
    const result = {
      status: "error",
      message: "This name is already taken!",
    };
    response.status(409).send(JSON.stringify(result)).end();
  }
});

app.get('/users', (req, res) => {
  res.send(JSON.stringify(userState)).end();
});

app.get('/user/:id', (req, res) => {
  const user = userState.find(user => user.id === req.params.id);
  if (user) {
    res.send(JSON.stringify(user)).end();
  } else {
    res.status(404).send(JSON.stringify({ status: 'error', message: 'User not found!' })).end();
  }
});

app.put('/user/:id', (req, res) => {
  const { name } = req.body;
  const user = userState.find(user => user.id === req.params.id);
  if (user) {
    user.name = name;
    res.send(JSON.stringify(user)).end();
  } else {
    res.status(404).send(JSON.stringify({ status: 'error', message: 'User not found!'})).end();
  }
});

app.delete('/user/:id', (req, res) => {
  const index = userState.findIndex(user => user.id === req.params.id);
  if (index !== -1) {
    userState.splice(index, 1);
    res.send(JSON.stringify({ status: 'ok', message: 'User deleted successfully!'})).end();
  } else {
    res.status(404).send(JSON.stringify({ status: 'error', message: 'User not found'})).end();
  }
});


const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });
wsServer.on("connection", (ws) => {
  let currentUser = null;

  ws.on("message", (msg, isBinary) => {
    const receivedMSG = JSON.parse(msg);
    console.dir(receivedMSG);
    if (receivedMSG.type === "send") {
      if (receivedMSG.user && receivedMSG.user.id) {
        currentUser = receivedMSG.user.id;
      }
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(msg, { binary: isBinary }));
    }
  });

  ws.on('close', () => {
    const idx = userState.findIndex((user) => user.id === currentUser);
    if (idx !== -1) {
      console.log(`User exited the chat and removed from the server: ${JSON.stringify(userState[idx])}`);
      userState.splice(idx, 1);
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => o.send(JSON.stringify(userState)));
    }
  });

  [...wsServer.clients]
    .filter((o) => o.readyState === WebSocket.OPEN)
    .forEach((o) => o.send(JSON.stringify(userState)));
});

const port = process.env.PORT || 3000;

const bootstrap = async () => {
  try {
    server.listen(port, () =>
      console.log(`Server has been started on http://localhost:${port}`)
    );
  } catch (error) {
    console.error(error);
  }
};

bootstrap();
