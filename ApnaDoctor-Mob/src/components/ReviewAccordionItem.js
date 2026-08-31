import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
   LayoutAnimation,
   Platform,
   StyleSheet,
   Text,
   TouchableOpacity,
   UIManager,
   View,
} from 'react-native';

const TEAL = '#1A7E8A';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
   UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A soft color cue on the card's left edge, based on how the patient rated —
// green for happy, amber for mixed, red for poor. Purely decorative.
const getAccentColor = (rating) => {
   if (rating >= 4) return '#1D9E75';
   if (rating === 3) return '#F5A623';
   return '#E24B4A';
};

/**
 * Single review row, rendered as an accordion.
 *
 * - Dashboard usage: collapsible={false} -> no toggle shown, comment is
 *   always rendered (this is the "always open" dashboard behavior).
 * - Profile usage: collapsible={true} (default) + defaultOpen={false} ->
 *   starts closed, user taps the row to expand/collapse.
 *
 * `review` shape expected: { _id, patient: { name }, rating, comment, createdAt }
 */
export default function ReviewAccordionItem({
   review,
   defaultOpen = false,
   collapsible = true,
   showDate = true,
}) {
   const [isOpen, setIsOpen] = useState(defaultOpen);
   const open = collapsible ? isOpen : true;

   const toggle = () => {
      if (!collapsible) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsOpen(prev => !prev);
   };

   const patientName = review.patient?.name || 'Patient';
   const initial = (patientName[0] || '?').toUpperCase();

   return (
      <View style={[styles.card, { borderLeftColor: getAccentColor(review.rating) }]}>
         <TouchableOpacity
            style={styles.header}
            onPress={toggle}
            activeOpacity={collapsible ? 0.7 : 1}
            disabled={!collapsible}
         >
            <View style={styles.avatar}>
               <Text style={styles.avatarTxt}>{initial}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 10 }}>
               <Text style={styles.name}>{patientName}</Text>
               {showDate && !!review.createdAt && (
                  <Text style={styles.date}>
                     {new Date(review.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                     })}
                  </Text>
               )}
            </View>

            <View style={styles.starsRow}>
               {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons
                     key={i}
                     name="star"
                     size={12}
                     color={i < review.rating ? '#F5A623' : '#ddd'}
                  />
               ))}
            </View>

            {collapsible && (
               <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#aaa"
                  style={{ marginLeft: 8 }}
               />
            )}
         </TouchableOpacity>

         {open && !!review.comment && (
            <Text style={styles.comment}>{review.comment}</Text>
         )}
      </View>
   );
}

const styles = StyleSheet.create({
   card: {
      backgroundColor: '#fff',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
      borderWidth: 1.5,
      borderColor: '#E6F1F2',
      borderLeftWidth: 4,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
   },
   header: { flexDirection: 'row', alignItems: 'center' },
   avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#E8F5F7',
      alignItems: 'center',
      justifyContent: 'center',
   },
   avatarTxt: { fontSize: 13, fontWeight: 'bold', color: TEAL },
   name: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a' },
   date: { fontSize: 11, color: '#999', marginTop: 1 },
   starsRow: { flexDirection: 'row', gap: 1, marginRight: 4 },
   comment: { fontSize: 12.5, color: '#555', lineHeight: 18, marginTop: 8 },
});
