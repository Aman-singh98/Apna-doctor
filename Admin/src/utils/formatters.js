/**
 * Formats a date as "DD Mon YYYY" (en-IN). Pass extra Intl options to extend
 * it (e.g. { hour: '2-digit', minute: '2-digit' } for a date + time stamp).
 */
export const formatDate = (value, options = {}) => {
	if (!value) return '—';
	return new Date(value).toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		...options,
	});
};

export const formatDateTime = (value) =>
	formatDate(value, { hour: '2-digit', minute: '2-digit' });

export const formatCurrency = (value) => `₹${value ?? 0}`;