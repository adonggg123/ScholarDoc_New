// Type declarations for @supabase/server in Supabase Edge Functions
declare module "@supabase/server" {
  export interface WithSupabaseOptions {
    auth?: string | string[];
    cors?: boolean | Record<string, any>;
  }

  export interface SupabaseContext {
    authMode: string;
    supabase: any;
    supabaseAdmin: any;
    userClaims?: Record<string, any>;
    jwtClaims?: Record<string, any>;
  }

  export function withSupabase(
    options: WithSupabaseOptions,
    handler: (req: Request, ctx: SupabaseContext) => Promise<Response> | Response
  ): (req: Request, ...args: any[]) => Promise<Response>;
}
