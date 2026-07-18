import { useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Signature from 'react-native-signature-canvas';

const TEAL = '#1A7E8A';

// Hides the library's built-in Clear/Save buttons — we render our own
// native buttons below so the modal matches the rest of the app.
const webStyle = `
   .m-signature-pad--footer { display: none; margin: 0; }
   .m-signature-pad { box-shadow: none; border: none; }
   body, html { background-color: #ffffff; }
`;

/**
 * Full-screen modal with a finger-drawable signature canvas.
 *
 * Props:
 *  - visible: boolean
 *  - onClose: () => void            — called on Cancel / hardware back
 *  - onSave: (dataUrl: string) => void
 *            called with a base64 PNG data URL ("data:image/png;base64,...")
 *            once the doctor taps Save on a non-empty canvas.
 */
export default function SignaturePadModal({ visible, onClose, onSave }) {
   const sigRef = useRef();

   const handleClear = () => {
      sigRef.current?.clearSignature();
   };

   const handleConfirm = () => {
      // Triggers onOK (or onEmpty if nothing was drawn) below.
      sigRef.current?.readSignature();
   };

   const handleOK = (dataUrl) => {
      onSave(dataUrl);
   };

   return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
         <View style={styles.container}>
            <View style={styles.header}>
               <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                  <Text style={styles.headerBtnTxt}>Cancel</Text>
               </TouchableOpacity>
               <Text style={styles.headerTitle}>Draw Your Signature</Text>
               <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
                  <Text style={[styles.headerBtnTxt, styles.headerSaveTxt]}>Save</Text>
               </TouchableOpacity>
            </View>

            <Text style={styles.hint}>Sign inside the box below using your finger</Text>

            <View style={styles.canvasWrap}>
               <Signature
                  ref={sigRef}
                  onOK={handleOK}
                  webStyle={webStyle}
                  backgroundColor="#ffffff"
                  penColor="#1a1a1a"
                  autoClear={false}
               />
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
               <Ionicons name="refresh-outline" size={16} color="#E24B4A" />
               <Text style={styles.clearBtnTxt}>Clear</Text>
            </TouchableOpacity>
         </View>
      </Modal>
   );
}

const styles = StyleSheet.create({
   container: { flex: 1, backgroundColor: '#fff' },
   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
   headerBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 56 },
   headerBtnTxt: { fontSize: 14, color: '#888', fontWeight: '600' },
   headerSaveTxt: { color: TEAL, fontWeight: '700', textAlign: 'right' },
   headerTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
   hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 14, marginBottom: 6 },
   canvasWrap: { flex: 1, marginHorizontal: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, overflow: 'hidden' },
   clearBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, marginBottom: 20 },
   clearBtnTxt: { fontSize: 13, color: '#E24B4A', fontWeight: '600' },
});
