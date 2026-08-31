// src/components/RazorpayCheckoutModal.js
//
// Renders Razorpay's own hosted Checkout inside a WebView and bridges the
// result back to React Native via postMessage.
//
// WHY WEBVIEW INSTEAD OF react-native-razorpay:
// - react-native-razorpay is a native module — it needs `expo prebuild` +
//   a rebuilt dev client, and its Expo/new-architecture compatibility is
//   inconsistent across RN versions.
// - react-native-webview is ALREADY a dependency here (used elsewhere in
//   the app), so this needs zero new native linking and works in the
//   existing dev client immediately.
// - Loading checkout.js from Razorpay's own CDN means Checkout's UI/behavior
//   (test-mode banner, card/UPI/netbanking tabs, OTP flows) is exactly what
//   Razorpay ships — nothing here reimplements any of that.
//
// USAGE:
//   <RazorpayCheckoutModal
//      visible={checkoutVisible}
//      order={{ orderId, amount, currency, keyId }}   // from POST .../create-order
//      prefill={{ name, email, contact }}              // optional
//      description="Video consultation with Dr. X"     // optional, shown in Checkout UI
//      onSuccess={({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {...}}
//      onDismiss={() => {...}}   // user closed Checkout without paying
//      onError={(message) => {...}}
//   />

import { useMemo, useRef } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Text, Platform, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const TEAL = '#1A7E8A';

function buildCheckoutHtml({ keyId, orderId, amount, currency, name, description, prefill, themeColor }) {
   // Minimal HTML page: loads Razorpay's checkout.js, opens Checkout
   // immediately, and posts the result back to React Native. No app UI is
   // rendered here — Checkout itself is a full-screen native-feeling modal
   // once opened, so this page is only visible for a split second while
   // checkout.js loads.
   const options = {
      key: keyId,
      amount, // paise — exactly what create-order returned, never recomputed here
      currency,
      order_id: orderId,
      name: name || 'ApnaDoctor',
      description: description || 'Consultation payment',
      prefill: {
         name: prefill?.name || '',
         email: prefill?.email || '',
         contact: prefill?.contact || '',
      },
      theme: { color: themeColor || TEAL },
      modal: {
         // Fires when the user dismisses Checkout without completing
         // payment (back button, swipe down, tapping outside).
         ondismiss: function () {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
         },
      },
   };

   return `<!DOCTYPE html>
<html>
<head>
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   <style>
      html, body { margin: 0; padding: 0; background: #ffffff; height: 100%; }
   </style>
</head>
<body>
   <script>
      function post(payload) {
         window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      try {
         var options = ${JSON.stringify(options)};
         options.handler = function (response) {
            // response = { razorpay_order_id, razorpay_payment_id, razorpay_signature }
            post({ type: 'success', payload: response });
         };
         var rzp = new Razorpay(options);
         rzp.on('payment.failed', function (response) {
            post({ type: 'failed', payload: response.error || {} });
         });
         // Small delay so the WebView has fully painted before Checkout's
         // own overlay opens on top of it — avoids a blank-flash on some
         // Android WebView versions.
         setTimeout(function () { rzp.open(); }, 150);
      } catch (err) {
         post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
   </script>
</body>
</html>`;
}

export default function RazorpayCheckoutModal({
   visible,
   order,           // { orderId, amount, currency, keyId }
   name,
   description,
   prefill,
   themeColor,
   onSuccess,
   onDismiss,
   onError,
}) {
   const webviewRef = useRef(null);
   // Ensure the WebView content is rebuilt fresh each time a NEW order is
   // opened (React Native WebView doesn't reliably reload on source.html
   // string changes alone on all platforms).
   const html = useMemo(() => {
      if (!order?.orderId || !order?.keyId) return null;
      return buildCheckoutHtml({
         keyId: order.keyId,
         orderId: order.orderId,
         amount: order.amount,
         currency: order.currency || 'INR',
         name,
         description,
         prefill,
         themeColor,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [order?.orderId, order?.keyId, order?.amount, order?.currency]);

   const handleMessage = (event) => {
      let data;
      try {
         data = JSON.parse(event.nativeEvent.data);
      } catch {
         onError?.('Could not read the payment result. Please try again.');
         return;
      }
      if (data.type === 'success') {
         onSuccess?.(data.payload);
      } else if (data.type === 'failed') {
         onError?.(data.payload?.description || 'Payment failed. Please try again.');
      } else if (data.type === 'dismiss') {
         onDismiss?.();
      } else if (data.type === 'error') {
         onError?.(data.message || 'Something went wrong while opening payment.');
      }
   };

   if (!visible || !html) return null;

   return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => onDismiss?.()}>
         <View style={styles.container}>
            <View style={styles.header}>
               <TouchableOpacity onPress={() => onDismiss?.()} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="#1a1a1a" />
               </TouchableOpacity>
               <Text style={styles.headerTxt}>Secure Payment</Text>
               <View style={{ width: 34 }} />
            </View>
            <WebView
               ref={webviewRef}
               originWhitelist={['*']}
               source={{ html }}
               onMessage={handleMessage}
               javaScriptEnabled
               domStorageEnabled
               startInLoadingState
               // Razorpay Checkout can open bank/UPI app deep-links (e.g.
               // upi://pay...) inside the WebView on Android — without
               // this, Android throws "no activity found" instead of
               // switching to the UPI app.
               onShouldStartLoadWithRequest={(request) => {
                  if (Platform.OS === 'android' && !/^https?:\/\//i.test(request.url)) {
                     Linking.openURL(request.url).catch(() => {
                        // Best-effort — if there's no app installed to handle
                        // this scheme (e.g. a UPI app not present on the
                        // device), there's nothing else useful to do here.
                     });
                     return false;
                  }
                  return true;
               }}
            />
         </View>
      </Modal>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#fff' },
   header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
   },
   closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
   headerTxt: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
});
