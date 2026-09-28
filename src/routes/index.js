const express = require('express');
const healthRoute = require('./health.routes');
const authRoute = require('./auth.routes');
const pasienRoute = require('./pasien.routes');
const icd10Route = require('./icd10.routes');
const icd9Route = require('./icd9.routes');
const perusahaanRoute = require('./perusahaan.routes');
const klinikRoute = require('./klinik.routes');
const kunjunganRoute = require('./kunjungan.routes');
const screeningRoute = require('./screening.routes');
const rawatJalanRoute = require('./rawatJalan.routes');
const masterRoute = require('./master.routes');
const farmasiRoute = require('./farmasi.routes');
const laboratoriumRoute = require('./laboratorium.routes');
const kasirRoute = require('./kasir.route');
const ukmRoute = require('./ukm.route');
const radiologiRoute = require('./radiologi.routes'); // [BARU] Import module radiologi
const satusehatRoute = require('./satusehat.routes');
const bpjsRoute = require('./bpjs.routes'); // [BARU] Import module BPJS PCare
const referensiRoute = require('./referensi.routes'); // [BARU] Import module Referensi Enum
const kodeposRoute = require('./kodepos.routes');
const rujukanRoute = require('./rujukan.routes');
const asetRuanganRoute = require('./asetRuangan.routes');
const router = express.Router();
const imunisasiRoute = require('./imunisasi.routes');

const dinkesRoute = require('./dinkes.routes');

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/pasien',
    route: pasienRoute,
  },
  {
    path: '/icd10',
    route: icd10Route,
  },
  {
    path: '/icd9',
    route: icd9Route,
  },
  {
    path: '/perusahaan',
    route: perusahaanRoute,
  },
  {
    path: '/klinik',
    route: klinikRoute,
  },
  {
    path: '/kunjungan',
    route: kunjunganRoute,
  },
  {
    path: '/screening',
    route: screeningRoute,
  },
  {
    path: '/rawat-jalan',
    route: rawatJalanRoute,
  },
  {
    path: '/master',
    route: masterRoute,
  },
  {
    path: '/farmasi',
    route: farmasiRoute,
  },
  {
    path: '/laboratorium',
    route: laboratoriumRoute,
  },
  {
    path: '/kasir',
    route: kasirRoute,
  },
  {
    path: '/ukm',
    route: ukmRoute,
  },
  {
    path: '/radiologi', 
    route: radiologiRoute,
  },
  {
    path: '/imunisasi',
    route: imunisasiRoute,
  },
  {
    path: '/satusehat',
    route: satusehatRoute,
  },
  {
    path: '/bpjs',
    route: bpjsRoute,
  },
  {
    path: '/referensi',
    route: referensiRoute,
  },
  {
    path: '/kodepos',
    route: kodeposRoute,
  },
  {
    path: '/rujukan',
    route: rujukanRoute,
  },
  {
    path: '/aset-ruangan',
    route: asetRuanganRoute,
  },
  {
    path: '/dinkes',
    route: dinkesRoute,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;