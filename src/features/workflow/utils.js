export function apiErrorMessage(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
