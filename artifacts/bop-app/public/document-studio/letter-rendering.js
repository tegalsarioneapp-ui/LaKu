(function () {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildLetterHeaderHtml({ lines = [], address = '', logoSrc = 'assets/logo-rt005.png' } = {}) {
    const metaLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const normalizedAddress = String(address || '').trim();
    const metaHtml = metaLines.map((line) => `<div class="letter-head__line">${escapeHtml(line)}</div>`).join('');
    return `
      <div class="letter-head" role="presentation">
        <div class="letter-head__logo-wrap">
          <img class="letter-head__logo" src="${logoSrc}" alt="Logo surat" />
        </div>
        <div class="letter-head__meta">
          ${metaHtml}
          ${normalizedAddress ? `<div class="letter-head__address">${escapeHtml(normalizedAddress)}</div>` : ''}
        </div>
      </div>
    `;
  }

  function getLetterRenderCss() {
    return `
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        color: #000;
        background: #fff;
      }
      .letter-shell {
        width: 100%;
        min-height: 100%;
        padding: 0;
      }
      .letter-head {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 16px;
        align-items: center;
        border-bottom: 3px double #000;
        padding: 4px 0 10px;
        margin-bottom: 12px;
      }
      .letter-head__logo-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .letter-head__logo {
        width: 70px;
        height: 70px;
        object-fit: contain;
        border-radius: 50%;
        border: 2px solid #1e3a5f;
      }
      .letter-head__meta {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        line-height: 1.25;
      }
      .letter-head__line,
      .letter-head__address {
        font-family: "Times New Roman", serif;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        margin: 1px 0;
      }
      .letter-head__address {
        font-size: 11px;
        font-weight: 400;
        text-transform: none;
      }
      .letter-body {
        font-family: "Times New Roman", serif;
        font-size: 12pt;
        line-height: 1.3;
      }
      .letter-body p,
      .letter-body ol,
      .letter-body ul,
      .letter-body li {
        margin: 8px 0;
      }
      .letter-body table {
        width: 100%;
        border-collapse: collapse;
      }
      .letter-body th,
      .letter-body td {
        border: 1px solid #000;
        padding: 5px 8px;
      }
      .letter-body .no-border td,
      .letter-body .no-border th {
        border: none;
      }
      .page-break,
      .ds-page-break {
        page-break-after: always;
        break-after: page;
      }
      .page-break-inside-avoid,
      .ttd-grouped-v63,
      .ttd-row-v63 {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      @media print {
        body { background: #fff; }
        .letter-shell { padding: 0; }
      }
    `;
  }

  function buildLetterDocumentHtml(bodyHtml, { title = 'Dokumen' } = {}) {
    const safeBody = String(bodyHtml || '');
    return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${getLetterRenderCss()}</style>
  </head>
  <body>
    <div class="letter-shell">
      <div class="letter-body">${safeBody}</div>
    </div>
  </body>
</html>`;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildLetterHeaderHtml,
      getLetterRenderCss,
      buildLetterDocumentHtml
    };
  }

  if (typeof window !== 'undefined') {
    window.letterRendering = {
      buildLetterHeaderHtml,
      getLetterRenderCss,
      buildLetterDocumentHtml
    };
  }
})();
