require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { getDb } = require('./config/db');
const apiRoutes = require('./routes/api');
const setupSocketHandlers = require('./sockets/socketHandler');

async function startServer() {
  const db = await getDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    maxHttpBufferSize: 1e8 // Increase buffer for large frame images
  });

  // Attach db to request object so routes can use it
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  // Socket.io namespaces
  const agentNs = io.of('/agent');
  const dashboardNs = io.of('/dashboard');

  const connectedAgents = setupSocketHandlers(agentNs, dashboardNs, db);

  // Attach connectedAgents so API routes can read live agent status
  app.use((req, res, next) => {
    req.connectedAgents = connectedAgents;
    next();
  });

  // API Routes
  app.use('/api', apiRoutes);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
