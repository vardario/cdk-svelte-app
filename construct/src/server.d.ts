export interface ServerInitProps {
  env?: Record<string, string>;
}

export interface Request<Locals = Record<string, any>, Body = unknown> {
  url: URL;
  method: string;
  headers: RequestHeaders;
  rawBody: RawBody;
  params: Record<string, string>;
  body: ParameterizedBody<Body>;
  locals: Locals;
}

export class Server {
  constructor(manifest) {}
  async init({ env }: ServerInitProps) {}
  async respond(request: Request, options2) {}
}
