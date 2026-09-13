<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ $request->rs_number }} · Requisition Slip</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e8edf2;
      color: #111;
      font-family: "Times New Roman", Times, serif;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: flex-end;
      gap: 0.55rem;
      padding: 0.7rem 1rem;
      background: #fff;
      border-bottom: 1px solid #d0d5dd;
    }
    .toolbar button {
      border: 0;
      border-radius: 8px;
      padding: 0.5rem 0.9rem;
      font: 600 0.88rem/1.2 system-ui, sans-serif;
      cursor: pointer;
    }
    .toolbar .print { background: #1570ef; color: #fff; }
    .toolbar .close { background: #f2f4f7; color: #344054; }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 1rem auto 2rem;
      padding: 12mm 12mm 14mm;
      background: #fff;
      box-shadow: 0 10px 28px rgba(16, 24, 40, 0.12);
    }
    .head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.7rem 0.85rem;
      align-items: start;
      margin-bottom: 0.55rem;
    }
    .mark {
      width: 42px;
      height: 42px;
      margin-top: 0.1rem;
    }
    .org {
      min-width: 0;
    }
    .org h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .org p {
      margin: 0.12rem 0 0;
      font-size: 0.78rem;
      line-height: 1.35;
    }
    .titleblock {
      text-align: right;
    }
    .titleblock h1 {
      margin: 0 0 0.35rem;
      font-size: 1.28rem;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .titleblock table {
      margin-left: auto;
      border-collapse: collapse;
      font-size: 0.84rem;
    }
    .titleblock td {
      padding: 0.05rem 0 0.05rem 0.7rem;
      vertical-align: baseline;
    }
    .titleblock td:first-child {
      padding-left: 0;
      color: #222;
      white-space: nowrap;
    }
    .to-line {
      margin: 0.15rem 0 0.45rem;
      font-size: 0.92rem;
    }
    .grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 8.5px;
      line-height: 1.25;
      color: #1a1a1a;
    }
    .grid th,
    .grid td {
      border: 0.5px solid #8a8a8a;
      vertical-align: middle;
    }
    .grid th {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.01em;
      padding: 3px 4px;
      text-align: center;
      background: #f3f3f3;
      color: #333;
    }
    .grid td {
      height: 4.4mm;
      padding: 1px 4px;
    }
    .col-qty { width: 9%; text-align: center; }
    .col-unit { width: 9%; text-align: center; }
    .col-item { width: 38%; text-align: left; }
    .col-purpose { width: 22%; text-align: left; }
    .col-price { width: 11%; text-align: right; font-variant-numeric: tabular-nums; }
    .col-total { width: 11%; text-align: right; font-variant-numeric: tabular-nums; }
    .purpose-cell {
      font-size: 8px;
      line-height: 1.3;
      padding: 5px 6px !important;
      height: auto;
      vertical-align: top;
      color: #333;
    }
    .item-cell {
      font-size: 8.5px;
      line-height: 1.25;
      vertical-align: top;
    }
    .foot-label {
      text-align: right;
      font-size: 8.5px;
      font-weight: 700;
      vertical-align: middle !important;
      background: #f7f7f7;
    }
    .grid tfoot td,
    .grid tr:last-child td {
      height: 4.8mm;
    }
    .signs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 0.7rem 0.85rem;
      margin-top: 1.05rem;
    }
    .sign .label {
      font-size: 0.78rem;
    }
    .sign .who {
      min-height: 18mm;
      border-bottom: 1px solid #111;
      margin-top: 0.15rem;
    }
    .sign .name {
      margin-top: 0.2rem;
      font-size: 0.78rem;
      font-weight: 700;
      text-align: center;
    }
    .sign .role {
      text-align: center;
      font-size: 0.68rem;
      line-height: 1.25;
    }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body { background: #fff; }
      .toolbar { display: none; }
      .sheet {
        margin: 0;
        padding: 0;
        box-shadow: none;
        width: auto;
        min-height: auto;
      }
    }
    @media screen and (max-width: 900px) {
      .signs { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="close" onclick="window.close()">Close</button>
    <button type="button" class="print" onclick="window.print()">Print RS slip</button>
  </div>

  <main class="sheet">
    <header class="head">
      <svg class="mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M6 40c8-2 12-14 18-14s8 12 16 12 10-14 18-14" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>
        <path d="M10 48c8-2 11-11 16-11s8 10 14 10 10-12 16-12" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <div class="org">
        <h2>NABUA WATER DISTRICT</h2>
        <p>
          NAWAD Building, San Francisco<br>
          Nabua, Camarines Sur 4434
        </p>
      </div>
      <div class="titleblock">
        <h1>REQUISITION SLIP</h1>
        <table>
          <tr>
            <td>RS No.:</td>
            <td>{{ $request->rs_number }}</td>
          </tr>
          <tr>
            <td>Date Requested:</td>
            <td>{{ optional($request->created_at)->format('j-M-y') }}</td>
          </tr>
          <tr>
            <td>Date Needed:</td>
            <td>{{ $request->date_needed ? $request->date_needed->format('j-M-y') : '' }}</td>
          </tr>
        </table>
      </div>
    </header>

    <p class="to-line"><strong>To:</strong> {{ $request->destination ?: '' }}</p>

    @php
      $rowCount = max(1, $lines->count()) + $blankRows;
    @endphp

    <table class="grid">
      <thead>
        <tr>
          <th class="col-qty">Qty</th>
          <th class="col-unit">Unit</th>
          <th class="col-item">Particulars / Descriptions</th>
          <th class="col-purpose">Purpose</th>
          <th class="col-price">Unit Price</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        @forelse($lines as $index => $line)
          <tr>
            <td class="col-qty">{{ $line['qty'] ?: '' }}</td>
            <td class="col-unit">{{ $line['unit'] }}</td>
            <td class="col-item item-cell">{{ $line['particulars'] }}</td>
            @if($index === 0)
              <td class="col-purpose purpose-cell" rowspan="{{ $rowCount }}">{{ $request->purpose }}</td>
            @endif
            <td class="col-price">{{ $line['price'] > 0 ? number_format($line['price'], 2) : '' }}</td>
            <td class="col-total">{{ $line['total'] > 0 ? number_format($line['total'], 2) : '' }}</td>
          </tr>
        @empty
          <tr>
            <td class="col-qty"></td>
            <td class="col-unit"></td>
            <td class="col-item"></td>
            <td class="col-purpose purpose-cell" rowspan="{{ $rowCount }}"></td>
            <td class="col-price"></td>
            <td class="col-total"></td>
          </tr>
        @endforelse

        @for($i = 0; $i < $blankRows; $i++)
          <tr>
            <td class="col-qty"></td>
            <td class="col-unit"></td>
            <td class="col-item"></td>
            <td class="col-price"></td>
            <td class="col-total"></td>
          </tr>
        @endfor

        <tr>
          <td colspan="4" class="foot-label">Total:</td>
          <td class="col-price"></td>
          <td class="col-total"><strong>{{ number_format($grandTotal, 2) }}</strong></td>
        </tr>
      </tbody>
    </table>

    <section class="signs">
      <div class="sign">
        <div class="label">Requested by:</div>
        <div class="who"></div>
        <div class="name">{{ $request->uploader?->full_name }}</div>
        <div class="role">End user</div>
      </div>
      <div class="sign">
        <div class="label">Noted by:</div>
        <div class="who"></div>
        <div class="name">{{ $request->notedByUser?->full_name }}</div>
        <div class="role">Department Head</div>
      </div>
      <div class="sign">
        <div class="label">Checked by:</div>
        <div class="who"></div>
        <div class="name">{{ $request->checkedByUser?->full_name }}</div>
        <div class="role">Procurement and Office Asset Staff</div>
      </div>
      <div class="sign">
        <div class="label">Approved by:</div>
        <div class="who"></div>
        <div class="name">{{ $request->approvedByUser?->full_name }}</div>
        <div class="role">Branch Manager</div>
      </div>
    </section>
  </main>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>
