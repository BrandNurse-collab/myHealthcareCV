// Placeholder Supabase types. Deliberately untyped (`any`) rather than a
// half-modeled shape: a partially-correct Database type produces confusing
// `never` inference on writes without actually catching real mistakes.
// Once schema.sql has been applied to a real project, replace this file
// with the generated types so every query is checked against actual
// columns:
//
//   npx supabase gen types typescript --project-id <ref> --schema public \
//     > src/types/database.ts
//
// Regenerate after any future schema change.

export type Database = any;
