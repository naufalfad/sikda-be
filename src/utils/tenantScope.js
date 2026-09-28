/**
 * Utility untuk isolasi data multi-tenant faskes
 * Mengunci akses data hanya untuk faskes tempat staf/nakes bertugas,
 * kecuali jika user memegang role DINKES_ADMIN / DINKES_MONITORING.
 */
const applyFaskesScope = (whereClause = {}, user, faskesField = 'faskesId') => {
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING', 'SUPERADMIN'].includes(user.role)) {
    whereClause[faskesField] = user.faskesId;
  }
  return whereClause;
};

const getEffectiveFaskesId = (user, fallbackId = null) => {
  // Jika user adalah nakes/staf puskesmas, selalu prioritaskan faskesId milik user
  if (user && user.faskesId && !['DINKES_ADMIN', 'DINKES_MONITORING'].includes(user.role)) {
    return user.faskesId;
  }
  return fallbackId || user?.faskesId || null;
};

module.exports = {
  applyFaskesScope,
  getEffectiveFaskesId
};
