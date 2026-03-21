declare module 'luffa.js' {
  export class Client {
    constructor(opts: { secret: string; pollInterval?: number }): void;
    onMessage(fn: (msg: Message) => Promise<void>): void;
    start(): Promise<void>;
    stop(): void;
  }
  export class Message {
    id: string;
    content: string;
    authorId: string;
    channelId: string;
    isGroup: boolean;
    raw: unknown;
    reply(text: string): Promise<void>;
    reply(opts: {
      text: string;
      buttons?: { label: string; value: string; hidden?: boolean }[];
      confirm?: { label: string; value: string; style?: string }[];
      mentions?: { uid: string; name: string }[];
      dismissType?: 'select' | 'dismiss';
    }): Promise<void>;
  }
  export class SoftFailError extends Error { code: number; }
  export class LuffaAPIError extends Error { details: unknown; }
  export const Constants: Record<string, unknown>;
}