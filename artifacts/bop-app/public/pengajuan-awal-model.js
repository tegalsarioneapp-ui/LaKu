(function exposePengajuanAwalModel(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PengajuanAwalModel = factory();
  }
})(typeof self !== "undefined" ? self : this, function createPengajuanAwalModel() {
  const ALLOCATION = 25000000;
  const DEFAULT_YEAR = 2026;
  const APPLICATION_STATUSES = [
    "draft",
    "incomplete",
    "ready",
    "submitted",
    "revision",
    "approved",
    "disbursed",
  ];
  const DOCUMENT_STATUSES = ["incomplete", "ready", "revision", "verified"];
  const DOCUMENT_IDS = [
    "permohonan",
    "rap",
    "rapbulanan",
    "ba",
    "hadir",
    "sptjm",
    "rbb",
  ];
  const LEGACY_DOCUMENT_KEYS = {
    permohonan: "permohonan",
    rap: "rap",
    rapbulanan: "rap",
    ba: "ba",
    hadir: "hadir",
    sptjm: "sptjm",
    rbb: "rekening",
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeYear(value) {
    const year = Number(value);
    return Number.isInteger(year) && year >= 2000 && year <= 2200
      ? year
      : DEFAULT_YEAR;
  }

  function normalizeStatus(value) {
    return APPLICATION_STATUSES.includes(value) ? value : "draft";
  }

  function normalizeDocumentStatus(value) {
    if (value === true || value === "ready" || value === "siap" || value === "cetak" ||
        value === "ttd" || value === "upload" || value === "verified") {
      return value === "verified" || value === "upload" ? "verified" : "ready";
    }
    return value === "revision" || value === "revisi" ? "revision" : "incomplete";
  }

  function defaultDocumentStatuses(legacyChecklist) {
    const checklist = legacyChecklist && typeof legacyChecklist === "object"
      ? legacyChecklist
      : {};
    return DOCUMENT_IDS.reduce((result, id) => {
      result[id] = normalizeDocumentStatus(checklist[LEGACY_DOCUMENT_KEYS[id]]);
      return result;
    }, {});
  }

  function createInitialApplication(year, overrides) {
    const source = overrides && typeof overrides === "object" ? clone(overrides) : {};
    const normalizedYear = normalizeYear(year || source.year || source.tahunAnggaran);
    const record = {
      year: normalizedYear,
      allocation: source.allocation == null ? ALLOCATION : Number(source.allocation),
      status: normalizeStatus(source.status),
      documents: defaultDocumentStatuses(source.legacyChecklist || source.checklist),
      submittedAt: source.submittedAt || null,
      approvedAt: source.approvedAt || null,
      fundsReceivedAt: source.fundsReceivedAt || null,
      locked: Boolean(source.locked),
      lockedAt: source.lockedAt || null,
      createdAt: source.createdAt || null,
      updatedAt: source.updatedAt || null,
    };

    if (source.documents && typeof source.documents === "object") {
      DOCUMENT_IDS.forEach((id) => {
        if (Object.prototype.hasOwnProperty.call(source.documents, id)) {
          record.documents[id] = normalizeDocumentStatus(source.documents[id]);
        }
      });
    }
    if (record.status === "approved" || record.status === "disbursed") {
      record.locked = true;
    }
    if (record.locked && !record.lockedAt) {
      record.lockedAt = record.approvedAt || record.fundsReceivedAt || null;
    }
    return record;
  }

  function deepMerge(base, source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return base;
    Object.keys(source).forEach((key) => {
      const incoming = source[key];
      if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
        const current = base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
          ? base[key]
          : {};
        base[key] = deepMerge(current, incoming);
      } else if (incoming !== undefined) {
        base[key] = clone(incoming);
      }
    });
    return base;
  }

  function migrateRecord(record, year, legacyChecklist) {
    const source = record && typeof record === "object" ? record : {};
    const migrated = createInitialApplication(year, {
      ...source,
      legacyChecklist: source.legacyChecklist || legacyChecklist,
      documents: source.documents || source.statusDokumen,
    });
    if (source.tahunAnggaran != null) migrated.year = normalizeYear(source.tahunAnggaran);
    if (source.nominalAlokasi != null) migrated.allocation = Number(source.nominalAlokasi);
    if (source.statusPengajuan != null) migrated.status = normalizeStatus(source.statusPengajuan);
    if (source.tanggalPengajuan != null) migrated.submittedAt = source.tanggalPengajuan;
    if (source.tanggalPersetujuan != null) migrated.approvedAt = source.tanggalPersetujuan;
    if (source.tanggalDanaMasukRekening != null) migrated.fundsReceivedAt = source.tanggalDanaMasukRekening;
    if (source.terkunci != null) migrated.locked = Boolean(source.terkunci);
    return migrated;
  }

  function migrate(data, year) {
    const result = data && typeof data === "object" ? clone(data) : {};
    if (!result.pengajuan || typeof result.pengajuan !== "object" || Array.isArray(result.pengajuan)) {
      result.pengajuan = {};
    }
    const pengajuan = result.pengajuan;
    const activeYear = normalizeYear(
      year || pengajuan.activeInitialApplicationYear || pengajuan.tahunAnggaran
    );
    const existing = pengajuan.initialApplications && typeof pengajuan.initialApplications === "object"
      ? pengajuan.initialApplications
      : {};
    const legacyRecord = pengajuan.pengajuanAwal || pengajuan.initialApplication;

    const applications = {};
    Object.keys(existing).forEach((key) => {
      const normalizedYear = normalizeYear(key);
      applications[String(normalizedYear)] = migrateRecord(
        existing[key],
        normalizedYear,
        pengajuan.checklist
      );
    });

    if (legacyRecord && typeof legacyRecord === "object") {
      const legacyYear = normalizeYear(
        legacyRecord.year || legacyRecord.tahunAnggaran || activeYear
      );
      applications[String(legacyYear)] = migrateRecord(
        legacyRecord,
        legacyYear,
        pengajuan.checklist
      );
    }

    if (!applications[String(activeYear)]) {
      const guidedStatus = pengajuan.guidedStatus === "diajukan"
        ? "submitted"
        : normalizeStatus(pengajuan.guidedStatus);
      applications[String(activeYear)] = createInitialApplication(activeYear, {
        status: guidedStatus,
        legacyChecklist: pengajuan.checklist,
      });
    }

    pengajuan.initialApplications = applications;
    pengajuan.activeInitialApplicationYear = activeYear;
    return result;
  }

  function get(data, year) {
    const migrated = migrate(data, year);
    const activeYear = normalizeYear(
      year || migrated.pengajuan.activeInitialApplicationYear
    );
    return migrated.pengajuan.initialApplications[String(activeYear)] || null;
  }

  function validate(application) {
    const record = application && typeof application === "object" ? application : {};
    const errors = [];
    const year = normalizeYear(record.year || record.tahunAnggaran);
    const allocation = Number(record.allocation == null ? record.nominalAlokasi : record.allocation);
    if (year !== Number(record.year || record.tahunAnggaran)) {
      errors.push("Tahun anggaran tidak valid.");
    }
    if (allocation !== ALLOCATION) {
      errors.push("Nominal alokasi awal harus Rp25.000.000.");
    }
    if (!APPLICATION_STATUSES.includes(record.status || record.statusPengajuan)) {
      errors.push("Status pengajuan awal tidak valid.");
    }
    return {
      valid: errors.length === 0,
      errors,
      year,
      allocation,
    };
  }

  function createForYear(data, year, overrides) {
    const normalizedYear = normalizeYear(year);
    const source = data && typeof data === "object" ? data : {};
    const existingApplications = source.pengajuan &&
      source.pengajuan.initialApplications &&
      typeof source.pengajuan.initialApplications === "object"
      ? source.pengajuan.initialApplications
      : {};
    const existingRecord = existingApplications[String(normalizedYear)] ||
      (source.pengajuan && source.pengajuan.pengajuanAwal &&
       normalizeYear(source.pengajuan.pengajuanAwal.year || source.pengajuan.pengajuanAwal.tahunAnggaran) === normalizedYear
        ? source.pengajuan.pengajuanAwal
        : null);
    const migrated = migrate(data, year);
    const key = String(normalizedYear);
    if (existingRecord) {
      const error = new Error("Pengajuan awal untuk tahun tersebut sudah ada.");
      error.code = "DUPLICATE_INITIAL_APPLICATION";
      throw error;
    }
    const record = createInitialApplication(normalizedYear, overrides);
    const validation = validate(record);
    if (!validation.valid) {
      const error = new Error(validation.errors.join(" "));
      error.code = "INVALID_INITIAL_APPLICATION";
      throw error;
    }
    migrated.pengajuan.initialApplications[key] = record;
    migrated.pengajuan.activeInitialApplicationYear = normalizedYear;
    return migrated;
  }

  function canEdit(application) {
    const record = application || {};
    return !record.locked && record.status !== "approved" && record.status !== "disbursed";
  }

  return {
    ALLOCATION,
    DEFAULT_YEAR,
    APPLICATION_STATUSES,
    DOCUMENT_STATUSES,
    DOCUMENT_IDS,
    createInitialApplication,
    createForYear,
    migrate,
    get,
    validate,
    canEdit,
    deepMerge,
  };
});