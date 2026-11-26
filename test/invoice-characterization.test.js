'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice figures match the total and per-line GST used to bill an order', () => {
  const items = [
    { id: 3, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 4, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 2000, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map((row) => row.gstPercent), [5, 18]);
  assert.deepEqual(invoiceFigures.rows.map((row) => row.lineTax), billed.lines.map((line) => line.tax));
});

test('invoice uses the HSN GST rate and matches the billed total when gstRate is not stored', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice applies the billed coupon cap and taxes the discounted amount', () => {
  const items = [{ id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 3000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 3000, discount: 150, tax: 513, total: 3363 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      total: invoiceFigures.total
    },
    { subtotal: 3000, discount: 150, tax: 513, total: 3363 }
  );
});

test('invoice splits GST into CGST and SGST', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Coffee', hsn: '0901', price: 10, qty: 1 }],
    coupon: ''
  });

  assert.equal(figures.tax, 1.8);
  assert.equal(figures.cgst, 0.9);
  assert.equal(figures.sgst, 0.9);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
});

test('rendered invoice has no mismatch warning when its stored order total matches billed pricing', () => {
  const html = invoice.render({
    id: 42,
    date: '01/01/2025',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: '',
    total: 672,
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }]
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹672.00'));
});
