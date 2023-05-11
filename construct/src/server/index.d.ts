export interface ServerInitProps {
  env?: ProcessEnv;
}


export class Server {
  constructor(manifest) {}
  async init({ env }: ServerInitProps) {}
  async respond(request: Request, options2) : Promise<Response> {}
}
