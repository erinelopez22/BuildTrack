// MIGRATION STUB
// Supabase has been replaced by the BuildTrack REST API.
// This stub prevents import errors in components not yet migrated.
// All new/migrated code should import from @/lib/apiClient instead.
//
// To find remaining Supabase usages: grep -r "from '@/integrations/supabase" src/

export const supabase = {
  auth: {
    signInWithPassword: async () => ({ error: new Error('Use authApi.login() from @/lib/apiClient') }),
    signOut: async () => {},
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession: async () => ({ data: { session: null } }),
  },
  from: (table: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[MIGRATION NEEDED] supabase.from('${table}') - migrate to @/lib/apiClient`);
    }
    const chain: Record<string, unknown> = {};
    const noop = () => chain;
    ['select','insert','update','delete','upsert','eq','neq','gt','lt','gte',
     'lte','in','not','is','ilike','order','limit','range','filter','or','and',
     'contains','containedBy','overlaps','textSearch','match','count'].forEach(m => {
       chain[m] = noop;
     });
    chain['single'] = () => Promise.resolve({ data: null, error: new Error(`Migrate ${table} to REST API`) });
    chain['maybeSingle'] = () => Promise.resolve({ data: null, error: null });
    chain['then'] = (resolve: (v: { data: null; error: Error | null }) => unknown) =>
      Promise.resolve({ data: null, error: new Error(`Migrate ${table} to REST API`) }).then(resolve);
    return chain;
  },
  functions: {
    invoke: async (name: string) => ({
      data: null,
      error: new Error(`Edge function '${name}' - use REST API endpoint instead`),
    }),
  },
  channel: (_name: string) => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  removeChannel: () => {},
};
