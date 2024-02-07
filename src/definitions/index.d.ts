module 'server' {
  export interface ServerInitProps {
    env?: ProcessEnv;
  }

  export class Server {
    constructor(manifest);
    async init(params: ServerInitProps);
    async respond(request: Request, options2): Promise<Response>;
  }
}
