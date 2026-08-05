/**
 * Shared helpers for SubKo backend routes.
 *
 * - asyncHandler:    wraps an Express route so thrown errors / rejected
 *                    promises land in the global error handler instead of
 *                    crashing the process or hanging the request.
 * - callRpc:         invokes a Postgres RPC and normalizes the return shape,
 *                    surfacing RAISE EXCEPTION text as a clean Error.
 * - isInsufficient:  recognises the "insufficient balance" message coming
 *                    out of spend_points / create_promotion.
 */

// Wrap an async route handler. Any rejection is forwarded to next().
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Call a Supabase RPC function and return its data.
 * Throws an Error carrying the Postgres message when the function raises.
 *
 * @param {object} supabase  - the supabase client
 * @param {string} fn        - RPC function name
 * @param {object} args      - arguments object
 * @returns {Promise<any>}   - the RPC's returned data
 */
async function callRpc(supabase, fn, args) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
        // Postgres RAISE EXCEPTION text arrives in error.message.
        const msg = error.message || `${fn}() failed`;
        const err = new Error(msg);
        err.code = error.code;
        err.pgError = error;
        throw err;
    }
    return data;
}

// Heuristic: did the DB refuse because the user can't afford it?
function isInsufficient(err) {
    const m = String(err && err.message ? err.message : '').toLowerCase();
    return m.includes('insufficient balance') || m.includes('you need ');
}

module.exports = { asyncHandler, callRpc, isInsufficient };
