(function () {
  function parseTime(value) {
    const ts = Number(value);
    if (Number.isFinite(ts)) return ts;
    const parsed = Date.parse(String(value || ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function normalizeVersion(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function resolveSyncSnapshot({
    localState,
    remoteState,
    localVersion = 0,
    serverVersion = 0,
    localUpdatedAt,
    serverUpdatedAt,
  }) {
    if (!remoteState) return localState;
    if (!localState) return remoteState;

    const localVersionNum = normalizeVersion(localVersion);
    const serverVersionNum = normalizeVersion(serverVersion);

    if (serverVersionNum > localVersionNum) return remoteState;
    if (localVersionNum > serverVersionNum) return localState;

    const localTs = parseTime(localUpdatedAt);
    const serverTs = parseTime(serverUpdatedAt);

    if (serverTs > localTs) return remoteState;
    if (localTs > serverTs) return localState;

    return localState;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseTime, normalizeVersion, resolveSyncSnapshot };
  }

  if (typeof window !== "undefined") {
    window.BOP_SYNC_HELPERS = { parseTime, normalizeVersion, resolveSyncSnapshot };
  }
})();
