// Shared session state and tiny pub/sub so views do not import each other.
export const state = { admin: null, server: '', meta: null, nav: () => {}, openUser: () => {}, badge: () => {} };
export const can = (perm) => Boolean(state.admin?.permissions?.includes(perm));
