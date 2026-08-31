// utils/paymentLogger.js
//
// Structured logging for every payment event (order created, signature
// verified/failed, transfer created/released, refund issued, webhook
// received) so a support ticket can be traced end-to-end by order ID /
// payment ID. Deliberately not console.log — every line is a single JSON
// object so it's greppable and ingestible by a log aggregator later without
// a rewrite.
//
// Security events (signature verification failures) are logged via
// logSecurityEvent(), not logEvent(), so monitoring can alert on spikes of
// those specifically without false-positiving on ordinary payment flow.

function baseLine(level, event, correlationIds = {}, extra = {}) {
	return JSON.stringify({
		ts: new Date().toISOString(),
		level,
		scope: 'payment',
		event,
		...correlationIds, // e.g. { orderId, paymentId, transferId, appointmentId }
		...extra,
	});
}

/**
 * Normal payment lifecycle event.
 * @param {String} event - e.g. 'order.created', 'transfer.released'
 * @param {Object} correlationIds - orderId / paymentId / transferId / appointmentId, whichever apply
 * @param {Object} [extra] - any additional non-sensitive context. NEVER pass
 *   PAN, bank account, UPI id, or full card/bank details here — see the
 *   security standards doc. Amounts, statuses, and ids are fine.
 */
function logEvent(event, correlationIds = {}, extra = {}) {
	console.log(baseLine('info', event, correlationIds, extra));
}

/**
 * Security-relevant event — currently signature verification failures
 * (Checkout or webhook). Logged distinctly from ordinary application
 * errors/events so monitoring can alert on a spike of these specifically
 * (per the code-quality bar: "alert on signature-verification failure
 * spikes"). Never include the raw gateway decline reason or any
 * PII/financial field value here — reference ids only.
 */
function logSecurityEvent(event, correlationIds = {}, extra = {}) {
	console.warn(baseLine('security', event, correlationIds, extra));
}

module.exports = { logEvent, logSecurityEvent };
