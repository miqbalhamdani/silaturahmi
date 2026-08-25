/**
 * Lives outside lib/actions/family.ts because a "use server" module may only
 * export async functions — exporting a class there makes Next drop every
 * export from the module, with a confusing "has no exports at all" error.
 */
export class ActionError extends Error {}
