import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/pengajuan-awal-model.js", import.meta.url), "utf8");
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(source, sandbox, { filename: "pengajuan-awal-model.js" });
const model = sandbox.module.exports;

test("creates a one-time initial application with the required allocation", () => {
  const record = model.createInitialApplication(2026);
  assert.equal(record.year, 2026);
  assert.equal(record.allocation, model.ALLOCATION);
  assert.equal(record.status, "draft");
  assert.equal(Object.keys(record.documents).join("|"), model.DOCUMENT_IDS.join("|"));
  assert.equal(model.validate(record).valid, true);
});

test("migrates legacy data without deleting nested fields", () => {
  const result = model.migrate({
    master: { rt: "009" },
    pengajuan: {
      checklist: { permohonan: true, rap: true },
      meeting: { rapatJudul: "Rapat warga" },
    },
  }, 2026);

  assert.equal(result.master.rt, "009");
  assert.equal(result.pengajuan.meeting.rapatJudul, "Rapat warga");
  assert.equal(result.pengajuan.initialApplications["2026"].documents.permohonan, "ready");
  assert.equal(result.pengajuan.initialApplications["2026"].documents.rbb, "incomplete");
});

test("migration is idempotent", () => {
  const first = model.migrate({
    pengajuan: { checklist: { permohonan: true }, guidedStatus: "diajukan" },
  }, 2026);
  const second = model.migrate(first, 2026);
  assert.deepEqual(second, first);
  assert.equal(second.pengajuan.initialApplications["2026"].status, "submitted");
});

test("rejects an invalid initial allocation", () => {
  const invalid = model.createInitialApplication(2026, { allocation: 25000001 });
  const result = model.validate(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Rp25\.000\.000/);
});

test("prevents a duplicate initial application for the same year", () => {
  const state = model.migrate({ pengajuan: {} }, 2026);
  assert.throws(
    () => model.createForYear(state, 2026),
    (error) => error && error.code === "DUPLICATE_INITIAL_APPLICATION",
  );
});

test("creates a new application for a year that has no record", () => {
  const result = model.createForYear({ pengajuan: {} }, 2027);
  assert.equal(result.pengajuan.activeInitialApplicationYear, 2027);
  assert.equal(result.pengajuan.initialApplications["2027"].year, 2027);
  assert.equal(result.pengajuan.initialApplications["2027"].allocation, model.ALLOCATION);
});