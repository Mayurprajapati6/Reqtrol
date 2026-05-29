import { EventEmitter } from 'events';

export const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(100);