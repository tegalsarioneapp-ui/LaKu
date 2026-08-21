/*
 * LaKu Warga — Global Print KOP
 *
 * This is intentionally a classic script, not a React component:
 * the current BOP renderer is a legacy vanilla-JS application and all
 * document builders already resolve the global kopHTML() function.
 */
(function installGlobalPrintKop(global) {
  "use strict";

  if (!global || global.__globalPrintKopInstalled) return;
  global.__globalPrintKopInstalled = true;

  var DEFAULTS = {
    leftLogo: "assets/logo-rt005.png",
    leftAlt: "Logo RT 005 RW 012"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getIdentity() {
    var data = global.data || {};
    var kop = data.kop || {};
    var master = data.master || {};
    var address = kop.alamat || master.alamat || "Jl. Tegalsari Raya, Tegalsari, Kota Semarang";

    return {
      city: kop.baris1 || "PEMERINTAH KOTA SEMARANG",
      district: kop.baris2 || "KECAMATAN CANDISARI",
      village: kop.baris3 || "KELURAHAN TEGALSARI",
      neighbourhood: kop.baris4 || "RW 012 RT 005",
      address: /^sekretariat/i.test(String(address)) ? address : "Sekretariat: " + address
    };
  }

  function render(options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var identity = Object.assign(getIdentity(), opts.identity || {});

    return [
      '<div class="print-kop" data-print-kop="global" role="presentation">',
        '<div class="print-kop__side print-kop__side--left">',
          '<img class="print-kop__logo" width="90" height="90" src="', escapeHtml(opts.leftLogo),
            '" alt="', escapeHtml(opts.leftAlt), '">',
        '</div>',
        '<div class="print-kop__center">',
          '<div class="print-kop__line print-kop__line--city">', escapeHtml(identity.city), '</div>',
          '<div class="print-kop__line">', escapeHtml(identity.district), '</div>',
          '<div class="print-kop__line">', escapeHtml(identity.village), '</div>',
          '<div class="print-kop__line print-kop__line--rt">', escapeHtml(identity.neighbourhood), '</div>',
          '<div class="print-kop__address">', escapeHtml(identity.address), '</div>',
        '</div>',
      '</div>'
    ].join("");
  }

  function wrap(bodyHtml, options) {
    return '<div class="print-area">' +
      render(options) +
      '<div class="print-document">' + String(bodyHtml || "") + "</div>" +
      "</div>";
  }

  function showPrintError(message) {
    if (typeof global.bopAlert === "function") {
      global.bopAlert("Cetak", message, "warning");
    } else if (global.console) {
      global.console.warn("[Global Print KOP]", message);
    }
  }

  function resolvePrintHtml(target) {
    var type = target === "lpj" || target === "pk" ? target : "doc";
    if (typeof global.collectAll === "function") {
      try { global.collectAll(); } catch (_) {}
    }

    if (type === "lpj") {
      try {
        if (typeof global.docLpj === "function") return global.docLpj();
      } catch (_) {}
      var lpj = document.getElementById("lpjOutput");
      return lpj ? lpj.innerHTML : "";
    }

    if (type === "pk") {
      try {
        if (typeof global.collectPersiapan === "function") global.collectPersiapan();
        if (typeof global.previewPkDoc === "function") {
          global.previewPkDoc(global.currentPkDoc || "pk-hadir");
        }
      } catch (_) {}
      var pk = document.getElementById("pkDocOutput");
      return pk ? pk.innerHTML : "";
    }

    try {
      if (typeof global.previewDoc === "function") {
        global.previewDoc(global.currentDoc || "permohonan");
      }
    } catch (_) {}
    var doc = document.getElementById("docOutput");
    return doc ? doc.innerHTML : "";
  }

  function createPrintHtml(target) {
    var body = String(resolvePrintHtml(target) || "").trim();
    if (!body) return "";

    /*
     * The preview renderer owns the document structure, including KOP.
     * Only add a KOP for a genuinely old/partial output. Checking for any
     * historical KOP class prevents the old and new letterheads being printed
     * together while legacy output is being migrated.
     */
    var hasLetterhead = /class=["'][^"']*(?:\bkop\b|print-kop|letterhead)[^"']*["']/i.test(body) ||
      /data-print-kop=["']global["']/i.test(body);
    if (!hasLetterhead) {
      body = render() + body;
    }

    return '<div class="print-area"><div class="print-document">' + body + "</div></div>";
  }

  function print(target) {
    var html = createPrintHtml(target);
    if (!html) {
      showPrintError("Tidak ada dokumen untuk dicetak.");
      return false;
    }

    var old = document.getElementById("globalPrintKopFrame");
    if (old) old.remove();

    var frame = document.createElement("iframe");
    frame.id = "globalPrintKopFrame";
    frame.title = "Pratinjau cetak dokumen";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(frame);

    var printDocument = frame.contentDocument || frame.contentWindow.document;
    /*
     * The on-screen preview is rendered inside .doc-paper from styles.css.
     * Loading only print-kop.css here used to drop the preview's document
     * rules (table borders, official typography, spacing), so print preview
     * looked like a different document. Keep the same document CSS in the
     * print frame, then let print-kop.css apply its print-specific rules.
     */
    var stylesUrl = new URL("styles.css", global.location.href).href;
    var studioStylesUrl = new URL("document-studio/document-studio.css", global.location.href).href;
    var kopStylesUrl = new URL("print-kop.css", global.location.href).href;
    var printed = false;
    var linksLoaded = 0;
    var requiredLinks = 3;
    function invokePrint() {
      if (printed) return;
      if (linksLoaded < requiredLinks) return;
      printed = true;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }

    printDocument.open();
    printDocument.write(
      '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
      '<title>Dokumen Resmi LaKu Warga</title>' +
      '<link rel="stylesheet" href="' + escapeHtml(stylesUrl) + '">' +
      '<link rel="stylesheet" href="' + escapeHtml(studioStylesUrl) + '">' +
      '<link rel="stylesheet" href="' + escapeHtml(kopStylesUrl) + '">' +
      '<style>' +
        'html,body,.print-area,.print-document{margin:0!important;padding:0!important;box-sizing:border-box!important}' +
        '.print-document .doc-paper{padding:0!important;border:0!important;box-shadow:none!important;min-height:0!important}' +
        '.print-document .official{display:block!important;visibility:visible!important}' +
        '.print-document table{border-collapse:collapse!important}' +
      '</style>' +
      '</head><body>' + html + "</body></html>"
    );
    printDocument.close();

    printDocument.querySelectorAll("link").forEach(function(link) {
      link.onload = function() {
        linksLoaded += 1;
        invokePrint();
      };
      link.onerror = function() {
        /* A missing optional stylesheet must not block printing forever. */
        linksLoaded += 1;
        invokePrint();
      };
    });
    setTimeout(function() {
      linksLoaded = requiredLinks;
      invokePrint();
    }, 1200);
    setTimeout(function () {
      try { frame.remove(); } catch (_) {}
    }, 60000);
    return true;
  }

  function bindPrintButtons() {
    var docButton = document.getElementById("printDoc");
    var meetingButton = document.getElementById("printMeetingDoc");
    var lpjButton = document.getElementById("printLpj");
    var pkButton = document.getElementById("printPkDoc");
    var rapButton = document.getElementById("printMonthlyRapDoc");
    var rbbButton = document.getElementById("printMonthlyRbbDoc");
    var pdfDocButton = document.getElementById("exportPdfDocV38");
    var pdfLpjButton = document.getElementById("exportPdfLpjV38");

    if (docButton) docButton.onclick = function () { print("doc"); };
    if (meetingButton) meetingButton.onclick = function () { print("doc"); };
    if (lpjButton) lpjButton.onclick = function () { print("lpj"); };
    if (pkButton) pkButton.onclick = function () { print("pk"); };
    if (rapButton) rapButton.onclick = function () { print("doc"); };
    if (rbbButton) rbbButton.onclick = function () { print("doc"); };
    if (pdfDocButton) pdfDocButton.onclick = function () { print("doc"); };
    if (pdfLpjButton) pdfLpjButton.onclick = function () { print("lpj"); };
  }

  global.PrintKopTemplate = {
    defaults: Object.freeze(Object.assign({}, DEFAULTS)),
    render: render,
    wrap: wrap,
    print: print,
    resolvePrintHtml: resolvePrintHtml
  };

  /*
   * One global entry point for every existing document builder:
   * official(), docLpj(), docPk*, RAP, RBB, and document studio.
   */
  global.kopHTML = function globalKopHTML(options) {
    return render(options);
  };
  global.cleanPrint = function globalCleanPrint(target) {
    return print(target);
  };
  global.cleanPrintPk = function globalCleanPrintPk() {
    return print("pk");
  };
  global.exportPdfDocV38 = async function globalExportPdfDoc() {
    return print("doc");
  };
  global.exportPdfLpjV38 = async function globalExportPdfLpj() {
    return print("lpj");
  };

  if (typeof document !== "undefined") {
    bindPrintButtons();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindPrintButtons);
    }
  }

  if (global.console) {
    global.console.info("[Global Print KOP] Template global aktif untuk semua jalur cetak.");
  }
})(window);