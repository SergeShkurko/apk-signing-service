declare module '@root/greenlock-express' {
  import type { Application } from 'express';
  import type { Server } from 'http';

  interface GreenlockConfig {
    packageRoot: string;
    configDir: string;
    maintainerEmail: string;
    cluster: boolean;
    staging?: boolean;
  }

  interface GreenlockManager {
    defaults: (options: {
      agreeToTerms: boolean;
      subscriberEmail: string;
    }) => Promise<void>;
  }

  interface GreenlockSites {
    add: (options: {
      subject: string;
      altnames: string[];
    }) => Promise<void>;
  }

  interface Greenlock {
    manager: GreenlockManager;
    sites: GreenlockSites;
    serve: (app: Application) => {
      httpServer: Server;
      httpsServer: Server;
    };
  }

  interface GreenlockExpress {
    init: (config: GreenlockConfig) => Greenlock;
  }

  const greenlockExpress: GreenlockExpress;
  export default greenlockExpress;
}
