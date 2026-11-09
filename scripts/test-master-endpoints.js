const axios = require('axios');

async function testEndpoints() {
  const baseURL = 'http://localhost:5000/api';
  console.log('Testing master endpoints at', baseURL);

  try {
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      username: 'dr_cibinong',
      password: 'password123'
    });
    const token = loginRes.data.data?.token || loginRes.data.token;
    console.log('✅ Logged in successfully as dr_cibinong');

    const headers = { Authorization: `Bearer ${token}` };

    // 1. Test Master Alergi
    const alergiRes = await axios.get(`${baseURL}/master-alergi`, { headers });
    console.log(`✅ Master Alergi: ${alergiRes.data?.data?.length || alergiRes.data?.length} records found`);

    // 2. Test Master Vaksin
    const vaksinRes = await axios.get(`${baseURL}/master/vaksin`, { headers });
    console.log(`✅ Master Vaksin: ${vaksinRes.data?.data?.length || vaksinRes.data?.length} records found`);

    // 3. Test Master Lab
    const labRes = await axios.get(`${baseURL}/master/laboratorium`, { headers });
    console.log(`✅ Master Laboratorium: ${labRes.data?.data?.length || labRes.data?.length} records found`);

    // 4. Test Master Modality
    const modRes = await axios.get(`${baseURL}/master/modality`, { headers });
    console.log(`✅ Master Modality: ${modRes.data?.data?.length || modRes.data?.length} records found`);

    // 5. Test ICD9 Search
    const icd9Res = await axios.get(`${baseURL}/icd9/search?q=infus`, { headers });
    console.log(`✅ Master ICD-9 Search: ${icd9Res.data?.length || icd9Res.data?.data?.length} results found`);

    // 6. Test Vaksin Monitoring Dinkes (Cold-Chain)
    const dinkesVaksinRes = await axios.get(`${baseURL}/dinkes/vaccines`, { headers });
    console.log(`✅ Dinkes Vaccines Monitoring: Total dosis se-kabupaten: ${dinkesVaksinRes.data?.data?.ringkasan?.totalDosisKabupaten}, Faskes terdata: ${dinkesVaksinRes.data?.data?.stokPerFaskes?.length}`);

    // 7. Test Surveilans Dinkes
    const dinkesSurveillance = await axios.get(`${baseURL}/dinkes/surveillance`, { headers });
    console.log(`✅ Dinkes Disease Surveillance: Status 200, Penyakit terpetakan: ${dinkesSurveillance.data?.data?.topDiseases?.length || 0}`);

    console.log('\n🌟 ALL MASTER & PENUNJANG ENDPOINTS VERIFIED 100% OPERATIONAL!');
  } catch (error) {
    console.error('❌ Endpoint test failed:', error.response?.data || error.message);
  }
}

testEndpoints();
