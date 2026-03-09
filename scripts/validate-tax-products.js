#!/usr/bin/env node
/**
 * validate-tax-products.js
 *
 * Read-only. Checks that the tax product configuration matches expectations.
 * Run after setup-tax-products.js on either instance.
 *
 * Usage:
 *   eval $(cb auth odoo-test) && node scripts/validate-tax-products.js
 *   eval $(cb auth odoo-prod) && node scripts/validate-tax-products.js
 *
 * Exit code 0 = all checks passed. Exit code 1 = one or more failures.
 */

'use strict';

const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'packages/odoo-client/dist/index.js'));

// ─── EXPECTED CONFIG (mirrors setup-tax-products.js) ─────────────────────────

const ID = {
  IRPF:       144,
  PATRIMONIO: 143,
  MOD720:     220,
  ATTR_ABCD:   13,
  VAL_A:       48,
  VAL_B:       49,
  VAL_C:       50,
};

const EXPECTED_PTAV_EXTRAS = { A: 148.76, B: 280.99, C: 479.34 };

const EXPECTED_IRPF_PTAV_EXTRAS = { A: 66.12, B: 107.44, C: 198.35, D: 479.34 };

// New products: located by en_GB name (set during setup)
const NEW_PRODUCT_NAMES = {
  mod721:          'Form 721 — Cryptocurrencies abroad (Mod. 720 add-on)',
  participaciones: 'Form 720 — Unlisted company interests (per company)',
  inmuebles:       'Form 720 — Real estate abroad (per property)',
  extemporanea:    'Form 720 — Late / supplementary return (per year)',
};

const EXPECTED_PRICES = {
  mod721:          123.97,
  participaciones: 123.97,
  inmuebles:        66.12,
  extemporanea:     82.64,
};

const EXPECTED_TRANSLATIONS = {
  mod721: {
    name: {
      es_ES: 'Mod. 721 — Criptomonedas en el extranjero',
      ca_ES: "Mod. 721 — Criptomonedes a l'estranger",
    },
  },
  participaciones: {
    name: {
      es_ES: 'Mod. 720 — Participaciones en sociedades no cotizadas (por sociedad)',
      ca_ES: 'Mod. 720 — Participacions en societats no cotitzades (per societat)',
    },
  },
  inmuebles: {
    name: {
      es_ES: 'Mod. 720 — Bienes inmuebles en el extranjero (por inmueble)',
      ca_ES: "Mod. 720 — Béns immobles a l'estranger (per immoble)",
    },
  },
  extemporanea: {
    name: {
      es_ES: 'Mod. 720 — Declaración extemporánea/complementaria (por ejercicio)',
      ca_ES: 'Mod. 720 — Declaració extemporània/complementària (per exercici)',
    },
  },
};

// ─── REPORTER ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label, detail = '') {
  console.log(`  ✅ ${label}${detail ? '  — ' + detail : ''}`);
  passed++;
}

function fail(label, detail = '') {
  console.error(`  ❌ ${label}${detail ? '  — ' + detail : ''}`);
  failed++;
}

function check(label, condition, detail = '') {
  condition ? pass(label, detail) : fail(label, detail);
}

function section(title) {
  console.log(`\n── ${title}`);
}

function numEq(a, b) {
  return Math.abs(a - b) < 0.01;
}

// ─── CHECKS ───────────────────────────────────────────────────────────────────

async function checkExistingProducts(client) {
  section('Existing products reachable');

  const tmpls = await client.searchRead('product.template',
    [['id', 'in', [ID.IRPF, ID.PATRIMONIO, ID.MOD720]]],
    { fields: ['id', 'name', 'active'] }
  );
  const byId = Object.fromEntries(tmpls.map(t => [t.id, t]));

  check('product 144 (IRPF) exists',       !!byId[ID.IRPF],       byId[ID.IRPF]?.name);
  check('product 143 (Patrimonio) exists',  !!byId[ID.PATRIMONIO], byId[ID.PATRIMONIO]?.name);
  check('product 220 (Mod.720) exists',     !!byId[ID.MOD720],     byId[ID.MOD720]?.name);

  return byId;
}

