const axios = require('axios');

async function test() {
  try {
    const resMed = await axios.get('http://localhost:5000/api/dinkes/medicines');
    console.log('--- DINKES MEDICINES ---');
    console.log('Total Faskes Bermasalah:', resMed.data?.data?.totalFaskesBermasalahStok);
    console.log('Sample Obat Menipis:', JSON.stringify(resMed.data?.data?.data[0]?.obatMenipis, null, 2));

    const resVak = await axios.get('http://localhost:5000/api/dinkes/vaccines');
    console.log('--- DINKES VACCINES ---');
    console.log('Ringkasan:', JSON.stringify(resVak.data?.data?.ringkasan, null, 2));
    console.log('Faskes 1:', resVak.data?.data?.data[0]?.namaFaskes, 'Total Dosis:', resVak.data?.data?.data[0]?.totalDosis);
  } catch (err) {
    console.error('Error detail:', err.message, err.code, err.stack);
  }
}

test();
