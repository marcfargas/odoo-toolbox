#!/usr/bin/env node
/**
 * setup-tax-products.js
 *
 * Creates Modelo 721 and Mod. 720 add-on products, configures the ABCD
 * attribute on product 720, and wires optional_product_ids.
 *
 * odoo-test and odoo-prod are copies — all IDs are identical across instances.
 * Run on odoo-test first, then on odoo-prod with the same script.
 *
 * Usage:
 *   eval $(cb auth odoo-test) && node scripts/setup-tax-products.js
 *   eval $(cb auth odoo-prod) && node scripts/setup-tax-products.js
 */

'use strict';

const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'packages/odoo-client/dist/index.js'));

// ─── PRICES (ex-IVA: website price ÷ 1.21) ───────────────────────────────────

const PRICES = {
  mod721:           123.97,  // 150 € IVA incl.
  participaciones:  123.97,  // 150 € IVA incl.
  inmuebles:         66.12,  //  80 € IVA incl.
  extemporanea:      82.64,  // 100 € IVA incl.
};

const PRICE_EXTRAS_720 = {
  A: 148.76,  // 180 € IVA incl.
  B: 280.99,  // 340 € IVA incl.
  C: 479.34,  // 580 € IVA incl.
};

// ─── EXISTING IDs (identical on test and prod — both are copies) ──────────────

const ID = {
  IRPF:       144,  // product.template — Mod. 100 IRPF
  PATRIMONIO: 143,  // product.template — Mod. 714 Patrimonio
  MOD720:     220,  // product.template — Mod. 720
  ATTR_ABCD:   13,  // product.attribute — ABCD  (create_variant: no_variant)
  VAL_A:       48,  // product.attribute.value — A
  VAL_B:       49,  // product.attribute.value — B
  VAL_C:       50,  // product.attribute.value — C
};

// ─── TEXTS — edit here before running ────────────────────────────────────────

const TEXTS = {

  mod721: {
    name: {
      en_GB: 'Form 721 — Cryptocurrencies abroad (Mod. 720 add-on)',
      es_ES: 'Mod. 721 — Criptomonedas en el extranjero',
      ca_ES: "Mod. 721 — Criptomonedes a l'estranger",
    },
    description_sale: {
      en_GB: 'Add-on to Form 720 / 100. Annual informative declaration required for Spanish tax residents holding crypto or virtual assets in exchanges or wallets outside Spain exceeding €50,000. Requires a reconciled tax report (Koinly, Atani or Cointracker). Filing period: 1 Jan – 31 Mar.',
      es_ES: 'Add-on al Mod. 720 / 100. Declaración informativa anual obligatoria para residentes fiscales en España que custodien criptomonedas o activos virtuales en exchanges o wallets fuera de España con valor superior a 50.000€. Requiere informe fiscal cuadrado (Koinly, Atani o Cointracker). Plazo: 1 enero — 31 marzo.',
      ca_ES: "Add-on al Mod. 720 / 100. Declaració informativa anual obligatòria per a residents fiscals a Espanya que custodien criptomonedes o actius virtuals en exchanges o wallets fora d'Espanya amb un valor superior a 50.000€. Requereix informe fiscal quadrat (Koinly, Atani o Cointracker). Termini: 1 gener — 31 març.",
    },
  },

  participaciones: {
    name: {
      en_GB: 'Form 720 — Unlisted company interests (per company)',
      es_ES: 'Mod. 720 — Participaciones en sociedades no cotizadas (por sociedad)',
      ca_ES: 'Mod. 720 — Participacions en societats no cotitzades (per societat)',
    },
    description_sale: {
      en_GB: 'Valuation based on balance sheet, statutory review and analysis of corporate structure. Per declared company.',
      es_ES: 'Valoración según balance, revisión estatutaria y análisis de la estructura societaria. Por sociedad declarada.',
      ca_ES: "Valoració segons balanç, revisió estatutària i anàlisi de l'estructura societària. Per societat declarada.",
    },
  },

  inmuebles: {
    name: {
      en_GB: 'Form 720 — Real estate abroad (per property)',
      es_ES: 'Mod. 720 — Bienes inmuebles en el extranjero (por inmueble)',
      ca_ES: "Mod. 720 — Béns immobles a l'estranger (per immoble)",
    },
    description_sale: {
      en_GB: 'Management of cadastral or acquisition value in the foreign jurisdiction, property titles and currency conversion. Per declared property.',
      es_ES: 'Gestión del valor catastral o de adquisición en jurisdicción extranjera, títulos de propiedad y conversión de divisas. Por inmueble declarado.',
      ca_ES: "Gestió del valor cadastral o d'adquisició en jurisdicció estrangera, títols de propietat i conversió de divises. Per immoble declarat.",
    },
  },

  extemporanea: {
    name: {
      en_GB: 'Form 720 — Late / supplementary return (per year)',
      es_ES: 'Mod. 720 — Declaración extemporánea/complementaria (por ejercicio)',
      ca_ES: 'Mod. 720 — Declaració extemporània/complementària (per exercici)',
    },
    description_sale: {
      en_GB: 'For each additional tax year to be regularised out of time. Includes analysis of applicable surcharges or penalties.',
      es_ES: 'Por cada ejercicio adicional a regularizar fuera de plazo. Incluye análisis de posibles recargos o sanciones.',
      ca_ES: 'Per cada exercici addicional a regularitzar fora de termini. Inclou anàlisi de possibles recàrrecs o sancions.',
    },
  },

};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const log  = (msg) => console.log(msg);
const ok   = (msg) => console.log('  ✅ ' + msg);
const fail = (msg) => { console.error('  ❌ ' + msg); };

