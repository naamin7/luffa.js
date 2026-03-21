import 'dotenv/config';
import { luffaClient } from '../bot/client';
import { registerHandlers } from '../bot/handler';

registerHandlers();

luffaClient.start().then(() => {
  console.log('Crypto monitor bot started, polling...');
}).catch(console.error);