async function checkMod720Prices(client) {
  section('Product 220 (Mod. 720) — list_price and PTAVs');

  const [tmpl] = await client.read('product.template', [ID.MOD720],
    ['list_price', 'attribute_line_ids']);

  check('list_price = 0', numEq(tmpl.list_price, 0), `got ${tmpl.list_price}`);
  check('has 1 attribute line', tmpl.attribute_line_ids.length === 1,
    `count = ${tmpl.attribute_line_ids.length}`);

  if (tmpl.attribute_line_ids.length === 0) return null;

  const [ptal] = await client.read('product.template.attribute.line',
    [tmpl.attribute_line_ids[0]],
    ['attribute_id', 'value_ids']);

  check('attribute is ABCD (id=13)',
    ptal.attribute_id[0] === ID.ATTR_ABCD,
    `got attribute id=${ptal.attribute_id[0]}`);
  check('has 3 values (A, B, C)',
    ptal.value_ids.length === 3,
    `value_ids = ${JSON.stringify(ptal.value_ids)}`);

  const ptavs = await client.searchRead('product.template.attribute.value', [
    ['product_tmpl_id',   '=', ID.MOD720],
    ['attribute_line_id', '=', tmpl.attribute_line_ids[0]],
    ['ptav_active',       '=', true],
  ], { fields: ['product_attribute_value_id', 'price_extra'] });

  check('3 active PTAVs', ptavs.length === 3, `count = ${ptavs.length}`);

  for (const ptav of ptavs) {
    const letter  = ptav.product_attribute_value_id[1].replace('ABCD: ', '');
    const expected = EXPECTED_PTAV_EXTRAS[letter];
    if (expected === undefined) {
      fail(`unexpected PTAV letter "${letter}"`);
      continue;
    }
    check(
      `PTAV ${letter} price_extra = ${expected}`,
      numEq(ptav.price_extra, expected),
      `got ${ptav.price_extra}`
    );
  }

  return tmpl.attribute_line_ids[0];
}

async function checkMod720OptionalProducts(client, newIds) {
  section('Product 220 (Mod. 720) — optional_product_ids');

  const [tmpl] = await client.read('product.template', [ID.MOD720], ['optional_product_ids']);
  const opts = tmpl.optional_product_ids;

  for (const [key, id] of Object.entries(newIds)) {
    check(`optional includes ${key} (id=${id})`, opts.includes(id));
  }
}

async function checkIrpfOptionalProducts(client, id721) {
  section('Product 144 (IRPF) — optional_product_ids');

  const [tmpl] = await client.read('product.template', [ID.IRPF], ['optional_product_ids']);
  check('optional includes 143 (Patrimonio)', tmpl.optional_product_ids.includes(ID.PATRIMONIO));
  check(`optional includes 721 (id=${id721})`, tmpl.optional_product_ids.includes(id721));
}

async function checkNewProducts(client) {
  section('New add-on products — existence and prices');

  const names  = Object.values(NEW_PRODUCT_NAMES);
  const found  = await client.searchRead('product.template',
    [['name', 'in', names]],
    { fields: ['id', 'name', 'list_price', 'type'] }
  );
  const byName = Object.fromEntries(found.map(t => [t.name, t]));

  const newIds = {};
  for (const [key, name] of Object.entries(NEW_PRODUCT_NAMES)) {
    const tmpl = byName[name];
    check(`"${name}" exists`, !!tmpl);
    if (!tmpl) continue;

    newIds[key] = tmpl.id;
    check(`  type = service`,     tmpl.type === 'service',                     `got ${tmpl.type}`);
    check(`  list_price = ${EXPECTED_PRICES[key]}`,
      numEq(tmpl.list_price, EXPECTED_PRICES[key]),
      `got ${tmpl.list_price}`
    );
  }

  return newIds;
}

async function checkTranslations(client, newIds) {
  section('New products — name translations');

  for (const [key, id] of Object.entries(newIds)) {
    const expected = EXPECTED_TRANSLATIONS[key]?.name ?? {};
    for (const [lang, expectedVal] of Object.entries(expected)) {
      const [r] = await client.read('product.template', [id], ['name'], { lang });
      check(
        `${key} name[${lang}]`,
        r.name === expectedVal,
        r.name === expectedVal ? '' : `\n    got:      "${r.name}"\n    expected: "${expectedVal}"`
      );
    }
  }

  section('New products — description_sale set (non-empty)');

  for (const [key, id] of Object.entries(newIds)) {
    for (const lang of ['en_GB', 'es_ES', 'ca_ES']) {
      const [r] = await client.read('product.template', [id], ['description_sale'], { lang });
      check(
        `${key} description_sale[${lang}] set`,
        !!r.description_sale && r.description_sale.length > 10,
        r.description_sale ? r.description_sale.substring(0, 60) + '…' : '(empty)'
      );
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await createClient();

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log(' Tax Products Validation');
  console.log(` ${process.env.ODOO_URL}  (db: ${process.env.ODOO_DB})`);
  console.log('══════════════════════════════════════════════════════');

  await checkExistingProducts(client);
  await checkMod720Prices(client);

  const newIds = await checkNewProducts(client);

  if (Object.keys(newIds).length > 0) {
    await checkMod720OptionalProducts(client, newIds);
    await checkIrpfOptionalProducts(client, newIds.mod721);
    await checkTranslations(client, newIds);
  }

  const total = passed + failed;
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log(` Results: ${passed}/${total} passed  ${failed > 0 ? `(${failed} FAILED)` : '✅ all good'}`);
  console.log('══════════════════════════════════════════════════════');
  console.log('');

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