async function createProduct(client, key, listPrice) {
  const texts    = TEXTS[key];
  const baseName = texts.name.en_GB;

  // Idempotent: skip creation if product already exists (safe to re-run after partial failure)
  const [existing] = await client.searchRead('product.template',
    [['name', '=', baseName]], { fields: ['id'], limit: 1 });
  let tmplId;
  if (existing) {
    tmplId = existing.id;
    log(`  ⏭️  Already exists (id=${tmplId}): "${baseName}" — updating translations`);
  } else {
    tmplId = await client.create('product.template', {
      name:           baseName,
      type:           'service',
      list_price:     listPrice,
      invoice_policy: 'order',
    });
    ok(`Created product.template id=${tmplId}: "${baseName}"`);
  }

  await client.call('product.template', 'update_field_translations',
    [tmplId, 'name', texts.name]);
  ok(`name translations set`);

  await client.call('product.template', 'update_field_translations',
    [tmplId, 'description_sale', texts.description_sale]);
  ok(`description_sale translations set`);

  return tmplId;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await createClient();

  log('');
  log('══════════════════════════════════════════════════════');
  log(` Tax Products Setup`);
  log(` ${process.env.ODOO_URL}  (db: ${process.env.ODOO_DB})`);
  log('══════════════════════════════════════════════════════');

  // ── 1: Modelo 721 ──────────────────────────────────────────────────────────
  log('\n── Step 1/4: Create Modelo 721');
  const id721 = await createProduct(client, 'mod721', PRICES.mod721);

  // ── 2: Participaciones ─────────────────────────────────────────────────────
  log('\n── Step 2/4: Create Participaciones en sociedades no cotizadas');
  const idSoc = await createProduct(client, 'participaciones', PRICES.participaciones);

  // ── 3: Bienes inmuebles ────────────────────────────────────────────────────
  log('\n── Step 3/4: Create Bienes inmuebles en el extranjero');
  const idImm = await createProduct(client, 'inmuebles', PRICES.inmuebles);

  // ── 4: Extemporánea ────────────────────────────────────────────────────────
  log('\n── Step 4/4: Create Declaración extemporánea/complementaria');
  const idExt = await createProduct(client, 'extemporanea', PRICES.extemporanea);

  log(`\n  New product IDs: 721=${id721}  soc=${idSoc}  imm=${idImm}  ext=${idExt}`);

  // ── 5: Product 220 — list_price → 0 ───────────────────────────────────────
  log('\n── Step 5: Product 220 (Mod. 720) — set list_price = 0');
  await client.write('product.template', [ID.MOD720], { list_price: 0 });
  ok('list_price = 0');

  // ── 6: Product 220 — ABCD attribute line (A / B / C) ──────────────────────
  log('\n── Step 6: Product 220 — create ABCD attribute line');
  const [existingPtal] = await client.searchRead('product.template.attribute.line', [
    ['product_tmpl_id', '=', ID.MOD720],
    ['attribute_id',    '=', ID.ATTR_ABCD],
  ], { fields: ['id'], limit: 1 });

  let ptalId;
  if (existingPtal) {
    ptalId = existingPtal.id;
    log(`  ⏭️  PTAL already exists (id=${ptalId})`);
  } else {
    ptalId = await client.create('product.template.attribute.line', {
      product_tmpl_id: ID.MOD720,
      attribute_id:    ID.ATTR_ABCD,
      value_ids:       [[6, 0, [ID.VAL_A, ID.VAL_B, ID.VAL_C]]],
    });
    ok(`PTAL created (id=${ptalId})`);
  }

  // ── 7: PTAVs — price_extra ─────────────────────────────────────────────────
  log('\n── Step 7: Product 220 — set PTAV price_extras');
  const ptavs = await client.searchRead('product.template.attribute.value', [
    ['product_tmpl_id',   '=', ID.MOD720],
    ['attribute_line_id', '=', ptalId],
  ], { fields: ['id', 'product_attribute_value_id'] });

  const extraByName = {
    'ABCD: A': PRICE_EXTRAS_720.A,
    'ABCD: B': PRICE_EXTRAS_720.B,
    'ABCD: C': PRICE_EXTRAS_720.C,
  };
  for (const ptav of ptavs) {
    const name  = ptav.product_attribute_value_id[1];
    const extra = extraByName[name];
    if (extra === undefined) { fail(`Unexpected PTAV: "${name}"`); continue; }
    await client.write('product.template.attribute.value', [ptav.id], { price_extra: extra });
    ok(`"${name}" → price_extra = ${extra}`);
  }

  // ── 8: Product 220 — optional_product_ids ─────────────────────────────────
  log('\n── Step 8: Product 220 — link optional products');
  await client.write('product.template', [ID.MOD720], {
    optional_product_ids: [[4, id721], [4, idSoc], [4, idImm], [4, idExt]],
  });
  ok(`optional → 721(${id721}), soc(${idSoc}), imm(${idImm}), ext(${idExt})`);

  // ── 9: Product 144 — add 721 ───────────────────────────────────────────────
  log('\n── Step 9: Product 144 (IRPF) — add 721 to optional products');
  await client.write('product.template', [ID.IRPF], {
    optional_product_ids: [[4, id721]],
  });
  ok(`optional → added 721(${id721})`);

  log('');
  log('══════════════════════════════════════════════════════');
  log(' Done ✅  Run validate-tax-products.js to verify.');
  log('══════════════════════════════════════════════════════');
  log('');
}

main().catch((e) => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
