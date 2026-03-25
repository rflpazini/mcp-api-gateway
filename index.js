#!/usr/bin/env node
import { APIGatewayMCPServer } from './src/server.js';

const server = new APIGatewayMCPServer();
server.run().catch(console.error);
